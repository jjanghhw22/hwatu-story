// 가운데 화투판: 어두운 나무 테두리 + 황동 선 + 짙은 초록 천(약한 결 무늬와 가장자리 그늘), 가운데 뒤집힌 더미(남은 장수 배지), 더미 둘레 흩뿌림 자리의 바닥패(같은 월은 겹친 묶음, 자리는 턴이 지나도 유지).
// 메시지는 비어 있지 않을 때만 위쪽 가운데의 반투명 캡슐로 뜨며 바닥 자리를 차지하지 않는다.
import type { Card } from '../cards';
import { drawCardBack, drawCardFace, drawMiniCard } from './cardView';
import { CARD_ASPECT, COUNT_BADGE, type FloorLayout, MISSION_PANEL, REGIONS, type Rect, TABLE_MESSAGE, TEXT_MIN, TEXT_NUM, floorLayout } from './layout';
import { COLORS, FONT, type UI, box, countBadge, label } from './widgets';

export type TableView = {
  table: readonly Card[];
  deckCount: number;
  message: string;
  /** 선택 단계에서 고를 수 있는 바닥패 id. 비어 있으면 강조 없음. */
  selectable: readonly number[];
  onPick?: (id: number) => void;
  /** 직전 배치의 월→자리 배정. 넘기면 기존 묶음이 같은 자리에 남는다. */
  prevSlots?: ReadonlyMap<number, number>;
  /** 연출 중이라 정적 화면에서 숨길 카드 id(위치는 그대로 계산). */
  hidden?: ReadonlySet<number>;
  /** 뻑 묶음: 월 → 만든 플레이어(0 나, 1 상대). 묶음 아래에 표시한다. */
  ppeok?: ReadonlyMap<number, number>;
  /** 미션(플레이어만): 지정 카드, 이미 획득한 id, 달성 여부, 배수. 화투판 오른쪽 위 작은 패널. */
  mission?: { cards: readonly Card[]; have: ReadonlySet<number>; done: boolean; multiplier: number };
};

/** 미션 패널 자리(화투판 오른쪽 위). */
export function missionPanelRect(): Rect { const t = REGIONS.table; return { x: t.x + t.w - 12 - MISSION_PANEL.w, y: t.y + 12, w: MISSION_PANEL.w, h: MISSION_PANEL.h }; }
function drawMissionPanel(ui: UI, m: NonNullable<TableView['mission']>) {
  const r = missionPanelRect(), P = MISSION_PANEL;
  box(ui, r.x, r.y, r.w, r.h, m.done ? 0x6b5420 : 0x0b1a14, 0.92, m.done ? COLORS.cardSelectedEdge : COLORS.brassDim, m.done ? 2 : 1);
  label(ui, r.x + P.pad, r.y + 2, 'MISSION', TEXT_MIN, m.done ? COLORS.gold : COLORS.goldDim, r.w, [0, 0], true);
  label(ui, r.x + r.w - P.pad, r.y + 1, `×${m.multiplier}`, TEXT_NUM, COLORS.gold, 40, [1, 0], true);
  const cw = Math.round(P.cardH * CARD_ASPECT), y = r.y + P.titleH + 4;
  m.cards.forEach((c, i) => {
    const x = r.x + P.pad + i * (cw + P.gap);
    drawMiniCard(ui, x, y, cw, P.cardH, c);
    if (m.have.has(c.id)) { const g = ui.scene.add.rectangle(x + cw / 2, y + P.cardH / 2, cw + 4, P.cardH + 4, 0x000000, 0).setStrokeStyle(3, COLORS.cardSelectedEdge); ui.layer.add(g); }
  });
}

/** 천 질감: 아주 약한 사선 결(패 그림을 가리지 않도록 투명도 0.045)과 가장자리 그늘. */
function drawFelt(ui: UI, x: number, y: number, w: number, h: number) {
  box(ui, x, y, w, h, COLORS.felt);
  const g = ui.scene.add.graphics();
  g.lineStyle(1, 0x0a2a18, 0.045);
  for (let d = -h; d < w; d += 22) {
    const s0 = Math.max(0, -d), s1 = Math.min(h, w - d);
    if (s1 <= s0) continue;
    g.beginPath(); g.moveTo(x + d + s0, y + h - s0); g.lineTo(x + d + s1, y + h - s1); g.strokePath();
  }
  ui.layer.add(g);
  // 가장자리 그늘(안쪽으로 갈수록 옅어지는 세 겹)
  for (const [inset, a] of [[0, 0.22], [5, 0.12], [11, 0.06]] as const) box(ui, x + inset, y + inset, w - inset * 2, h - inset * 2, 0x000000, 0, 0x061a10).setStrokeStyle(inset === 0 ? 2 : 1, 0x061a10, a);
}

