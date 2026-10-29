// 이야기 씬: Scene[]을 순서대로 보여준다. cut은 큰 컷(그림이 있으면 그림, 없으면 상자 없이 가운데 큰 글자), line은 비주얼 노벨 배치:
// 화면 아래 대화창(폭 680, 높이 = 화면 × 0.28) + 그 바로 위에 말하는 인물의 상반신(character.ts bustFit, 높이 = 화면 × 0.55, 아래 끝을 대화창 위 끝에 맞춤).
// 화자가 바뀌면 이전 상반신 120ms 페이드아웃, 새 상반신 160ms 페이드인 + 8px 올라옴. 플레이어(한도윤) 대사는 상반신 없이 대화창만(1인칭).
// 그림 파일이 없는 인물은 상반신 대신 이름표 옆 작은 원형 이니셜. 터치/클릭으로 다음, 길게 누르면 빨리 넘김. 타자 효과 없음.
import Phaser from 'phaser';
import { CHARACTERS, type CharacterId, PLAYER, cropSquare, portraitTextureKey } from '../character';
import type { Scene } from '../story/chapters';
import { DESIGN, MARGIN, STORY } from '../ui/layout';
import { noteMissing } from '../ui/missing';
import { drawPortrait, preloadPortraits } from '../ui/portrait';
import { COLORS, FONT, type UI, box, label, panel } from '../ui/widgets';
import { SCENE_KEYS, type StoryLaunch } from './flow';

/** 컷 그림 텍스처 키. 같은 경로는 한 번만 읽는다. */
const cutKey = (path: string) => `cut:${path}`;
/** 대화창·상반신 수치(요청 08 A-1). */
export const DIALOG = {
  w: 680, hRatio: 0.28, bottomGap: 52, fill: 0x101410, alpha: 0.92,
  nameTag: { h: 34, padX: 16, size: 20, fill: 0xe0b64f },
  textSize: 24, lineHeight: 1.5, pad: 24,
  bustHRatio: 0.55, fadeOutMs: 120, fadeInMs: 160, riseY: 8,
  /** 그림 없는 인물의 작은 원형 이니셜 반지름. */
  smallR: 20,
} as const;
/** 대화창 사각형(화면 아래, 가운데). */
export function dialogRect(h = DESIGN.height): { x: number; y: number; w: number; h: number } {
  const dh = Math.round(h * DIALOG.hRatio);
  return { x: (DESIGN.width - DIALOG.w) / 2, y: h - DIALOG.bottomGap - dh, w: DIALOG.w, h: dh };
}

