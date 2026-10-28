// 개발용 카드 목록: 48장 그림과 카드 데이터(월·이름·분류)를 나란히 보여 연결을 눈으로 확인한다.
import { CARDS, kindLabel } from '../cards';
import { missingCardTextures } from './cardAssets';
import { drawCardFace } from './cardView';
import { CARD_ASPECT, DESIGN } from './layout';
import { COLORS, type UI, blocker, button, label } from './widgets';

const COLS = 8, CARD_H = 114, LABEL_H = 34, GAP = 10;

export function drawGallery(ui: UI, onClose: () => void) {
  blocker(ui, DESIGN.width, DESIGN.height, 0.97);
  const cardW = Math.round(CARD_H * CARD_ASPECT);
  const gridW = COLS * cardW + (COLS - 1) * GAP;
  const x0 = (DESIGN.width - gridW) / 2;
  label(ui, x0, 18, '카드 목록 (개발용) · 그림과 카드 데이터 연결 확인', 20, COLORS.gold);
  const missing = missingCardTextures(ui.scene.textures);
  label(ui, x0, 46, missing.length ? `그림이 없는 카드 id: ${missing.join(', ')}` : '48장 모두 그림이 연결되어 있습니다. 한 줄에 두 달씩, 월 순서대로 표시합니다.', 13, missing.length ? COLORS.danger : COLORS.muted);
  CARDS.forEach(c => {
    const col = c.id % COLS, row = Math.floor(c.id / COLS);
    const x = x0 + col * (cardW + GAP), y = 72 + row * (CARD_H + LABEL_H + GAP);
    drawCardFace(ui, { x, y, w: cardW, h: CARD_H }, c);
    label(ui, x + cardW / 2, y + CARD_H + 4, `#${c.id} ${c.month}월 ${c.name}`, 11, COLORS.text, cardW + GAP, [0.5, 0]);
    label(ui, x + cardW / 2, y + CARD_H + 18, `${c.title} · ${kindLabel(c)}`, 11, COLORS.gold, cardW + GAP, [0.5, 0]);
  });
  const rows = Math.ceil(CARDS.length / COLS);
  button(ui, x0, 72 + rows * (CARD_H + LABEL_H + GAP) + 8, gridW, '닫기', onClose);
}
