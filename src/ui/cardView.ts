// 카드 표시. 그림은 cardAssets가 연결한 텍스처를 쓰고, 텍스처가 없을 때만 글자 카드로 대신한다.
import { type Card, type Kind, kindLabel } from '../cards';
import { BACK_TEXTURE, cardTextureKey } from './cardAssets';
import { type Rect } from './layout';
import { COLORS, type UI, countBadge, label } from './widgets';

const KIND_COLORS: Record<Kind, number> = { '광': 0xf2c45a, '열끗': 0xb9d39a, '띠': 0xe09a9a, '피': 0xd9d2bd };
const BAND_COLORS = { '홍단': 0xe08a8a, '청단': 0x8eb4e3, '초단': 0x9ccf96, '비띠': 0xb9b2c4 } as const;

/** 분류별 색(글자 카드 대체 표시와 강조에 사용). */
export function tagColor(c: Card): number {
  if (c.kind === '띠') return BAND_COLORS[c.band ?? '비띠'];
  if (c.kind === '피' && c.ssangpi) return 0xb8a784;
  return KIND_COLORS[c.kind];
}

export type CardFaceOptions = { selected?: boolean; dim?: boolean; /** 어둡게 할 때의 막 투명도(기본 0.55). */ dimAlpha?: number; onTap?: () => void; /** 폭탄 가능 표시: 색 테두리 + 왼쪽 위 작은 글자 */ badge?: string; badgeColor?: number; /** 흔들기 가능 표시: 금색 테두리 + 오른쪽 위 종 모양(도형). 종 도형들을 돌려받아 흔들림 트윈을 걸 수 있다. */ bell?: (parts: Phaser.GameObjects.GameObject[]) => void };

/** 사각형 r에 텍스처 이미지를 비율대로 맞춘다. r은 layout이 CARD_ASPECT로 만든 사각형이다. r.angle이 있으면 중심 기준으로 기울인다. */
function fitImage(ui: UI, r: Rect, key: string) {
  const img = ui.scene.add.image(r.x + r.w / 2, r.y + r.h / 2, key).setDisplaySize(r.w, r.h).setAngle(r.angle ?? 0);
  ui.layer.add(img);
  return img;
}
/** r와 같은 중심·기울기의 테두리/막 사각형(원점 중앙). */
function centered(ui: UI, r: Rect, grow: number, fill?: number, alpha?: number) {
  const rc = ui.scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w + grow, r.h + grow, fill, alpha).setAngle(r.angle ?? 0);
  ui.layer.add(rc);
  return rc;
}

/** 앞면 카드. 그림을 가리는 글자는 두지 않는다. 선택 강조는 바깥 테두리, 클릭 영역은 카드 전체(기울기 포함). */
export function drawCardFace(ui: UI, r: Rect, c: Card, o: CardFaceOptions = {}) {
  const key = cardTextureKey(c.id);
  const hit: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle = ui.scene.textures.exists(key) ? fitImage(ui, r, key) : drawFallbackFace(ui, r, c);
  if (o.selected) centered(ui, r, 6).setStrokeStyle(4, COLORS.cardSelectedEdge);
  if (o.badge) {
    const color = o.badgeColor ?? 0xff7a45;
    centered(ui, r, 4).setStrokeStyle(3, color);
    const bw = Math.max(34, o.badge.length * 12 + 10), bh = 18;
    ui.layer.add(ui.scene.add.rectangle(r.x + 3, r.y + 3, bw, bh, color).setOrigin(0));
    label(ui, r.x + 3 + bw / 2, r.y + 3 + bh / 2, o.badge, 11, COLORS.dark, bw, [0.5, 0.5]);
  }
  if (o.bell) { centered(ui, r, 4).setStrokeStyle(3, COLORS.cardSelectedEdge); o.bell(drawBell(ui, r.x + r.w - 16, r.y + 14, Math.max(9, Math.round(r.h * 0.07)))); }
  if (o.dim) centered(ui, r, 0, 0x091316, o.dimAlpha ?? 0.55);
  if (o.onTap) hit.setInteractive({ useHandCursor: true }).on('pointerdown', o.onTap);
  return hit;
}

/** 종 모양(그림 없이 도형): 금색 사다리꼴 몸통 + 작은 원(추) + 위 고리. 몸통 원점은 위 가운데라 흔들림 트윈은 각도만 바꾸면 된다. */
export function drawBell(ui: UI, cx: number, cy: number, s: number): Phaser.GameObjects.GameObject[] {
  const body = ui.scene.add.polygon(cx, cy, [[-s * 0.45, 0], [s * 0.45, 0], [s, s * 1.4], [-s, s * 1.4]], 0xe0b64f).setOrigin(0.5, 0).setStrokeStyle(1, 0x7a6236);
  const clapper = ui.scene.add.circle(cx, cy + s * 1.55, s * 0.3, 0xe0b64f).setStrokeStyle(1, 0x7a6236);
  const ring = ui.scene.add.circle(cx, cy - s * 0.15, s * 0.22, 0x000000, 0).setStrokeStyle(2, 0xe0b64f);
  const parts = [body, clapper, ring];
  for (const p of parts) ui.layer.add(p);
  return parts;
}

