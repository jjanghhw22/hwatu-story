// 전역 사운드 매니저(요청 21): 파일 효과음(wav 12종, 이미 입고) + 합성 폴백 + BGM(루프 1채널, 0.5초 크로스페이드) + 마스터 볼륨.
// - 파일 효과음: public/assets/audio/sfx/<이름>.wav. 첫 입력(unlock) 때 AudioBuffer로 미리 읽어 기존 마스터 체인(저역통과→압축기)으로
//   재생한다. 읽기 실패 시 FILE_FALLBACK의 기존 합성음으로 폴백(대응물이 없는 go/win/lose/fold/ppeok/sweep은 무음).
// - BGM: public/assets/audio/bgm/{map,match,tension}.mp3. 파일이 없으면 무음(tension만 예외: 없으면 직전 곡 유지).
// - 볼륨: 0~1, localStorage 'hwatu.volume.v1'(진행 저장과 분리). 켜기/끄기는 기존 'hwatu.sound' 그대로.
// - 브라우저 자동 재생 제한: 첫 사용자 입력에서 unlock()을 불러야 소리·BGM이 시작된다(씬들이 pointerdown에 연결).
//
// 합성음(기존 유지): 외부 음원 없이 WebAudio로 합성한 짧은 마찰·타격음. 모두 같은 질감(대역 통과 잡음 한 번)이며 음색 차이는 작게 둔다.
//   select  손패 선택   아주 작은 "틱"
//   deal    패 내기     "착!"  — 2.5~3.5kHz 대역 잡음, 1.5ms 어택 뒤 30ms 안에 감쇠
//   flip    더미 뒤집기 "탁"  — 같은 질감, 더 작고 짧게, 조금 높게
//   capture 획득       "차락" — 타격 두 번(간격 40ms), 내기보다 작게
//   ttadak  따닥       내기 타격 두 번(간격 70ms). 따닥 턴에서는 더미 패 착지음을 이것으로 대신해 같은 접촉음이 겹치지 않는다
//   bomb    폭탄       타격 세 번(간격 55ms), 조금 넓은 대역
//   combo   족보 완성   짧은 타격 두 번을 높은 대역(3.6kHz)으로. 종소리·긴 잔향 없음
//   stamp   콜아웃 도장 낮은 대역 타격 두 번(간격 30ms, 합계 약 110ms) — 쿵 찍히는 느낌
// 저음 몸통(thump)은 쓰지 않는다. 멜로디·전자음·긴 잔향 없음. 마스터 저역 통과는 7kHz(먹먹함 방지), 압축기로 합산 볼륨 제한.
// 합성음이므로 실제 녹음과는 차이가 있다. 수치는 청취로 조정하는 시작점이며 이번 변경은 직접 듣고 확인하지 않았다.
import { noteMissing } from './missing.ts';

