// 음성 연결 지점. 녹음된 음성 파일이 아직 없으므로 아무 소리도 내지 않는다(브라우저 TTS를 자동으로 붙이지 않는다).
// 파일이 생기면 register(cue, url)로 연결한다. 효과음(sound.ts)과 독립적으로 교체·음소거할 수 있다.
export type VoiceCue = '쪽' | '싹쓸이' | '따닥' | '폭탄' | '고' | '스톱';

export class VoiceFx {
  private clips = new Map<VoiceCue, HTMLAudioElement>();
  enabled = true;
  /** 녹음 파일 연결(예: register('쪽', 'assets/voice/barber-jjok.mp3')). */
  register(cue: VoiceCue, url: string) {
    try { const a = new Audio(url); a.preload = 'auto'; this.clips.set(cue, a); } catch { /* Audio 미지원 */ }
  }
  has(cue: VoiceCue) { return this.clips.has(cue); }
  /** 연결된 파일이 있을 때만 재생한다. 재생했으면 true. */
  play(cue: VoiceCue): boolean {
    const a = this.clips.get(cue);
    if (!a || !this.enabled) return false;
    try { a.currentTime = 0; void a.play().catch(() => { /* 자동 재생 차단 */ }); return true; } catch { return false; }
  }
  /** 새 판·씬 종료: 재생 중인 음성을 멈춘다. */
  cancel() { for (const a of this.clips.values()) { try { a.pause(); } catch { /* 무시 */ } } }
}