export class StoryScene extends Phaser.Scene {
  launch!: StoryLaunch;
  /** 배경·컷(아래), 상반신(가운데), 대화창·안내(위) 세 겹. */
  layer!: Phaser.GameObjects.Container; top!: Phaser.GameObjects.Container;
  bust?: { speaker: CharacterId; img: Phaser.GameObjects.Image };
  index = 0; done = false;
  holdTimer?: Phaser.Time.TimerEvent; fastTimer?: Phaser.Time.TimerEvent; fast = false;
  constructor() { super(SCENE_KEYS.story); }
  init(data: StoryLaunch) { this.launch = data; this.index = 0; this.done = false; this.fast = false; this.bust = undefined; }
  preload() {
    const scenes = this.launch?.scenes ?? [];
    // 컷 그림: 경로가 있고 아직 읽지 않았으면 읽는다. 파일이 없으면 읽기 실패 → 글자 컷(조용히 기록, 목록은 메뉴 > 개발 정보)
    for (const s of scenes) if (s.kind === 'cut' && s.image && !this.textures.exists(cutKey(s.image))) this.load.image(cutKey(s.image), s.image);
    const speakers = Array.from(new Set(scenes.flatMap(s => (s.kind === 'line' ? [s.speaker] : [])))).map(id => CHARACTERS[id]);
    preloadPortraits(this.load, speakers.length ? speakers : [PLAYER]);
    this.load.on('loaderror', (file: { key: string; src: string }) => { if (file.key.startsWith('cut:')) noteMissing(file.src); });
  }
  create() {
    const { scenes } = this.launch;
    if (!scenes.length) { this.finish(); return; }
    this.input.on('pointerdown', () => this.onDown());
    this.input.on('pointerup', () => this.onUp());
    this.events.once('shutdown', () => this.clearTimers());
    this.draw();
  }
  get ui(): UI { return { scene: this, layer: this.layer }; }
  clearTimers() { this.holdTimer?.remove(false); this.fastTimer?.remove(false); this.holdTimer = undefined; this.fastTimer = undefined; this.fast = false; }
  /** 누르기 시작: 길게 누르면 빨리 넘김 모드(일정 간격으로 다음). */
  onDown() {
    if (this.done) return;
    this.clearTimers();
    this.holdTimer = this.time.delayedCall(STORY.longPressMs, () => {
      this.fast = true; this.advance();
      this.fastTimer = this.time.addEvent({ delay: STORY.fastStepMs, loop: true, callback: () => this.advance() });
    });
  }
  /** 떼기: 짧게 눌렀으면 한 장면 다음. 빨리 넘김 중이었으면 멈춤만. */
  onUp() {
    if (this.done) return;
    const wasFast = this.fast;
    this.clearTimers();
    if (!wasFast) this.advance();
  }
  advance() {
    if (this.done) return;
    this.index += 1;
    if (this.index >= this.launch.scenes.length) { this.finish(); return; }
    this.draw();
  }
  finish() {
    if (this.done) return;
    this.done = true; this.clearTimers();
    this.input.removeAllListeners();
    this.launch.onDone(this);
  }
  draw() {
    this.layer?.destroy(true); this.top?.destroy(true);
    this.layer = this.add.container().setDepth(0); this.top = this.add.container().setDepth(2);
    const ui = this.ui, topUi: UI = { scene: this, layer: this.top }, s = this.launch.scenes[this.index], n = this.launch.scenes.length;
    box(ui, 0, 0, DESIGN.width, DESIGN.height, COLORS.bg);
    label(topUi, MARGIN, STORY.header.y, this.launch.label, STORY.header.size, COLORS.goldDim, 560, [0, 0.5], true);
    label(topUi, DESIGN.width - MARGIN, STORY.header.y, `${this.index + 1} / ${n}`, STORY.header.size, COLORS.muted, 100, [1, 0.5]);
    if (s.kind === 'cut') { this.setBust(undefined); this.drawCut(ui, s); } else this.drawLine(topUi, s);
    label(topUi, DESIGN.width / 2, DESIGN.height - STORY.hint.bottom + 12, this.index + 1 < n ? '누르면 다음 · 길게 누르면 빨리 넘김' : '누르면 계속', STORY.hint.size, COLORS.muted, 600, [0.5, 0.5]);
  }
  /** 큰 컷: 그림이 있으면 나무 패널 안에 비율 유지로 맞추고 글자는 그 아래. 그림이 없으면 상자 없이 글자를 상자 자리 가운데에 크게(22px, 줄 간격 1.5, 아이보리). */
  drawCut(ui: UI, s: Extract<Scene, { kind: 'cut' }>) {
    const { w, h, y } = STORY.cut, x = (DESIGN.width - w) / 2;
    const key = s.image ? cutKey(s.image) : undefined;
    if (key && this.textures.exists(key)) {
      panel(ui, x, y, w, h, 'wood');
      const inner = { x: x + 8, y: y + 8, w: w - 16, h: h - 16 };
      box(ui, inner.x, inner.y, inner.w, inner.h, 0x0b0f0c);
      const img = this.add.image(inner.x + inner.w / 2, inner.y + inner.h / 2, key);
      const k = Math.min(inner.w / img.width, inner.h / img.height);
      img.setScale(k); this.layer.add(img);
      label(ui, x, y + h + STORY.cut.textGap, s.text, STORY.cut.textSize, COLORS.text, w, [0, 0]);
      return;
    }
    const T = STORY.cutText;
    const t = this.add.text(DESIGN.width / 2, y + h / 2, s.text, { fontFamily: FONT, fontSize: T.size, color: COLORS.text, align: 'center', lineSpacing: Math.round(T.size * (T.lineHeight - 1)), wordWrap: { width: w - T.pad * 2 } }).setOrigin(0.5, 0.5);
    this.layer.add(t);
  }
  /** 상반신: 그림이 있고 플레이어가 아니면 bustFit 정사각형을 높이 = 화면 × 0.55로 키워 아래 끝을 대화창 위 끝에 맞춘다. 화자가 바뀔 때만 교체(페이드). */
  setBust(speaker: CharacterId | undefined) {
    if (this.bust && this.bust.speaker === speaker) return;
    const old = this.bust; this.bust = undefined;
    if (old) this.tweens.add({ targets: old.img, alpha: 0, duration: DIALOG.fadeOutMs, onComplete: () => old.img.destroy() });
    if (!speaker || speaker === PLAYER.key) return;
    const c = CHARACTERS[speaker], key = portraitTextureKey(c, 'normal');
    if (!this.textures.exists(key)) return;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const crop = cropSquare(src.width, src.height, c.bustFit);
    const d = dialogRect(), targetH = Math.round(DESIGN.height * DIALOG.bustHRatio), k = targetH / crop.sh;
    const img = this.add.image(0, 0, key).setOrigin(0, 0).setScale(k).setCrop(crop.sx, crop.sy, crop.sw, crop.sh).setDepth(1);
    const x = DESIGN.width / 2 - (crop.sx + crop.sw / 2) * k, y = d.y - (crop.sy + crop.sh) * k;
    img.setPosition(x, y + DIALOG.riseY).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, y, duration: DIALOG.fadeInMs, ease: 'Quad.easeOut' });
    this.bust = { speaker, img };
  }
  /** 대사: 대화창(어두운 반투명 + 황동 테두리) + 왼쪽 위 금색 이름표 + 본문 24. 그림 없는 인물은 이름표 옆 작은 원형 이니셜. */
  drawLine(ui: UI, s: Extract<Scene, { kind: 'line' }>) {
    const c = CHARACTERS[s.speaker], d = dialogRect(), D = DIALOG;
    this.setBust(s.speaker);
    const hasArt = s.speaker !== PLAYER.key && this.textures.exists(portraitTextureKey(c, 'normal'));
    box(ui, d.x, d.y, d.w, d.h, D.fill, D.alpha, COLORS.brass, 2);
    const name = c.nickname ? `${c.name} ‘${c.nickname}’` : c.name;
    const tagW = Math.max(110, Math.round(name.length * D.nameTag.size * 0.95) + D.nameTag.padX * 2);
    const tagY = d.y - D.nameTag.h / 2;
    box(ui, d.x + 20, tagY, tagW, D.nameTag.h, D.nameTag.fill, 1, 0x7a6236);
    label(ui, d.x + 20 + tagW / 2, tagY + D.nameTag.h / 2, name, D.nameTag.size, COLORS.dark, tagW, [0.5, 0.5], true);
    if (!hasArt && s.speaker !== PLAYER.key) drawPortrait(ui, d.x + 20 + tagW + 12 + D.smallR, tagY + D.nameTag.h / 2, D.smallR, c, 'normal', false);
    const t = this.add.text(d.x + D.pad, d.y + D.nameTag.h / 2 + 14, s.text, { fontFamily: FONT, fontSize: D.textSize, color: COLORS.text, lineSpacing: Math.round(D.textSize * (D.lineHeight - 1)), wordWrap: { width: d.w - D.pad * 2 } });
    ui.layer.add(t);
  }
}