export type SoundKind = 'select' | 'deal' | 'flip' | 'capture' | 'ttadak' | 'bomb' | 'combo' | 'bell' | 'thud' | 'stamp';
/** 파일 효과음 이름(요청 21, public/assets/audio/sfx/<이름>.wav). 읽기 실패 시 FILE_FALLBACK의 합성음, 그것도 없으면 무음. */
export type SfxName = 'place' | 'flip' | 'capture' | 'chok' | 'ppeok' | 'sweep' | 'go' | 'win' | 'lose' | 'tap' | 'fold' | 'stamp';
export type BgmTrack = 'map' | 'match' | 'tension';
/** 6장 "걸릴 뻔": 낮은 사인 한 음(90Hz), 짧은 감쇠. */
const THUD = { freq: 90, attack: 0.004, decay: 0.32, vol: 0.55 } as const;
/** 흔들기 종: 2kHz 사인 한 번, 짧은 감쇠(멜로디 없음). */
const BELL = { freq: 2000, attack: 0.002, decay: 0.25, vol: 0.22 } as const;
const STORAGE_KEY = 'hwatu.sound';
const VOLUME_KEY = 'hwatu.volume.v1';
const SFX_DIR = 'assets/audio/sfx/', BGM_DIR = 'assets/audio/bgm/';
const SFX_NAMES: readonly SfxName[] = ['place', 'flip', 'capture', 'chok', 'ppeok', 'sweep', 'go', 'win', 'lose', 'tap', 'fold', 'stamp'];
/** 파일을 못 읽었을 때 대신 낼 기존 합성음(명세 4종 place/flip/tap/stamp + 합성 대응물이 있는 capture/chok). 나머지는 무음. */
const FILE_FALLBACK: Partial<Record<SfxName, SoundKind>> = { place: 'deal', flip: 'flip', tap: 'select', stamp: 'stamp', capture: 'capture', chok: 'ttadak' };
/** BGM 음량(마스터 대비)과 크로스페이드 시간. */
const BGM_VOL = 0.35, BGM_FADE_S = 0.5;
/** 같은 종류가 이 간격 안에 다시 요청되면 무시한다(여러 장 획득 시 중첩으로 커지는 것 방지). */
const MIN_GAP_MS = 60;
/** 마스터 저역 통과 차단 주파수. 4.2kHz는 먹먹해 7kHz로 올렸다. */
const MASTER_LOWPASS_HZ = 7000;

/** 타격 한 번의 파라미터. attack: 어택 시간(초), decay: 어택 뒤 감쇠 시간(초), band/q: 대역 통과 중심·폭, vol: 최대 게인. */
type Hit = { attack: number; decay: number; band: number; q: number; vol: number };
const HITS = {
  deal: { attack: 0.0015, decay: 0.030, band: 3000, q: 1.2, vol: 0.55 },
  flip: { attack: 0.0012, decay: 0.022, band: 3200, q: 1.4, vol: 0.30 },
  select: { attack: 0.0010, decay: 0.014, band: 3400, q: 1.6, vol: 0.14 },
  combo: { attack: 0.0012, decay: 0.026, band: 3600, q: 1.6, vol: 0.34 },
  stamp: { attack: 0.0020, decay: 0.050, band: 1300, q: 0.9, vol: 0.45 },
} satisfies Record<string, Hit>;
/** 종류별 타격 순서(시작 시각 오프셋 초, 파라미터). 한 종류는 한 번의 play로 모두 예약된다. */
const PATTERNS: Record<Exclude<SoundKind, 'bell' | 'thud'>, { at: number; hit: Hit }[]> = {
  select: [{ at: 0, hit: HITS.select }],
  deal: [{ at: 0, hit: HITS.deal }],
  flip: [{ at: 0, hit: HITS.flip }],
  capture: [{ at: 0, hit: { ...HITS.flip, vol: 0.26 } }, { at: 0.040, hit: { ...HITS.deal, vol: 0.40 } }],
  ttadak: [{ at: 0, hit: HITS.deal }, { at: 0.070, hit: { ...HITS.deal, vol: 0.48 } }],
  bomb: [{ at: 0, hit: { ...HITS.deal, q: 0.9 } }, { at: 0.055, hit: { ...HITS.deal, q: 0.9, vol: 0.5 } }, { at: 0.110, hit: { ...HITS.deal, q: 0.9, vol: 0.6 } }],
  combo: [{ at: 0, hit: HITS.combo }, { at: 0.060, hit: { ...HITS.combo, vol: 0.40 } }],
  stamp: [{ at: 0, hit: HITS.stamp }, { at: 0.030, hit: { ...HITS.stamp, band: 800, vol: 0.40 } }],
};

