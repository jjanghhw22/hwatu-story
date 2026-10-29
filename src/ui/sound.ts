// 효과음: 외부 음원 없이 WebAudio로 합성한 짧은 마찰·타격음. 모두 같은 질감(대역 통과 잡음 한 번)이며 음색 차이는 작게 둔다.
//   select  손패 선택   아주 작은 "틱"
//   deal    패 내기     "착!"  — 2.5~3.5kHz 대역 잡음, 1.5ms 어택 뒤 30ms 안에 감쇠
//   flip    더미 뒤집기 "탁"  — 같은 질감, 더 작고 짧게, 조금 높게
//   capture 획득       "차락" — 타격 두 번(간격 40ms), 내기보다 작게
//   ttadak  따닥       내기 타격 두 번(간격 70ms). 따닥 턴에서는 더미 패 착지음을 이것으로 대신해 같은 접촉음이 겹치지 않는다
//   bomb    폭탄       타격 세 번(간격 55ms), 조금 넓은 대역
//   combo   족보 완성   짧은 타격 두 번을 높은 대역(3.6kHz)으로. 종소리·긴 잔향 없음
// 저음 몸통(thump)은 쓰지 않는다. 멜로디·전자음·긴 잔향 없음. 마스터 저역 통과는 7kHz(먹먹함 방지), 압축기로 합산 볼륨 제한.
// 브라우저 정책상 첫 사용자 입력 뒤에 unlock()을 불러야 소리가 난다. 켜기/끄기는 localStorage에 기억한다.
// 합성음이므로 실제 화투 녹음과는 차이가 있다. 아래 수치는 청취로 조정하는 시작점이며 이번 변경은 직접 듣고 확인하지 않았다.
export type SoundKind = 'select' | 'deal' | 'flip' | 'capture' | 'ttadak' | 'bomb' | 'combo' | 'bell';
/** 흔들기 종: 2kHz 사인 한 번, 짧은 감쇠(멜로디 없음). */
const BELL = { freq: 2000, attack: 0.002, decay: 0.25, vol: 0.22 } as const;
const STORAGE_KEY = 'hwatu.sound';
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
} satisfies Record<string, Hit>;
/** 종류별 타격 순서(시작 시각 오프셋 초, 파라미터). 한 종류는 한 번의 play로 모두 예약된다. */
const PATTERNS: Record<Exclude<SoundKind, 'bell'>, { at: number; hit: Hit }[]> = {
  select: [{ at: 0, hit: HITS.select }],
  deal: [{ at: 0, hit: HITS.deal }],
  flip: [{ at: 0, hit: HITS.flip }],
  capture: [{ at: 0, hit: { ...HITS.flip, vol: 0.26 } }, { at: 0.040, hit: { ...HITS.deal, vol: 0.40 } }],
  ttadak: [{ at: 0, hit: HITS.deal }, { at: 0.070, hit: { ...HITS.deal, vol: 0.48 } }],
  bomb: [{ at: 0, hit: { ...HITS.deal, q: 0.9 } }, { at: 0.055, hit: { ...HITS.deal, q: 0.9, vol: 0.5 } }, { at: 0.110, hit: { ...HITS.deal, q: 0.9, vol: 0.6 } }],
  combo: [{ at: 0, hit: HITS.combo }, { at: 0.060, hit: { ...HITS.combo, vol: 0.40 } }],
};

export class SoundFx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private lastAt: Partial<Record<SoundKind, number>> = {};
  private sources = new Set<AudioBufferSourceNode>();
  enabled = true;
  constructor() {
    try { this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { /* 저장소 없음 */ }
  }
  /** 사용자 입력 핸들러 안에서 호출. 컨텍스트를 만들고 재개한다. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        // 마스터: 저역 통과(날카로운 초고음만 제거) → 압축기(합산 볼륨 제한) → 출력
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = MASTER_LOWPASS_HZ; lp.Q.value = 0.5;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.001; comp.release.value = 0.06;
        this.master = this.ctx.createGain(); this.master.gain.value = 0.7;
        this.master.connect(lp).connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* WebAudio 미지원 */ }
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  setEnabled(v: boolean) {
    this.enabled = v;
    try { localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off'); } catch { /* 저장소 없음 */ }
  }
  /** 해당 동작의 순간(바닥에 닿음, 뒤집기 끝, 획득 칸 도착)에 호출한다. 한 사건에 한 종류만 부르면 접촉음이 겹치지 않는다. */
  play(kind: SoundKind) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.lastAt[kind] ?? -Infinity) < MIN_GAP_MS) return;
    this.lastAt[kind] = now;
    const t = this.ctx.currentTime;
    if (kind === 'bell') { this.tone(t, BELL.freq, BELL.attack, BELL.decay, BELL.vol); return; }
    for (const p of PATTERNS[kind]) this.hit(t + p.at, p.hit);
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
  /** 예약된 타격을 모두 멈춘다(새 판·씬 종료). 타격은 0.2초 미만이라 보통 들을 새도 없지만 이전 판의 예약이 남지 않게 한다. */
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