/** 텍스처가 없을 때의 글자 카드(개발용 대체). */
function drawFallbackFace(ui: UI, r: Rect, c: Card) {
  const s = r.h / 130;
  const base = ui.scene.add.rectangle(r.x, r.y, r.w, r.h, COLORS.cardFace).setOrigin(0).setStrokeStyle(2, COLORS.cardEdge);
  ui.layer.add(base);
  const stripH = Math.round(26 * s);
  ui.layer.add(ui.scene.add.rectangle(r.x + 2, r.y + 2, r.w - 4, stripH, tagColor(c)).setOrigin(0));
  label(ui, r.x + r.w / 2, r.y + 2 + stripH / 2, `${c.month}월`, Math.round(16 * s), COLORS.dark, r.w, [0.5, 0.5]);
  label(ui, r.x + r.w / 2, r.y + r.h * 0.6, `${c.title}\n${kindLabel(c)}`, Math.round(12 * s), '#243e3d', r.w - 6, [0.5, 0.5]);
  return base;
}

/** 뒷면 카드(상대 손패·더미). 내용은 공개하지 않고 장수만 표시한다. */
export function drawCardBack(ui: UI, r: Rect, caption?: string) {
  if (ui.scene.textures.exists(BACK_TEXTURE.key)) fitImage(ui, r, BACK_TEXTURE.key);
  else ui.layer.add(ui.scene.add.rectangle(r.x, r.y, r.w, r.h, 0xb3121b).setOrigin(0).setStrokeStyle(2, COLORS.cardEdge));
  if (caption) {
    const s = r.h / 130;
    ui.layer.add(ui.scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w - 10 * s, Math.round(26 * s), 0x091316, 0.7).setOrigin(0.5));
    label(ui, r.x + r.w / 2, r.y + r.h / 2, caption, Math.round(15 * s), COLORS.text, r.w, [0.5, 0.5]);
  }
}

/** 상대 손패용 작은 뒷면. */
export function drawMiniBack(ui: UI, x: number, y: number, w: number, h: number) {
  drawCardBack(ui, { x, y, w, h });
}

/** 획득 패 묶음용 작은 카드. 쌍피·국진·비광은 금색 테두리로 표시한다. */
export function drawMiniCard(ui: UI, x: number, y: number, w: number, h: number, c: Card) {
  const key = cardTextureKey(c.id);
  if (ui.scene.textures.exists(key)) fitImage(ui, { x, y, w, h }, key);
  else {
    ui.layer.add(ui.scene.add.rectangle(x, y, w, h, tagColor(c)).setOrigin(0).setStrokeStyle(1, COLORS.cardEdge));
    label(ui, x + w / 2, y + h / 2, String(c.month), 11, COLORS.dark, w, [0.5, 0.5]);
  }
  if (c.ssangpi || c.rainGwang || c.gukjin) ui.layer.add(ui.scene.add.rectangle(x, y, w, h).setOrigin(0).setStrokeStyle(2, COLORS.cardSelectedEdge));
}

/**
 * "더미만 뒤집기" 기회 패(화면용). 배경은 더미·상대 손패와 같은 뒷면 텍스처(BACK_TEXTURE, 이미 로드됨)를 그대로 쓰고
 * 틴트·오버레이 없이 그 위에 Phaser 도형 폭탄과 흰 글씨(얇은 검은 외곽선)를 올린다. 카드 데이터가 아니므로 덱·획득패와 무관하다.
 */
export function drawChanceCard(ui: UI, r: Rect, o: { dim?: boolean; onTap?: () => void; /** 남은 뒤집기 기회(한 장에 숫자 배지로 합쳐 보인다). */ count?: number } = {}) {
  const s = r.h / 130;
  const base: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle = ui.scene.textures.exists(BACK_TEXTURE.key)
    ? fitImage(ui, r, BACK_TEXTURE.key)
    : (() => { const rc = ui.scene.add.rectangle(r.x, r.y, r.w, r.h, 0xb3121b).setOrigin(0).setStrokeStyle(2, COLORS.cardEdge); ui.layer.add(rc); return rc; })();
  const cx = r.x + r.w / 2, cy = r.y + r.h * 0.42, rad = Math.round(22 * s);
  // 폭탄: 검은 구 + 하이라이트 + 심지 + 불꽃
  ui.layer.add(ui.scene.add.circle(cx, cy, rad, 0x111111).setStrokeStyle(2, 0x444444));
  ui.layer.add(ui.scene.add.circle(cx - rad * 0.35, cy - rad * 0.35, rad * 0.22, 0x555555));
  ui.layer.add(ui.scene.add.rectangle(cx + rad * 0.55, cy - rad * 0.95, Math.max(3, 4 * s), rad * 0.5, 0x8a6a3a).setOrigin(0.5, 1).setAngle(25));
  ui.layer.add(ui.scene.add.star(cx + rad * 0.85, cy - rad * 1.35, 5, rad * 0.18, rad * 0.4, 0xffd36a));
  // 글씨: 흰색 + 얇은 검은 외곽선(빨간 뒷면 위에서도 선명하게)
  const outlined = (y: number, text: string, size: number) => {
    const t = ui.scene.add.text(cx, y, text, { fontFamily: 'Arial, sans-serif', fontSize: size, color: '#ffffff', stroke: '#000000', strokeThickness: Math.max(2, Math.round(3 * s)) }).setOrigin(0.5, 0.5);
    ui.layer.add(t);
  };
  outlined(r.y + r.h * 0.78, '뒤집기', Math.round(18 * s));
  outlined(r.y + r.h * 0.92, '더미만', Math.round(11 * s));
  if (o.count !== undefined && o.count > 1) countBadge(ui, r.x + r.w - 14, r.y + 14, String(o.count));
  if (o.dim) ui.layer.add(ui.scene.add.rectangle(r.x, r.y, r.w, r.h, 0x091316, 0.55).setOrigin(0));
  if (o.onTap) base.setInteractive({ useHandCursor: true }).on('pointerdown', o.onTap);
  return base;
}
