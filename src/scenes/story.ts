// 이야기 씬(요청 17 리뉴얼): Scene[]을 순서대로 보여준다. 색·서체는 theme 토큰만 쓴다.
// - line(대사): 화면 하단 1/3 대사 박스(makePanel) + 왼쪽 원형 초상(기존 <id>-neutral.png) + 초상 위 금색 이름표 + 본문 타자기 출력.
//   탭하면 즉시 전체 표시, 한 번 더 탭하면 다음. 초상 그림이 없는 화자는 이름표만. 길게 누르면 빨리 넘김(타자 생략).
// - cut(그림 있음): 웹툰 패널 — 연속된 컷을 위에서 아래로 쌓고 새 패널만 페이드인, 글은 패널 아래쪽 띠에 얹는다.
//   그림 파일이 없으면(missing.ts 기록) 기존 패널 색 배경 + 가운데 글자 폴백(하위 호환).
// - cut(그림 지정 없음) = 지문(행동 묘사): 초상 없이 화면 중앙, textDim 이탤릭.
// - 끝 선택지(launch.choice): 대사 박스 위에 makeButton 세로 나열. 우상단 SKIP은 이미 본 이야기(progress.seenStories)만 활성.
// - 장면 전환(들어올 때·끝날 때)은 검정 페이드 0.4초.
import Phaser from 'phaser';
import { CHARACTERS, PLAYER, portraitTextureKey } from '../character';
import type { Scene } from '../story/chapters';
import { hasSeenStory, loadProgress, markStorySeen, saveProgress } from '../story/progress';
import { DESIGN, MARGIN, STORY } from '../ui/layout';
import { makeButton, makePanel } from '../ui/components';
import { COLORS as TOKENS, FONTS, TEXT_STYLES, colorNum } from '../ui/theme';
import { loadFailed, noteMissing } from '../ui/missing';
import { drawPortrait, preloadPortraits } from '../ui/portrait';
import { type UI, box, label } from '../ui/widgets';
import { SCENE_KEYS, type StoryChoiceOption, type StoryLaunch } from './flow';

/** 컷 그림 텍스처 키. 같은 경로는 한 번만 읽는다. */
const cutKey = (path: string) => `cut:${path}`;
/** 대사 박스(하단 1/3)·이름표·타자기 수치(요청 17). 색은 theme 토큰만 쓴다. */
export const DIALOG = {
  w: 680, hRatio: 1 / 3, bottomGap: 24, pad: 24,
  /** 왼쪽 원형 초상 반지름. */
  portraitR: 52,
  nameTag: { h: 34, padX: 14, size: 18 },
  lineHeight: 1.5,
  /** 타자기: 글자당 간격(ms). */
  typeMsPerChar: 18,
} as const;
/** 대사 박스 사각형(화면 아래, 가운데). */
export function dialogRect(h = DESIGN.height): { x: number; y: number; w: number; h: number } {
  const dh = Math.round(h * DIALOG.hRatio);
  return { x: (DESIGN.width - DIALOG.w) / 2, y: h - DIALOG.bottomGap - dh, w: DIALOG.w, h: dh };
}
/** 웹툰 컷 스택: 패널 폭·간격·새 패널 페이드인, 패널 아래쪽 글자 띠. */
export const CUTS = { w: 640, gap: 12, maxH: 340, fadeMs: 300, captionSize: 16, captionPad: 10, top: 48 } as const;
/** 장면 전환 검정 페이드(ms). */
export const FADE_MS = 400;
/** 선택지 버튼(대사 박스 위 세로 나열). */
const CHOICE = { w: 440, h: 52, gap: 10 } as const;
const SKIP_BTN = { w: 92, h: 36 } as const;

type Typing = { obj: Phaser.GameObjects.Text; full: string; shown: number; timer: Phaser.Time.TimerEvent };

