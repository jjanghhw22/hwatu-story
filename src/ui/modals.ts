// 세로 화면용 모달. 어두운 반투명 막 위에 나무·황동 패널. 뒤쪽 카드·버튼 입력을 차단하고, 버튼은 세로로 쌓는다.
import { type Card, cardById } from '../cards';
import { drawCardFace } from './cardView';
import { CARD_ASPECT, DESIGN } from './layout';
import { COLORS, type UI, blocker, box, button, label, panel } from './widgets';

export type ModalLine = { text: string; size?: number; color?: string; bold?: boolean };
export type ModalButton = { text: string; onTap: () => void; enabled?: boolean; /** 버튼 색(고/스톱처럼 구분이 필요할 때). */ fill?: number };
export type Modal = {
  title: string; titleColor?: string; lines: ModalLine[]; buttons: ModalButton[]; alpha?: number;
  /** 제목 오른쪽에 보여줄 카드 id(예: 국진 선택창). 같은 그림 연결 정보를 쓴다. */
  card?: number;
  /** 창의 빈 곳을 눌렀을 때(결과창: 전체 즉시 표시). */
  onTap?: () => void;
  /** 글자 줄 영역의 최소 높이. 결과창처럼 줄이 차례로 늘어날 때 창 크기가 흔들리지 않게 한다. */
  minBodyH?: number;
};

const PAD = 28, W = 640, BTN_H = 56, BTN_GAP = 12, CARD_H = 150;

export function drawModal(ui: UI, m: Modal) {
  const back = blocker(ui, DESIGN.width, DESIGN.height, m.alpha ?? 0.8);
  if (m.onTap) back.on('pointerdown', m.onTap);
  const cardW = Math.round(CARD_H * CARD_ASPECT);
  const textW = W - PAD * 2 - (m.card !== undefined ? cardW + 16 : 0);
  // 줄 높이: 명시적 줄바꿈과 폭에 따른 자동 줄바꿈을 어림해 겹치지 않게 한다.
  const lineH = (l: ModalLine) => {
    const size = l.size ?? 17;
    const rows = l.text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length * size * 0.95 / textW)), 0);
    return rows * size * 1.5 + 8;
  };
  const titleRows = Math.max(1, Math.ceil(m.title.length * 28 * 0.95 / textW));
  const headH = titleRows * 40 + 12;
  // 카드가 있으면 본문은 카드 왼쪽 옆(textW 폭)에 제목 바로 아래부터 놓고, 버튼은 본문과 카드 중 더 아래쪽 밑에 둔다. 카드 없는 모달은 그대로.
  const cardBelow = m.card !== undefined ? Math.max(0, CARD_H + 8 - headH) : 0;
  const bodyH = Math.max(m.minBodyH ?? 0, m.lines.reduce((s, l) => s + lineH(l), 0), cardBelow);
  const h = PAD + headH + bodyH + 10 + m.buttons.length * (BTN_H + BTN_GAP) - BTN_GAP + PAD;
  const x = (DESIGN.width - W) / 2, y = Math.max(20, (DESIGN.height - h) / 2);
  const outer = panel(ui, x, y, W, h, 'wood');
  if (m.onTap) outer.setInteractive().on('pointerdown', m.onTap);
  label(ui, x + PAD, y + PAD, m.title, 28, m.titleColor ?? COLORS.text, textW, [0, 0], true);
  box(ui, x + PAD, y + PAD + headH - 8, textW, 1, COLORS.brassDim); // 제목 아래 황동 선(카드가 있으면 카드 왼쪽까지)
  if (m.card !== undefined) drawCardFace(ui, { x: x + W - PAD - cardW, y: y + PAD, w: cardW, h: CARD_H }, cardById(m.card));
  let cy = y + PAD + headH;
  for (const l of m.lines) { label(ui, x + PAD, cy, l.text, l.size ?? 17, l.color ?? COLORS.muted, textW, [0, 0], l.bold); cy += lineH(l); }
  cy = y + PAD + headH + bodyH + 10;
  for (const b of m.buttons) { button(ui, x + PAD, cy, W - PAD * 2, b.text, b.onTap, b.enabled ?? true, BTN_H, 20, b.fill); cy += BTN_H + BTN_GAP; }
}

/** 획득 패 큰 목록: 분류별로 한 줄(피는 여러 줄)에 크게 보여준다. 입력 가능한 안정된 상태에서만 연다. */
export function drawCapturedView(ui: UI, title: string, groups: { kind: string; cards: Card[]; note: string }[], onClose: () => void) {
  blocker(ui, DESIGN.width, DESIGN.height, 0.9);
  const cardH = 96, cardW = Math.round(cardH * CARD_ASPECT), gap = 6, innerW = W - PAD * 2;
  const perRow = Math.floor((innerW + gap) / (cardW + gap));
  const x = (DESIGN.width - W) / 2;
  const total = 44 + groups.reduce((s, g) => s + 24 + (g.cards.length ? Math.ceil(g.cards.length / perRow) * (cardH + gap) : 24) + 10, 0) + BTN_H + PAD * 2;
  const y0 = Math.max(16, (DESIGN.height - total) / 2);
  panel(ui, x, y0, W, Math.min(total, DESIGN.height - 32), 'wood');
  let y = y0 + PAD;
  label(ui, x + PAD, y, title, 26, COLORS.text, innerW, [0, 0], true); y += 44;
  for (const g of groups) {
    label(ui, x + PAD, y, `${g.kind}  ${g.note}`, 16, COLORS.gold, innerW, [0, 0], true); y += 24;
    if (g.cards.length === 0) { label(ui, x + PAD, y, '없음', 14, COLORS.muted); y += 24; continue; }
    g.cards.forEach((c, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      drawCardFace(ui, { x: x + PAD + col * (cardW + gap), y: y + row * (cardH + gap), w: cardW, h: cardH }, c);
    });
    y += Math.ceil(g.cards.length / perRow) * (cardH + gap) + 10;
  }
  button(ui, x + PAD, Math.min(y + 6, DESIGN.height - BTN_H - 24), innerW, '닫기', onClose, true, BTN_H);
}
