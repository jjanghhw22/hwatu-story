// 공통 위젯: 글자, 버튼, 상자, 패널, 칩, 장수 배지. 화면 모듈은 이 헬퍼로만 Phaser 객체를 만든다.
// 테마: 낡은 동네 이발소. 짙은 초록 천, 어두운 나무, 얇은 황동 테두리, 아이보리·금색 글자. 과한 금색 장식은 쓰지 않는다.
import Phaser from 'phaser';
import { COUNT_BADGE, INFO, type Rect } from './layout';

export type UI = { scene: Phaser.Scene; layer: Phaser.GameObjects.Container };
/** 본문 글꼴(로컬 포함 나눔고딕, 없으면 시스템 한글 고딕). */
export const FONT = '"NanumGothic", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
/** 사건 배너용 붓글씨 글꼴(로컬 포함 나눔붓). */
export const BRUSH_FONT = '"NanumBrushScript", "NanumGothic", "Malgun Gothic", sans-serif';
export const COLORS = {
  /** 화면 바탕: 깊은 녹색이 섞인 짙은 갈색. */
  bg: 0x141a14,
  /** 나무 패널과 그 테두리(황동). */
  wood: 0x2b1b12, woodLight: 0x3a2619, brass: 0xb08d4a, brassDim: 0x7a6236,
  /** 패널 안쪽(어두운 녹색). */
  panel: 0x15302a, panelEdge: 0x7a6236,
  /** 화투판 천. */
  felt: 0x1d5a3a, feltDark: 0x154630, feltEdge: 0x2b1b12,
  cardFace: 0xf6eedb, cardEdge: 0x9c2f3a, cardSelected: 0xfff1c2, cardSelectedEdge: 0xe0b64f,
  gold: '#e0b64f', goldDim: '#b08d4a', text: '#f3e9d2', muted: '#b7ab93', dark: '#1a120c', danger: '#e09a9a', orange: '#f0923a',
  /** 박 경고 글자(빨강). */
  bakWarn: '#e03a3a',
  buttonOn: 0xd8b25a, buttonOff: 0x4a4138, buttonEdge: 0xf0d58a, buttonShadow: 0x5a4316,
} as const;

export function label(ui: UI, x: number, y: number, text: string, size = 18, color: string = COLORS.text, wrap = 680, origin: [number, number] = [0, 0], bold = false) {
  const t = ui.scene.add.text(x, y, text, { fontFamily: FONT, fontSize: size, color, fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: wrap } }).setOrigin(origin[0], origin[1]);
  ui.layer.add(t);
  return t;
}

/** 검은 외곽선이 있는 글자(카드·패널 위에서도 읽히게). */
export function outlined(ui: UI, x: number, y: number, text: string, size: number, color: string, origin: [number, number] = [0, 0], thickness = 4, bold = true) {
  const t = ui.scene.add.text(x, y, text, { fontFamily: FONT, fontSize: size, color, stroke: '#000000', strokeThickness: thickness, fontStyle: bold ? 'bold' : 'normal' }).setOrigin(origin[0], origin[1]);
  ui.layer.add(t);
  return t;
}

/** 글자 폭 측정(배치 계산용, 임시 객체는 바로 지운다). */
export function measureText(scene: Phaser.Scene, text: string, size: number, bold = false): number {
  const t = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: size, fontStyle: bold ? 'bold' : 'normal' });
  const w = t.width;
  t.destroy();
  return w;
}

export function box(ui: UI, x: number, y: number, w: number, h: number, fill: number, alpha = 1, stroke?: number, strokeW = 1) {
  const r = ui.scene.add.rectangle(x, y, w, h, fill, alpha).setOrigin(0);
  if (stroke !== undefined) r.setStrokeStyle(strokeW, stroke);
  ui.layer.add(r);
  return r;
}

export type PanelStyle = 'wood' | 'dark' | 'felt';
/**
 * 테마 패널: 나무(짙은 갈색 + 황동 테두리 + 안쪽 밝은 선), 어두운 녹색(정보·획득패), 천(화투판).
 * active면 테두리를 금색으로. alpha는 배경 채움의 투명도(테두리는 그대로, 빈 획득 패 패널을 가볍게 보일 때). 돌려주는 바깥 사각형에 입력을 걸 수 있다.
 */