export class StoryScene extends Phaser.Scene {
  launch!: StoryLaunch;
  /** 배경·컷·대사(아래), 머리글·SKIP·선택지(위) 두 겹. */
  layer!: Phaser.GameObjects.Container; top!: Phaser.GameObjects.Container;
  index = 0; done = false; choiceShown = false;
  /** 이 라벨을 전에 끝까지 봤는가(SKIP 활성). create에서 한 번 읽는다. */
  seen = false;
  holdTimer?: Phaser.Time.TimerEvent; fastTimer?: Phaser.Time.TimerEvent; fast = false;
  typing?: Typing;
  constructor() { super(SCENE_KEYS.story); }
  init(data: StoryLaunch) { this.launch = data; this.index = 0; this.done = false; this.choiceShown = false; this.fast = false; this.typing = undefined; }
  preload() {
    const scenes = this.launch?.scenes ?? [];
    // 컷 그림: 경로가 있고 아직 읽지 않았으면 읽는다. 파일이 없으면 읽기 실패 → 패널 폴백(조용히 기록, 목록은 메뉴 > 개발 정보). 이미 실패한 키는 다시 요청하지 않는다.
    for (const s of scenes) if (s.kind === 'cut' && s.image) { const k = cutKey(s.image); if (!this.textures.exists(k) && !loadFailed(k)) this.load.image(k, s.image); }
    const speakers = Array.from(new Set(scenes.flatMap(s => (s.kind === 'line' ? [s.speaker] : [])))).map(id => CHARACTERS[id]);
    preloadPortraits(this.load, speakers.length ? speakers : [PLAYER]);
    this.load.on('loaderror', (file: { key: string; src: string }) => { if (file.key.startsWith('cut:')) noteMissing(file.src, file.key); });
  }
  create() {
    const { scenes } = this.launch;
    this.seen = hasSeenStory(loadProgress(), this.launch.label);
    if (!scenes.length) { this.end(() => this.launch.onDone(this), true); return; }
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
    // 버튼(SKIP·선택지) 위에서 뗀 손가락은 장면 넘김으로 치지 않는다(over에 버튼 히트 영역이 잡힌다)
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: unknown[]) => { if (!over?.length) this.onDown(); });
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: unknown[]) => { if (!over?.length) this.onUp(); else this.clearHold(); });
    this.events.once('shutdown', () => this.clearTimers());
    this.draw();
  }
  get ui(): UI { return { scene: this, layer: this.layer }; }
  clearHold() { this.holdTimer?.remove(false); this.fastTimer?.remove(false); this.holdTimer = undefined; this.fastTimer = undefined; this.fast = false; }
  clearTyping() { this.typing?.timer.remove(false); this.typing = undefined; }
  clearTimers() { this.clearHold(); this.clearTyping(); }
  /** 누르기 시작: 길게 누르면 빨리 넘김 모드(타자 생략, 일정 간격으로 다음). */
  onDown() {
    if (this.done || this.choiceShown) return;
    this.clearHold();
    this.holdTimer = this.time.delayedCall(STORY.longPressMs, () => {
      this.fast = true; this.advance();
      this.fastTimer = this.time.addEvent({ delay: STORY.fastStepMs, loop: true, callback: () => this.advance() });
    });
  }
  /** 떼기: 타자 중이면 전체 표시만, 아니면 다음 장면. 빨리 넘김 중이었으면 멈춤만. */
  onUp() {
    if (this.done || this.choiceShown) return;
    const wasFast = this.fast;
    this.clearHold();
    if (wasFast) return;
    if (this.revealAll()) return;
    this.advance();
  }
  /** 타자 중이면 본문을 즉시 전부 보여준다. 탭을 소비했으면 true. */
  revealAll(): boolean {
    if (!this.typing) return false;
    this.typing.obj.setText(this.typing.full);
    this.clearTyping();
    return true;
  }
  advance() {
    if (this.done || this.choiceShown) return;
    if (this.index + 1 >= this.launch.scenes.length) {
      if (this.launch.choice?.options.length) { this.choiceShown = true; this.clearHold(); this.draw(); return; }
      this.end(() => this.launch.onDone(this));
      return;
    }
    this.index += 1;
    this.draw();
  }
  /** SKIP: 이미 본 이야기만. 선택지가 있으면 선택지로 건너뛰고, 없으면 바로 끝낸다. */
  skip() {
    if (this.done) return;
    this.clearTimers();
    if (this.launch.choice?.options.length && !this.choiceShown) {
      this.index = this.launch.scenes.length - 1;
      this.choiceShown = true; this.draw();
      return;
    }
    if (!this.choiceShown) this.end(() => this.launch.onDone(this));
  }
  /** 끝(완주·선택): 열람 기록 저장 → 검정 페이드 0.4초 → 다음으로. immediate면 페이드 없이 바로. */
  end(next: () => void, immediate = false) {
    if (this.done) return;
    this.done = true; this.clearTimers();
    this.input.removeAllListeners();
    const q = loadProgress(), q2 = markStorySeen(q, this.launch.label);
    if (q2 !== q) saveProgress(q2);
    if (immediate) { next(); return; }
    this.cameras.main.once('camerafadeoutcomplete', () => next());
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
  }
  pick(opt: StoryChoiceOption) { this.end(() => opt.pick(this)); }
  draw() {
    this.clearTyping();
    this.layer?.destroy(true); this.top?.destroy(true);
    this.layer = this.add.container().setDepth(0); this.top = this.add.container().setDepth(2);
    const ui = this.ui, topUi: UI = { scene: this, layer: this.top }, s = this.launch.scenes[this.index], n = this.launch.scenes.length;
    box(ui, 0, 0, DESIGN.width, DESIGN.height, colorNum(TOKENS.bg));
    label(topUi, MARGIN, STORY.header.y, this.launch.label, STORY.header.size, TOKENS.goldDim, 480, [0, 0.5], true);
    label(topUi, DESIGN.width - MARGIN - SKIP_BTN.w - 12, STORY.header.y, `${this.index + 1} / ${n}`, STORY.header.size, TOKENS.textDim, 100, [1, 0.5]);
    const skipBtn = makeButton(this, DESIGN.width - MARGIN - SKIP_BTN.w, STORY.header.y - SKIP_BTN.h / 2, SKIP_BTN.w, SKIP_BTN.h, 'SKIP', () => this.skip());
    skipBtn.setEnabled(this.seen && !this.choiceShown);
    this.top.add(skipBtn.container);
    if (s.kind === 'line') this.drawLine(ui, s);
    else if (s.image && this.textures.exists(cutKey(s.image))) this.drawCutStack();
    else if (s.image) this.drawCutFallback(s);
    else this.drawNarration(s);
    if (this.choiceShown && this.launch.choice) this.drawChoice(topUi, this.launch.choice.prompt, this.launch.choice.options);
    const hint = this.choiceShown ? '선택하세요'
      : s.kind === 'line' ? '탭: 글 전체 표시 → 다음 · 길게 누르면 빨리 넘김'
      : this.index + 1 < n ? '누르면 다음 · 길게 누르면 빨리 넘김' : '누르면 계속';
    label(topUi, DESIGN.width / 2, DESIGN.height - STORY.hint.bottom + 12, hint, STORY.hint.size, TOKENS.textDim, 600, [0.5, 0.5]);
  }
  /** 이 장면이 웹툰 스택에 낄 수 있는 컷인가(그림 지정 + 읽기 성공). */
  isStackCut(s: Scene | undefined): s is Extract<Scene, { kind: 'cut' }> {
    return !!s && s.kind === 'cut' && !!s.image && this.textures.exists(cutKey(s.image));
  }
  /** 웹툰 패널: 연속된 그림 컷 묶음을 위에서 아래로 쌓는다. 지금 컷(마지막 패널)만 페이드인, 글은 패널 아래쪽 띠. */
  drawCutStack() {
    const scenes = this.launch.scenes;
    let g0 = this.index;
    while (g0 > 0 && this.isStackCut(scenes[g0 - 1])) g0 -= 1;
    const shown = scenes.slice(g0, this.index + 1).filter((c): c is Extract<Scene, { kind: 'cut' }> => c.kind === 'cut');
    const bottom = DESIGN.height - STORY.hint.bottom - 24;
    const availH = bottom - CUTS.top;
    const n = shown.length;
    const panelH = Math.min(CUTS.maxH, Math.floor((availH - (n - 1) * CUTS.gap) / n));
    const x = (DESIGN.width - CUTS.w) / 2;
    shown.forEach((c, i) => {
      const y = CUTS.top + i * (panelH + CUTS.gap);
      const holder = this.add.container();
      this.layer.add(holder);
      const sub: UI = { scene: this, layer: holder };
      holder.add(makePanel(this, x, y, CUTS.w, panelH));
      const inner = { x: x + 6, y: y + 6, w: CUTS.w - 12, h: panelH - 12 };
      box(sub, inner.x, inner.y, inner.w, inner.h, colorNum(TOKENS.shadow), 0.4);
      const img = this.add.image(inner.x + inner.w / 2, inner.y + inner.h / 2, cutKey(c.image!));
      img.setScale(Math.min(inner.w / img.width, inner.h / img.height));
      holder.add(img);
      // 글자 띠: 패널 아래쪽에 얹는다(웹툰 자막)
      const t = this.add.text(0, 0, c.text, { fontFamily: FONTS.body, fontSize: CUTS.captionSize, color: TOKENS.text, lineSpacing: Math.round(CUTS.captionSize * 0.4), wordWrap: { width: inner.w - CUTS.captionPad * 2 } });
      const stripH = Math.min(inner.h - 8, Math.ceil(t.height) + CUTS.captionPad * 2);
      box(sub, inner.x, inner.y + inner.h - stripH, inner.w, stripH, colorNum(TOKENS.panel), 0.9);
      t.setPosition(inner.x + CUTS.captionPad, inner.y + inner.h - stripH + CUTS.captionPad);
      holder.add(t);
      if (i === n - 1 && !this.fast) { holder.setAlpha(0); this.tweens.add({ targets: holder, alpha: 1, duration: CUTS.fadeMs, ease: 'Quad.easeOut' }); }
    });
  }
  /** 그림을 지정했는데 파일이 없는 컷: 기존 패널 색 배경 + 가운데 글자(의도된 폴백, 하위 호환). */
  drawCutFallback(s: Extract<Scene, { kind: 'cut' }>) {
    const { w, h, y } = STORY.cut, x = (DESIGN.width - w) / 2;
    const T = STORY.cutText;
    this.layer.add(makePanel(this, x, y, w, h));
    const t = this.add.text(DESIGN.width / 2, y + h / 2, s.text, { fontFamily: FONTS.body, fontSize: T.size, color: TOKENS.text, align: 'center', lineSpacing: Math.round(T.size * (T.lineHeight - 1)), wordWrap: { width: w - T.pad * 2 } }).setOrigin(0.5, 0.5);
    this.layer.add(t);
  }
  /** 지문(행동 묘사, 그림 지정 없는 컷): 초상·패널 없이 화면 중앙, textDim 이탤릭. */
  drawNarration(s: Extract<Scene, { kind: 'cut' }>) {
    const cy = Math.round((CUTS.top + DESIGN.height - STORY.hint.bottom) / 2);
    const t = this.add.text(DESIGN.width / 2, cy, s.text, { fontFamily: FONTS.body, fontSize: 22, fontStyle: 'italic', color: TOKENS.textDim, align: 'center', lineSpacing: 11, wordWrap: { width: 560 } }).setOrigin(0.5, 0.5);
    this.layer.add(t);
  }
  /** 대사: 하단 1/3 대사 박스 + 왼쪽 원형 초상 + 초상 위 금색 이름표 + 본문 타자기. 초상 그림이 없는 화자는 이름표만. */
  drawLine(ui: UI, s: Extract<Scene, { kind: 'line' }>) {
    const c = CHARACTERS[s.speaker], d = dialogRect(), D = DIALOG, r = D.portraitR;
    this.layer.add(makePanel(this, d.x, d.y, d.w, d.h));
    const hasArt = this.textures.exists(portraitTextureKey(c, 'normal'));
    const cx = d.x + D.pad + r, cy = d.y + D.nameTag.h / 2 + 12 + r;
    if (hasArt) drawPortrait(ui, cx, cy, r, c, 'normal', false);
    // 이름표: 금색 바탕 작은 라벨, 초상 바로 위(박스 위 모서리에 걸침). 초상이 없으면 왼쪽 끝에.
    const name = c.nickname ? `${c.name} ‘${c.nickname}’` : c.name;
    const tagW = Math.max(96, Math.round(name.length * D.nameTag.size * 0.95) + D.nameTag.padX * 2);
    const tagX = hasArt ? Math.max(d.x + 8, Math.round(cx - tagW / 2)) : d.x + 16;
    const tagY = d.y - D.nameTag.h / 2;
    box(ui, tagX, tagY, tagW, D.nameTag.h, colorNum(TOKENS.gold), 1, colorNum(TOKENS.goldDim));
    label(ui, tagX + tagW / 2, tagY + D.nameTag.h / 2, name, D.nameTag.size, TOKENS.bg, tagW, [0.5, 0.5], true);
    // 본문: TEXT_STYLES.body 타자기 출력(탭하면 즉시 전체 표시). 초상이 있으면 그 오른쪽부터.
    const tx = d.x + D.pad + (hasArt ? r * 2 + 16 : 0), ty = d.y + D.pad + 4;
    const bodySize = TEXT_STYLES.body.fontSize as number;
    const t = this.add.text(tx, ty, '', { ...TEXT_STYLES.body, lineSpacing: Math.round(bodySize * (D.lineHeight - 1)), wordWrap: { width: d.x + d.w - D.pad - tx } });
    this.layer.add(t);
    this.startType(t, s.text);
  }
  /** 타자기 출력. 빨리 넘김 중에는 즉시 전부 표시. */
  startType(obj: Phaser.GameObjects.Text, full: string) {
    if (this.fast) { obj.setText(full); return; }
    this.typing = {
      obj, full, shown: 0,
      timer: this.time.addEvent({ delay: DIALOG.typeMsPerChar, loop: true, callback: () => {
        const ty = this.typing;
        if (!ty) return;
        ty.shown += 1;
        ty.obj.setText(ty.full.slice(0, ty.shown));
        if (ty.shown >= ty.full.length) this.clearTyping();
      } }),
    };
  }
  /** 선택지: 대사 박스 위에 makeButton 세로 나열(2~4개). 고르면 pick이 다음 화면으로 보낸다. */
  drawChoice(topUi: UI, prompt: string | undefined, options: StoryChoiceOption[]) {
    const d = dialogRect(), n = options.length;
    const x = (DESIGN.width - CHOICE.w) / 2;
    const y0 = d.y - 16 - n * (CHOICE.h + CHOICE.gap) + CHOICE.gap;
    if (prompt) label(topUi, DESIGN.width / 2, y0 - 22, prompt, 17, TOKENS.gold, 600, [0.5, 0.5], true);
    options.forEach((opt, i) => {
      const b = makeButton(this, x, y0 + i * (CHOICE.h + CHOICE.gap), CHOICE.w, CHOICE.h, opt.text, () => this.pick(opt));
      this.top.add(b.container);
    });
  }
}
