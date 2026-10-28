// 이야기 씬: Scene[]을 순서대로 보여준다. cut은 큰 컷(그림이 있으면 그림, 없으면 어두운 패널) + 아래 글자, line은 왼쪽 초상화 + 이름 + 말풍선.
// 터치/클릭으로 다음, 길게 누르면 빨리 넘김. 타자 효과 없음. 마지막 장면 뒤 onDone이 다음 단계로 보낸다.
import Phaser from 'phaser';
import { CHARACTERS, PLAYER } from '../character';
import type { Scene } from '../story/chapters';
import { DESIGN, MARGIN, STORY } from '../ui/layout';
import { noteMissing } from '../ui/missing';
import { drawPortrait, preloadPortraits } from '../ui/portrait';
import { COLORS, FONT, type UI, box, label, panel } from '../ui/widgets';
import { SCENE_KEYS, type StoryLaunch } from './flow';

/** 컷 그림 텍스처 키. 같은 경로는 한 번만 읽는다. */
const cutKey = (path: string) => `cut:${path}`;

export class StoryScene extends Phaser.Scene {
  launch!: StoryLaunch;
  layer!: Phaser.GameObjects.Container;
  index = 0; done = false;
  holdTimer?: Phaser.Time.TimerEvent; fastTimer?: Phaser.Time.TimerEvent; fast = false;
  constructor() { super(SCENE_KEYS.story); }
  init(data: StoryLaunch) { this.launch = data; this.index = 0; this.done = false; this.fast = false; }
  preload() {
    const scenes = this.launch?.scenes ?? [];
    // 컷 그림: 경로가 있고 아직 읽지 않았으면 읽는다. 파일이 없으면 읽기 실패 → 어두운 패널로 표시(콘솔 경고만)
    for (const s of scenes) if (s.kind === 'cut' && s.image && !this.textures.exists(cutKey(s.image))) this.load.image(cutKey(s.image), s.image);
    const speakers = Array.from(new Set(scenes.flatMap(s => (s.kind === 'line' ? [s.speaker] : [])))).map(id => CHARACTERS[id]);
    preloadPortraits(this.load, speakers.length ? speakers : [PLAYER]);
    // 컷 그림 읽기 실패는 조용히 기록만(글자 컷으로 표시). 목록은 메뉴 > 개발 정보
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
    this.layer?.destroy(true); this.layer = this.add.container();
    const ui = this.ui, s = this.launch.scenes[this.index], n = this.launch.scenes.length;
    box(ui, 0, 0, DESIGN.width, DESIGN.height, COLORS.bg);
    label(ui, MARGIN, STORY.header.y, this.launch.label, STORY.header.size, COLORS.goldDim, 560, [0, 0.5], true);
    label(ui, DESIGN.width - MARGIN, STORY.header.y, `${this.index + 1} / ${n}`, STORY.header.size, COLORS.muted, 100, [1, 0.5]);
    if (s.kind === 'cut') this.drawCut(ui, s); else this.drawLine(ui, s);
    label(ui, DESIGN.width / 2, DESIGN.height - STORY.hint.bottom, this.index + 1 < n ? '누르면 다음 · 길게 누르면 빨리 넘김' : '누르면 계속', STORY.hint.size, COLORS.muted, 600, [0.5, 0.5]);
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
  /** 대사: 왼쪽 작은 초상화(있으면 그림, 없으면 자리 표시) + 이름 + 말풍선(어두운 패널). */
  drawLine(ui: UI, s: Extract<Scene, { kind: 'line' }>) {
    const c = CHARACTERS[s.speaker], L = STORY.line;
    const top = Math.round(DESIGN.height * L.yRatio);
    const px = MARGIN + 12 + L.portraitR, py = top + L.portraitR + 6;
    drawPortrait(ui, px, py, L.portraitR, c, 'normal', false);
    const bx = px + L.portraitR + 16, bw = DESIGN.width - MARGIN - bx;
    const rows = s.text.split('\n').reduce((acc, part) => acc + Math.max(1, Math.ceil(part.length * L.textSize * 0.95 / (bw - L.pad * 2))), 0);
    const bh = Math.max(L.bubbleMinH, rows * Math.round(L.textSize * 1.5) + L.pad * 2 + 26);
    panel(ui, bx, top, bw, bh, 'dark');
    label(ui, bx + L.pad, top + 12, c.nickname ? `${c.name} ‘${c.nickname}’` : c.name, 15, COLORS.gold, bw - L.pad * 2, [0, 0], true);
    label(ui, bx + L.pad, top + 12 + 26, s.text, L.textSize, COLORS.text, bw - L.pad * 2, [0, 0]);
  }
}