export function panel(ui: UI, x: number, y: number, w: number, h: number, style: PanelStyle = 'dark', active = false, alpha = 1) {
  const edge = active ? COLORS.cardSelectedEdge : COLORS.brassDim;
  if (style === 'wood') {
    const outer = box(ui, x, y, w, h, COLORS.wood, alpha, edge, active ? 2 : 1);
    box(ui, x + 3, y + 3, w - 6, h - 6, COLORS.woodLight, alpha, COLORS.wood);
    box(ui, x + 5, y + 5, w - 10, h - 10, 0x000000, 0, 0x5a4a2e); // 안쪽 얇은 선
    return outer;
  }
  if (style === 'felt') {
    const outer = box(ui, x, y, w, h, COLORS.feltEdge, alpha, COLORS.brassDim);
    box(ui, x + 4, y + 4, w - 8, h - 8, COLORS.felt, alpha);
    return outer;
  }
  const outer = box(ui, x, y, w, h, COLORS.panel, alpha, edge, active ? 2 : 1);
  box(ui, x + 2, y + 2, w - 4, h - 4, 0x000000, 0, 0x1f4a3e);
  return outer;
}

/** 상태 칩: 둥근 사각형 + 흰 글자(크기는 INFO.chip). 자리는 layout의 flowChips가 정한다. */
export function chip(ui: UI, r: Rect, text: string, color: number, alpha = 1) {
  const g = ui.scene.add.graphics();
  g.fillStyle(color, alpha);
  g.fillRoundedRect(r.x, r.y, r.w, r.h, INFO.chip.radius);
  ui.layer.add(g);
  label(ui, r.x + r.w / 2, r.y + r.h / 2, text, INFO.chip.size, '#ffffff', r.w, [0.5, 0.5], true).setAlpha(alpha);
}

/** 장수 배지: 검은 원(COUNT_BADGE) + 흰 굵은 숫자. 획득 묶음 오른쪽 아래, 더미 오른쪽 아래에 쓴다. */
export function countBadge(ui: UI, cx: number, cy: number, text: string) {
  const c = ui.scene.add.circle(cx, cy, COUNT_BADGE.d / 2, COUNT_BADGE.fill, COUNT_BADGE.alpha);
  ui.layer.add(c);
  label(ui, cx, cy, text, COUNT_BADGE.size, '#ffffff', COUNT_BADGE.d * 2, [0.5, 0.5], true);
}

/** 터치하기 쉬운 입체 버튼(기본 높이 52): 아래 그림자, 윗부분 밝은 띠. 누르면 살짝 내려앉고, 비활성은 평평한 회색. fill로 선택·구분 색을 준다. */
export function button(ui: UI, x: number, y: number, w: number, text: string, fn: () => void, enabled = true, h = 52, size = 20, fill: number = COLORS.buttonOn) {
  const depth = enabled ? 4 : 0;
  if (enabled) box(ui, x, y + depth, w, h, COLORS.buttonShadow);
  const face = ui.scene.add.rectangle(x, y, w, h, enabled ? fill : COLORS.buttonOff).setOrigin(0).setStrokeStyle(1, enabled ? COLORS.buttonEdge : 0x5a5148);
  ui.layer.add(face);
  const shine = ui.scene.add.rectangle(x + 2, y + 2, w - 4, Math.max(4, Math.round(h * 0.28)), 0xffffff, enabled ? 0.16 : 0.04).setOrigin(0);
  ui.layer.add(shine);
  const t = label(ui, x + w / 2, y + h / 2, text, size, enabled ? COLORS.dark : '#8d8577', w - 16, [0.5, 0.5], true);
  if (enabled) face.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
    // 눌림: 면과 글자를 그림자 쪽으로 내려앉혔다가 돌아온다(화면이 바로 다시 그려지면 그대로 사라진다)
    ui.scene.tweens.add({ targets: [face, shine, t], y: '+=3', duration: 50, yoyo: true });
    fn();
  });
  return face;
}

/** 전체 화면을 덮어 뒤쪽 입력을 차단하는 막. */
export function blocker(ui: UI, w: number, h: number, alpha: number) {
  const s = ui.scene.add.rectangle(0, 0, w, h, 0x0a0806, alpha).setOrigin(0).setInteractive();
  ui.layer.add(s);
  return s;
}