export class SoundFx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private lastAt: Partial<Record<string, number>> = {};
  private sources = new Set<AudioBufferSourceNode>();
  // ---- 파일 효과음·BGM 상태 ----
  private buffers = new Map<SfxName, AudioBuffer>();
  private bgmBuffers = new Map<BgmTrack, AudioBuffer>();
  private failed = new Set<string>();
  private bgmNode?: { src: AudioBufferSourceNode; gain: GainNode; track: BgmTrack };
  private wantBgm?: BgmTrack;
  private sfxLoaded = false;
  enabled = true;
  /** 마스터 볼륨 0~1('hwatu.volume.v1'). 효과음·BGM 모두에 적용된다. */
  volume = 0.7;
  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
      const v = Number.parseFloat(localStorage.getItem(VOLUME_KEY) ?? '');
      if (Number.isFinite(v)) this.volume = Math.min(1, Math.max(0, v));
    } catch { /* 저장소 없음 */ }
  }
  /** 사용자 입력 핸들러 안에서 호출. 컨텍스트를 만들고 재개하며, 파일 읽기와 대기 중인 BGM을 시작한다. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        // 마스터: 저역 통과(날카로운 초고음만 제거) → 압축기(합산 볼륨 제한) → 출력
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = MASTER_LOWPASS_HZ; lp.Q.value = 0.5;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.001; comp.release.value = 0.06;
        this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
        this.master.connect(lp).connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (!this.sfxLoaded) { this.sfxLoaded = true; void this.loadSfxFiles(); }
      if (this.wantBgm) void this.ensureBgm(this.wantBgm);
    } catch { /* WebAudio 미지원 */ }
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  setEnabled(v: boolean) {
    this.enabled = v;
    try { localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off'); } catch { /* 저장소 없음 */ }
    if (!v) this.stopBgm();
    else if (this.wantBgm) void this.ensureBgm(this.wantBgm);
  }
  /** 마스터 볼륨(0~1)을 바꾸고 기억한다. */
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* 저장소 없음 */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }
  // ---- 파일 효과음 ----
  /** 파일 효과음(없으면 합성 폴백, 그것도 없으면 무음). 콜아웃·버튼·사건음은 이쪽을 쓴다. */
  sfx(name: SfxName) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.lastAt[`f:${name}`] ?? -Infinity) < MIN_GAP_MS) return;
    this.lastAt[`f:${name}`] = now;
    const buf = this.buffers.get(name);
    if (buf) { this.playBuffer(buf, 0.8); return; }
    const fb = FILE_FALLBACK[name];
    if (fb) this.playSynth(fb);
  }
  /** 합성 효과음(기존 호출 지점용). 파일과 무관하게 항상 합성음. */
  play(kind: SoundKind) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.lastAt[kind] ?? -Infinity) < MIN_GAP_MS) return;
    this.lastAt[kind] = now;
    this.playSynth(kind);
  }
  private playSynth(kind: SoundKind) {
    const t = this.ctx!.currentTime;
    if (kind === 'bell') { this.tone(t, BELL.freq, BELL.attack, BELL.decay, BELL.vol); return; }
    if (kind === 'thud') { this.tone(t, THUD.freq, THUD.attack, THUD.decay, THUD.vol); return; }
    for (const p of PATTERNS[kind]) this.hit(t + p.at, p.hit);
  }
  private playBuffer(buf: AudioBuffer, vol: number) {
    const ctx = this.ctx!, g = ctx.createGain();
    g.gain.value = vol;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.connect(g).connect(this.master!); src.start();
    this.sources.add(src); src.onended = () => this.sources.delete(src);
  }
  /** mp3 한 개를 읽어 디코드한다. 404·디코드 실패는 기록만 하고 조용히 넘어간다(재요청 없음). */
  private async fetchBuffer(path: string): Promise<AudioBuffer | undefined> {
    if (this.failed.has(path) || !this.ctx) return undefined;
    try {
      const res = await fetch(path);
      if (!res.ok) { this.failed.add(path); noteMissing(path); return undefined; }
      return await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch { this.failed.add(path); noteMissing(path); return undefined; }
  }
  private async loadSfxFiles() {
    await Promise.all(SFX_NAMES.map(async name => {
      const buf = await this.fetchBuffer(`${SFX_DIR}${name}.wav`);
      if (buf) this.buffers.set(name, buf);
    }));
  }
  // ---- BGM ----
  /** 이 트랙을 틀어 달라고 요청한다(지도 map, 대국 match, 긴장 tension). unlock 전이면 기억해 뒀다가 첫 입력 뒤 시작한다. */
  bgm(track: BgmTrack) {
    this.wantBgm = track;
    if (this.ready && this.enabled) void this.ensureBgm(track);
  }
  private async ensureBgm(track: BgmTrack) {
    if (!this.bgmBuffers.has(track)) {
      const buf = await this.fetchBuffer(`${BGM_DIR}${track}.mp3`);
      if (buf) this.bgmBuffers.set(track, buf);
    }
    if (this.wantBgm !== track || !this.enabled || !this.ready) return;
    const buf = this.bgmBuffers.get(track);
    // 파일 없음: tension은 직전 곡(match) 유지, 나머지는 멈춘다
    if (!buf) { if (track !== 'tension') this.stopBgm(); return; }
    if (this.bgmNode?.track === track) return;
    const ctx = this.ctx!, t = ctx.currentTime;
    this.stopBgm();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(BGM_VOL, t + BGM_FADE_S);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.connect(gain).connect(this.master!); src.start(t);
    this.bgmNode = { src, gain, track };
  }
  /** 현재 BGM을 0.5초에 걸쳐 끄고 멈춘다(크로스페이드의 내리는 쪽). */
  private stopBgm() {
    const node = this.bgmNode;
    if (!node || !this.ctx) { this.bgmNode = undefined; return; }
    const t = this.ctx.currentTime;
    try {
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(Math.max(0.0001, node.gain.gain.value), t);
      node.gain.gain.linearRampToValueAtTime(0.0001, t + BGM_FADE_S);
      node.src.stop(t + BGM_FADE_S + 0.05);
    } catch { /* 이미 끝남 */ }
    this.bgmNode = undefined;
  }
  /** 사인 한 음(종): 빠른 어택 뒤 지수 감쇠. 잡음 타격과 달리 음정이 있지만 한 음뿐이라 멜로디는 아니다. */
  private tone(t: number, freq: number, attack: number, decay: number, vol: number) {
    const ctx = this.ctx!, out = this.master!;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    osc.connect(g).connect(out); osc.start(t); osc.stop(t + attack + decay + 0.01);
    this.sources.add(osc as unknown as AudioBufferSourceNode); osc.onended = () => this.sources.delete(osc as unknown as AudioBufferSourceNode);
  }
  /** 예약된 타격·재생 중 효과음을 모두 멈춘다(새 판·씬 종료). BGM은 멈추지 않는다. */
  cancel() {
    for (const s of this.sources) { try { s.stop(); } catch { /* 이미 끝남 */ } }
    this.sources.clear();
  }
  /**
   * 타격음 = 대역 통과 잡음 한 번. 게인 포락선으로 1~2ms 안에 최대치까지 올린 뒤 지수적으로 빠르게 줄인다.
   * 잡음 자체도 앞쪽이 강하고 뒤로 갈수록 약해지도록 만들어 '쉬익' 하는 꼬리가 남지 않게 한다.
   */
  private hit(t: number, h: Hit) {
    const ctx = this.ctx!, out = this.master!;
    const len = h.attack + h.decay;
    const n = Math.max(1, Math.floor(ctx.sampleRate * len));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const k = 1 - i / n; d[i] = (Math.random() * 2 - 1) * k * k * k; }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = h.band; bp.Q.value = h.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(h.vol, t + h.attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(bp).connect(g).connect(out); src.start(t); src.stop(t + len + 0.005);
    this.sources.add(src); src.onended = () => this.sources.delete(src);
  }
}

/** 전역 공유 인스턴스: BGM이 씬을 넘나들며 이어지도록 모든 씬이 이 하나를 쓴다. */
export const SOUND = new SoundFx();