export function drawTable(ui: UI, v: TableView): FloorLayout {
  const t = REGIONS.table;
  // 나무 틀: 짙은 갈색, 바깥 황동 선, 안쪽 밝은 나무 선
  box(ui, t.x, t.y, t.w, t.h, COLORS.wood, 1, COLORS.brass);
  box(ui, t.x + 3, t.y + 3, t.w - 6, t.h - 6, COLORS.woodLight, 1, COLORS.wood);
  drawFelt(ui, t.x + 8, t.y + 8, t.w - 16, t.h - 16);
  const choosing = v.selectable.length > 0;
  const fanMonth = choosing ? v.table.find(c => v.selectable.includes(c.id))?.month : undefined;
  const lay = floorLayout(v.table.map(c => c.month), fanMonth, v.prevSlots);
  // 더미: 두께감을 주는 뒷면 두 장 + 오른쪽 아래 남은 장수 배지(뒷면 위에는 글자를 두지 않는다)
  if (v.deckCount > 1) box(ui, lay.deck.x + 3, lay.deck.y + 3, lay.deck.w, lay.deck.h, 0x6b0d14, 1, 0x3a0608);
  drawCardBack(ui, lay.deck);
  countBadge(ui, lay.deck.x + lay.deck.w - COUNT_BADGE.d / 2 + 4, lay.deck.y + lay.deck.h - COUNT_BADGE.d / 2 + 4, String(v.deckCount));
  for (const i of lay.drawOrder) {
    const c = v.table[i], can = v.selectable.includes(c.id);
    if (v.hidden?.has(c.id)) continue;
    const r = lay.cards[i];
    // 바닥패 그림자(자리 기울기와 같은 각도)
    const sh = ui.scene.add.rectangle(r.x + r.w / 2 + 2, r.y + r.h / 2 + 3, r.w, r.h, 0x000000, 0.25).setAngle(r.angle ?? 0);
    ui.layer.add(sh);
    // 선택 단계: 고를 두 장만 펼치고 나머지는 약하게 어둡게(선택 대상이 분명하고 클릭 영역은 카드 전체)
    drawCardFace(ui, r, c, { selected: can, dim: choosing && !can, dimAlpha: 0.35, onTap: can && v.onPick ? () => v.onPick!(c.id) : undefined });
  }
  // 뻑 묶음 표시: 묶음의 첫 장 아래에 작은 꼬리표
  if (v.ppeok) for (const [month, owner] of v.ppeok) {
    const i = v.table.findIndex(c => c.month === month);
    if (i < 0) continue;
    const r = lay.cards[i];
    box(ui, r.x, r.y + r.h - 18, Math.round(r.w * 1.6), 18, 0x5a1f28, 0.92, COLORS.brassDim);
    label(ui, r.x + Math.round(r.w * 0.8), r.y + r.h - 9, `뻑 · ${owner === 0 ? '나' : '상대'}`, 12, COLORS.text, r.w * 1.6, [0.5, 0.5], true);
  }
  if (v.mission) drawMissionPanel(ui, v.mission);
  // 메시지 캡슐: 비어 있지 않을 때만, 화투판 위쪽 가운데(미션 패널이 있으면 그 왼쪽 영역 가운데)
  if (v.message) {
    const availW = v.mission ? t.w - MISSION_PANEL.w - 24 : t.w;
    const cx = t.x + availW / 2, cy = t.y + TABLE_MESSAGE.top + TABLE_MESSAGE.h / 2;
    const text = ui.scene.add.text(cx, cy, v.message, { fontFamily: FONT, fontSize: TABLE_MESSAGE.size, color: COLORS.text, wordWrap: { width: availW - 60 } }).setOrigin(0.5, 0.5);
    const w = Math.min(availW - 24, text.width + TABLE_MESSAGE.padX * 2), h = Math.max(TABLE_MESSAGE.h, text.height + 8);
    const bg = ui.scene.add.rectangle(cx, cy, w, h, 0x000000, TABLE_MESSAGE.alpha).setOrigin(0.5, 0.5);
    ui.layer.add(bg); ui.layer.add(text);
  }
  return lay;
}
