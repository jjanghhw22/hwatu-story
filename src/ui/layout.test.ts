import test from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_SAFE, CAPTURED_TAG_H, CARD, CARD_ASPECT, DESIGN, FLOOR_SLOTS, HAND_ARROW, HAND_MAIN_ROW, HAND_TOP_PAD, INFO, LAYOUT, REGIONS, SPEECH, activeBoxRect, capturedLayout, capturedOrder, capturedRects, configureLayout, fanDirection, floorLayout, flowChips, handLayout, miniStep, oppHandLayout, rotatedBounds, scoreBadgeRect, skillBarLayout, speechZone, tableInner, COUNT_ICON, FOCUS_BAR, MISSION_PANEL, SKILL_BAR, TABLE_H_NOMINAL, TABLE_MESSAGE, TEXT_MIN, bagPopupLayout, fitChipsOneRow, focusBarRect, suspicionBarRect, TABLE_MIN_H, skillRowsFor } from './layout.ts';
import { CARDS } from '../cards.ts';

// 다른 테스트는 모두 1280 기준 배치를 본다
configureLayout(1280);

type R = { x: number; y: number; w: number; h: number; angle?: number };
const inside = (r: R, a: R) => r.x >= a.x && r.y >= a.y && r.x + r.w <= a.x + a.w && r.y + r.h <= a.y + a.h;
const overlaps = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** 기울기를 포함한 경계 사각형끼리의 겹침. */
const overlapsRot = (a: R, b: R) => overlaps(rotatedBounds(a), rotatedBounds(b));

test('영역은 위에서 아래로 겹치지 않고 1280 안에 들어가며, 화투판은 460 이상이다', () => {
  const order = [REGIONS.topBar, REGIONS.oppInfo, REGIONS.oppCaptured, REGIONS.table, REGIONS.myInfo, REGIONS.skillBar, REGIONS.myCaptured, REGIONS.hand];
  for (let i = 1; i < order.length; i++) assert.ok(order[i].y >= order[i - 1].y + order[i - 1].h, `영역 ${i} 겹침`);
  assert.ok(REGIONS.hand.y + REGIONS.hand.h <= DESIGN.height, '손패 영역이 화면 안');
  assert.ok(!('skill' in REGIONS), '상시 안내 줄 없음');
  assert.ok(HAND_TOP_PAD >= HAND_ARROW.h + HAND_ARROW.bob, '윗줄 위 여백에 화살표(높이 + 왕복)가 들어간다');
  assert.ok(REGIONS.table.h >= 460, '화투판 높이 460 이상(2:3 카드로 손패가 낮아져 1280 기준 488)');
  assert.equal(REGIONS.oppCaptured.h, 84); assert.equal(REGIONS.myCaptured.h, 84);
  assert.ok(CARD.hand.w > CARD.floor.w && CARD.hand.h > CARD.floor.h, '손패는 바닥패보다 크다');
  assert.ok(CARD.floor.w > CARD.mini.w, '바닥패는 획득 패보다 크다');
  assert.ok(CARD.hand.h <= 196);
  assert.equal(CARD.mini.h, 64);
  for (const c of [CARD.hand, CARD.floor, CARD.mini, CARD.peek]) assert.ok(Math.abs(c.w / c.h - CARD_ASPECT) < 0.02, '카드 그림 비율 유지');
});

test('손패 10장은 아랫줄 6·윗줄 4, 모두 손패 영역 안에 원래 크기로 놓이고 아래 안전 여백을 지킨다', () => {
  const lay = handLayout(10);
  assert.equal(lay.length, 10);
  const rows = [...new Set(lay.map(r => r.y))].sort((a, b) => a - b);
  assert.equal(rows.length, 2);
  const upper = lay.filter(r => r.y === rows[0]), main = lay.filter(r => r.y === rows[1]);
  assert.equal(main.length, HAND_MAIN_ROW); assert.equal(upper.length, 4);
  assert.deepEqual(lay.slice(0, 6), main, '앞 6장이 아랫줄(주 줄)');
  assert.equal(upper[0].x, main[0].x, '윗줄은 아랫줄 첫 장과 왼쪽 정렬');
  assert.ok(upper[0].y + upper[0].h <= main[0].y, '두 줄이 겹치지 않음');
  const mainW = main[5].x + main[5].w - main[0].x;
  assert.equal(Math.round(main[0].x - (DESIGN.width - mainW - main[0].x)), 0, '아랫줄 가로 가운데 정렬');
  for (const r of lay) { assert.ok(inside(r, REGIONS.hand)); assert.deepEqual([r.w, r.h], [CARD.hand.w, CARD.hand.h]); assert.ok(r.y + r.h <= DESIGN.height - BOTTOM_SAFE); }
  // 윗줄 카드의 화살표(카드 위 above + 높이 + 왕복)가 위 패널(내 획득 패)에 들어가지 않는다
  const arrowTop = upper[0].y - HAND_ARROW.above - HAND_ARROW.h - HAND_ARROW.bob;
  assert.ok(arrowTop >= REGIONS.myCaptured.y + REGIONS.myCaptured.h, '윗줄 화살표가 위 패널과 겹치지 않음');
  for (let i = 0; i < lay.length; i++) for (let j = i + 1; j < lay.length; j++) assert.ok(!overlaps(lay[i], lay[j]), '손패끼리 겹치지 않음');
  // 6장 이하는 아랫줄만, 7장은 윗줄 1장, 12장(10장 + 기회 패 2)은 윗줄 6장
  assert.equal(new Set(handLayout(3).map(r => r.y)).size, 1); assert.equal(handLayout(3)[0].y, rows[1]);
  assert.equal(handLayout(7).filter(r => r.y === rows[0]).length, 1);
  const twelve = handLayout(12); assert.equal(twelve.filter(r => r.y === rows[0]).length, 6);
  for (const r of twelve) assert.ok(inside(r, REGIONS.hand));
  assert.deepEqual(handLayout(0), []);
});

test('바닥패 12자리: 같은 월은 겹친 묶음, 다른 월·더미와는 기울기를 포함해도 겹치지 않고 화투판 안에만 놓인다', () => {
  assert.equal(FLOOR_SLOTS.length, 12);
  for (const s of FLOOR_SLOTS) assert.ok(Math.abs(s.angle) <= 6, '자리 기울기 ±6° 이내');
  const area = tableInner();
  const cases: number[][] = [
    [], [1, 2, 3, 4, 5, 6, 7, 8], [1, 1, 2, 2, 3, 4, 5, 6], [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    Array.from({ length: 14 }, (_, i) => (i % 12) + 1), Array.from({ length: 22 }, (_, i) => (i % 12) + 1),
    Array.from({ length: 36 }, (_, i) => (i % 12) + 1), // 12월 모두 3장 묶음
  ];
  for (const months of cases) {
    const { cards, deck, drawOrder, scale } = floorLayout(months);
    assert.equal(cards.length, months.length);
    assert.deepEqual([...drawOrder].sort((a, b) => a - b), months.map((_, i) => i));
    assert.ok(inside(deck, area));
    cards.forEach((c, i) => {
      assert.ok(inside(rotatedBounds(c), area), `${months.length}장: 영역 밖`);
      assert.ok(!overlapsRot(c, deck), `${months.length}장: 더미와 겹침`);
      assert.ok(Math.abs(c.w / c.h - CARD.floor.w / CARD.floor.h) < 0.05, '비율 유지');
      assert.ok(Math.abs(c.angle ?? 0) <= 12, '묶음 기울기 최대 ±6° + 3°×2');
      cards.forEach((d, j) => {
        if (j <= i) return;
        if (months[i] === months[j]) assert.ok(overlaps(c, d), '같은 월은 묶음으로 겹침');
        else assert.ok(!overlapsRot(c, d), `${months.length}장: 다른 월끼리 겹침(${months[i]}월·${months[j]}월)`);
      });
    });
    assert.ok(scale <= 1 && scale > 0);
    assert.ok(cards.every(c => c.h <= 130), '바닥 카드 높이 상한 130');
  }
  // 크기는 장수와 무관하게 일정(자리는 3장 묶음까지 미리 확보)
  assert.equal(floorLayout([1, 2, 3, 4, 5, 6, 7, 8]).scale, floorLayout(Array.from({ length: 36 }, (_, i) => (i % 12) + 1)).scale);
  assert.ok(floorLayout([1]).cards[0].h >= 100, '바닥 카드가 지나치게 작아지지 않음');
  // 같은 월 묶음은 장마다 +3°
  const st = floorLayout([1, 1, 1]);
  assert.equal((st.cards[1].angle ?? 0) - (st.cards[0].angle ?? 0), 3);
  assert.equal((st.cards[2].angle ?? 0) - (st.cards[1].angle ?? 0), 3);
});

test('선택 단계: 고를 월의 묶음은 펼쳐져 서로 겹치지 않고, 맨 위에 그려지며, 오른쪽 자리는 왼쪽으로 펼친다', () => {
  const months = [1, 2, 2, 3, 4, 5, 6, 7];
  const { cards, drawOrder } = floorLayout(months, 2);
  assert.ok(!overlapsRot(cards[1], cards[2]), '펼친 두 장은 겹치지 않음');
  assert.equal(cards[1].y, cards[2].y);
  assert.deepEqual(drawOrder.slice(-2).sort(), [1, 2]);
  const area = tableInner();
  for (const c of cards) assert.ok(inside(rotatedBounds(c), area));
  // 12월 모두 있을 때 어느 월을 펼쳐도 영역 안
  const full = Array.from({ length: 24 }, (_, i) => (i % 12) + 1);
  for (let m = 1; m <= 12; m++) for (const c of floorLayout(full, m).cards) assert.ok(inside(rotatedBounds(c), area), `${m}월 펼침이 영역 밖`);
  // 펼침 방향은 빈 쪽: 같은 줄 이웃 자리(더미 포함)까지의 거리가 오른쪽이 더 가까우면 왼쪽으로
  assert.equal(fanDirection(7), -1, '바깥 오른쪽 자리는 왼쪽으로');
  assert.equal(fanDirection(6), 1, '바깥 왼쪽 자리는 오른쪽으로');
  // 8장 이하: 펼친 두 장이 다른 월 카드·더미와 겹치지 않고(가로로 막히면 위쪽으로), 회전 0
  for (let n = 2; n <= 8; n++) {
    for (let dupSlot = 0; dupSlot < n - 1; dupSlot++) {
      const months = Array.from({ length: n - 1 }, (_, i) => i + 1);
      months.push(dupSlot + 1); // dupSlot번째 자리의 월이 두 장
      const lay = floorLayout(months, dupSlot + 1);
      const fanIdx = months.map((m, i) => (m === dupSlot + 1 ? i : -1)).filter(i => i >= 0);
      assert.equal(fanIdx.length, 2);
      for (const fi of fanIdx) {
        const f = lay.cards[fi];
        assert.equal(f.angle, 0, '펼친 장은 회전 0');
        assert.ok(!overlaps(f, rotatedBounds(lay.deck)), `${n}장 자리 ${dupSlot}: 펼친 장이 더미와 겹침`);
        lay.cards.forEach((o, oi) => { if (!fanIdx.includes(oi)) assert.ok(!overlaps(f, rotatedBounds(o)), `${n}장 자리 ${dupSlot}: 펼친 장이 ${months[oi]}월과 겹침`); });
        assert.ok(inside(f, area));
      }
      // 펼친 두 장끼리: 가로 펼침이면 겹치지 않고, 위쪽 펼침이면 높이의 절반 이상 어긋나 각 장을 고를 수 있다
      const a = lay.cards[fanIdx[0]], b = lay.cards[fanIdx[1]];
      assert.ok(!overlaps(a, b) || Math.abs(a.y - b.y) >= a.h * 0.5, '펼친 두 장이 구분된다');
    }
  }
});

test('바닥패 자리는 안쪽 고리부터 채우고, 턴이 지나도 기존 묶음은 같은 자리에 남는다', () => {
  const a = floorLayout([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const m of [1, 2, 3, 4, 5, 6]) assert.ok(a.slots.get(m)! < 6, '처음 6월은 안쪽 고리');
  // 3월이 나가고 9월이 들어와도 나머지 월의 위치는 그대로
  const months2 = [1, 2, 4, 5, 6, 7, 8, 9];
  const b = floorLayout(months2, undefined, a.slots);
  for (const m of [1, 2, 4, 5, 6, 7, 8]) assert.equal(b.slots.get(m), a.slots.get(m), `${m}월 자리 유지`);
  assert.equal(b.slots.get(9), a.slots.get(3), '빈 자리를 새 월이 받음');
  assert.ok(!b.slots.has(3));
  assert.deepEqual([a.cards[0].x, a.cards[0].y, a.cards[0].angle], [b.cards[0].x, b.cards[0].y, b.cards[0].angle]); // 1월 카드 위치·기울기 그대로
  // 같은 월에 한 장이 더 쌓여도 자리는 그대로
  const c = floorLayout([1, 1, 2, 4, 5, 6, 7, 8, 9], undefined, b.slots);
  assert.equal(c.slots.get(1), b.slots.get(1));
  assert.deepEqual([c.cards[0].x, c.cards[0].y], [b.cards[0].x, b.cards[0].y]);
});

test('획득 패: 한 줄 4묶음이 패널 안에 있고, 최대 장수(광 5·열끗 9·띠 10·피 24)까지 겹쳐도 묶음 밖으로 넘치지 않으며 크기는 줄이지 않는다', () => {
  const reg = REGIONS.myCaptured;
  const cells = capturedLayout(reg);
  assert.deepEqual(cells.map(c => c.kind), ['광', '열끗', '띠', '피']);
  assert.equal(new Set(cells.map(c => c.y)).size, 1, '한 줄');
  for (let i = 1; i < cells.length; i++) assert.ok(cells[i].x >= cells[i - 1].x + cells[i - 1].w + 12, '묶음 사이 간격 12');
  for (const c of cells) { assert.ok(inside(c, { x: 0, y: reg.y, w: DESIGN.width, h: reg.h })); assert.ok(c.h >= CAPTURED_TAG_H + CARD.mini.h, '글자 줄과 카드 더미가 들어감'); }
  const { w, step } = CARD.mini;
  const by = (k: string) => CARDS.filter(c => c.kind === k);
  const full = { 광: by('광'), 열끗: by('열끗'), 띠: by('띠'), 피: by('피') };
  assert.deepEqual([full.광.length, full.열끗.length, full.띠.length, full.피.length], [5, 9, 10, 24]);
  const lay = capturedRects(reg, full);
  assert.equal(lay.rects.size, 48);
  for (const cell of lay.cells) for (const c of full[cell.kind]) { const r = lay.rects.get(c.id)!; assert.ok(inside(r, cell), `${cell.kind} ${c.id} 묶음 밖`); assert.deepEqual([r.w, r.h], [w, CARD.mini.h], '크기 유지'); }
  // 비낌 간격: 기본 14, 모자라면 줄이되 최소 4
  const few = capturedRects(reg, { 광: full.광, 열끗: [], 띠: [], 피: [] });
  assert.equal(few.rects.get(full.광[1].id)!.x - few.rects.get(full.광[0].id)!.x, step);
  const pi = full.피.map(c => lay.rects.get(c.id)!.x).sort((a, b) => a - b);
  assert.ok(pi[1] - pi[0] >= 4 && pi[1] - pi[0] < step);
  // 양쪽 패널이 같은 기준: 세로 위치만 다르다
  const opp = capturedRects(REGIONS.oppCaptured, full);
  for (const [id, r] of lay.rects) assert.equal(r.x, opp.rects.get(id)!.x);
  assert.equal(miniStep(1, 100, w, step), step);
  assert.equal(miniStep(24, 100, w, step), 4);
});

test('획득 패 정렬: 열끗은 고도리 먼저, 띠는 홍단·청단·초단·비띠 순, 피는 쌍피 먼저, 같은 입력은 같은 순서', () => {
  const yeol = capturedOrder('열끗', CARDS.filter(c => c.kind === '열끗'));
  assert.deepEqual(yeol.slice(0, 3).map(c => c.godori), [true, true, true]);
  const tti = capturedOrder('띠', CARDS.filter(c => c.kind === '띠')).map(c => c.band);
  assert.deepEqual(tti, ['홍단', '홍단', '홍단', '청단', '청단', '청단', '초단', '초단', '초단', '비띠']);
  const pi = capturedOrder('피', CARDS.filter(c => c.kind === '피'));
  assert.ok(pi[0].ssangpi && pi[1].ssangpi && !pi[2].ssangpi);
  assert.deepEqual(capturedOrder('광', [CARDS[28], CARDS[0]]).map(c => c.id), [0, 28]);
  // 한 장이 추가돼도 기존 카드의 상대 순서는 유지된다(불필요한 이동 없음)
  const a = capturedRects(REGIONS.myCaptured, { 광: [], 열끗: [CARDS[4], CARDS[16]], 띠: [], 피: [] });
  const b = capturedRects(REGIONS.myCaptured, { 광: [], 열끗: [CARDS[4], CARDS[16], CARDS[12]], 띠: [], 피: [] });
  assert.ok(b.rects.get(12)!.x < b.rects.get(16)!.x, '새 고도리 패는 고도리 묶음 쪽에 들어간다');
  assert.equal(a.rects.get(4)!.x, b.rects.get(4)!.x, '맨 앞 카드는 움직이지 않는다');
});

test('상대 손패 뒷면·점수 배지·말풍선 자리·차례 상자는 각 영역 안에서 서로 겹치지 않는다', () => {
  const reg = REGIONS.oppInfo;
  const badge = scoreBadgeRect(reg, true), zone = speechZone(), act = activeBoxRect(reg, true);
  assert.ok(inside(badge, reg) && inside(zone, reg) && inside(act, reg));
  assert.ok(!overlaps(badge, zone), '말풍선 자리는 점수 배지 왼쪽');
  assert.ok(zone.x + zone.w <= badge.x - SPEECH.gapToBadge, '말풍선 오른쪽 경계는 점수 배지 왼쪽 − 12');
  assert.ok(zone.y + SPEECH.maxH <= reg.y + reg.h - 3, '두 줄 말풍선(최대 52)도 패널 안');
  assert.ok(zone.x >= INFO.split, '말풍선 자리는 왼쪽 구역(이름·칩) 오른쪽');
  for (const badgeShown of [true, false]) {
    const rects = oppHandLayout(reg, 10, badgeShown);
    assert.equal(rects.length, 10);
    for (const r of rects) { assert.ok(inside(r, reg)); assert.ok(!overlaps(r, badge), '손패 뒷면은 점수 배지 아래'); assert.ok(!overlaps(r, zone)); assert.ok(!overlaps(r, act)); }
    assert.ok(rects[9].x + rects[9].w <= DESIGN.width - 20 - 12);
  }
  assert.deepEqual(oppHandLayout(reg, 0, true), []);
  assert.ok(reg.h <= DESIGN.height * 0.15, '상대 영역은 화면 높이의 15% 이내');
  // 내 패널: 차례 상자는 점수 배지 왼쪽, 아이콘 열(x 340, 3개)과 겹치지 않는다. 집중·의심 줄은 아이콘 열 왼쪽에서 끝난다
  const my = REGIONS.myInfo, mb = scoreBadgeRect(my, false), ma = activeBoxRect(my, false);
  const iconsEnd = COUNT_ICON.myX + COUNT_ICON.d * 3 + COUNT_ICON.gap * 2;
  assert.ok(ma.x + ma.w < mb.x && iconsEnd < ma.x, '아이콘 열 → 차례 상자 → 점수 배지');
  for (const r of [mb, ma]) assert.ok(inside(r, my));
  const fb = focusBarRect(my), sr = suspicionBarRect(my);
  assert.ok(fb.x + fb.w + 6 + FOCUS_BAR.labelW <= COUNT_ICON.myX, '집중 라벨이 아이콘 열 앞에서 끝남');
  assert.ok(sr.y > fb.y && sr.y + TEXT_MIN / 2 + sr.h / 2 <= my.y + my.h, '의심 줄이 패널 안');
  // 기술 줄: 버튼 최대 5개 + 가방, 겹치지 않고 줄 안에. 공개 패 자리가 없으면 화투판 구석으로
  for (let n = 0; n <= 5; n++) {
    const sb = skillBarLayout(REGIONS.skillBar, n);
    assert.equal(sb.buttons.length, n);
    for (const b of sb.buttons) { assert.ok(b.w <= 140 && b.w >= 96 && b.h >= 44); assert.ok(inside(b, REGIONS.skillBar)); assert.ok(b.x + b.w < sb.bag.x, '기술 버튼이 가방 버튼과 겹치지 않음'); }
    for (let i = 1; i < sb.buttons.length; i++) assert.ok(sb.buttons[i - 1].x + sb.buttons[i - 1].w < sb.buttons[i].x);
    assert.ok(inside(sb.bag, REGIONS.skillBar) && inside(sb.preview, sb.previewInBar ? REGIONS.skillBar : REGIONS.table) && inside(sb.preview2, sb.previewInBar ? REGIONS.skillBar : REGIONS.table));
  }
  assert.equal(skillBarLayout(REGIONS.skillBar, 9).buttons.length, 5, '최대 5개');
  // 가방 팝업: 기술 줄 바로 위, 화면 안, 항목끼리 겹치지 않음
  const pop = bagPopupLayout(REGIONS.skillBar, 3);
  assert.ok(pop.panel.y + pop.panel.h <= REGIONS.skillBar.y && pop.panel.x >= 0 && pop.panel.x + pop.panel.w <= DESIGN.width);
  for (const it of pop.items) assert.ok(inside(it, pop.panel));
});

test('대결 화면 글자 최소 18(휴대폰 9pt): 기술 줄·정보 패널·차례 상자·메시지·미션·아이콘 라벨', () => {
  assert.equal(TEXT_MIN, 18);
  for (const [name, v] of [['기술 이름', SKILL_BAR.textSize], ['칩', INFO.chip.size], ['이름', INFO.nameSize], ['차례 상자', INFO.activeBox.size], ['집중·의심 라벨', FOCUS_BAR.labelSize], ['고·흔·폭 아이콘', COUNT_ICON.size], ['화투판 메시지', TABLE_MESSAGE.size]] as const) assert.ok(v >= TEXT_MIN, `${name} ${v}`);
  assert.ok(INFO.chip.h >= TEXT_MIN + 4 && COUNT_ICON.d >= TEXT_MIN * 2, '글자가 칩·아이콘 안에 들어감');
  assert.ok(MISSION_PANEL.titleH >= TEXT_MIN);
  assert.ok(SKILL_BAR.badgeSize >= 14, '비용·횟수 배지는 요청대로 14');
});

test('긴 화면: configureLayout이 높이·안전 여백에 따라 영역을 다시 계산하고 1280에서는 기존 값과 같다', () => {
  const snapshot = JSON.stringify(REGIONS);
  const regionsInOrder = () => [REGIONS.topBar, REGIONS.oppInfo, REGIONS.oppCaptured, REGIONS.table, REGIONS.myInfo, REGIONS.skillBar, REGIONS.myCaptured, REGIONS.hand];
  const panelSizes = () => [REGIONS.oppInfo.h, REGIONS.oppCaptured.h, REGIONS.myInfo.h, REGIONS.myCaptured.h, CARD.hand.w, CARD.hand.h, CARD.mini.h];
  const base = panelSizes();
  try {
    // 1280: 기존 값 그대로
    configureLayout(1280);
    assert.equal(JSON.stringify(REGIONS), snapshot);
    assert.equal(DESIGN.height, 1280); assert.equal(REGIONS.table.h, TABLE_H_NOMINAL); assert.equal(REGIONS.hand.y, 908); assert.equal(LAYOUT.handTopPad, HAND_TOP_PAD + 4);
    // 1600: 겹치지 않고 1600 안. 늘어난 320의 70%(224)를 화투판에, 30%(96)는 손패 위 여백에. 화투판 기준(488) 초과분 4도 여백으로
    configureLayout(1600);
    assert.equal(DESIGN.height, 1600);
    const o = regionsInOrder();
    for (let i = 1; i < o.length; i++) assert.ok(o[i].y >= o[i - 1].y + o[i - 1].h, `1600: 영역 ${i} 겹침`);
    assert.equal(REGIONS.hand.y + REGIONS.hand.h, 1600);
    assert.equal(REGIONS.table.h, TABLE_H_NOMINAL + 224); assert.equal(LAYOUT.handTopPad, HAND_TOP_PAD + 96 + 4);
    assert.deepEqual(panelSizes(), base, '패널·카드 크기는 높이와 무관');
    for (const r of handLayout(12)) assert.ok(inside(r, REGIONS.hand));
    // 1600에서도 바닥 12자리(3장 묶음 포함)가 영역 안에서 겹치지 않고 카드 크기는 1280과 같다(세로 간격만 넓어짐)
    const area = tableInner();
    const full = Array.from({ length: 36 }, (_, i) => (i % 12) + 1);
    const tall = floorLayout(full);
    assert.ok(inside(rotatedBounds(tall.deck), area));
    tall.cards.forEach((c, i) => {
      assert.ok(inside(rotatedBounds(c), area), '1600: 바닥패 영역 밖');
      assert.ok(!overlapsRot(c, tall.deck));
      tall.cards.forEach((d, j) => { if (j > i && full[i] !== full[j]) assert.ok(!overlapsRot(c, d), '1600: 다른 월 겹침'); });
    });
    configureLayout(1280);
    const flat = floorLayout(full);
    // 2:3 카드는 1280(판 488)·1600 모두 폭에 묶여 75×113으로 같다. 차이는 2px 이내
    assert.ok(tall.cards[0].w >= flat.cards[0].w && tall.cards[0].h - flat.cards[0].h <= 2 && flat.cards[0].h >= 110, '카드 크기 차이 2px 이내');
    assert.ok(Math.abs(tall.cards[2].y - tall.cards[0].y) > Math.abs(flat.cards[2].y - flat.cards[0].y), '세로 간격이 넓어짐');
    // 1560 + 안전 여백(위 40, 아래 30): 상단 띠는 40 아래부터, 손패 아래 여백 ≥ 50
    configureLayout(1560, { top: 40, bottom: 30 });
    assert.ok(REGIONS.topBar.y >= 40);
    const lay = handLayout(10);
    const bottom = Math.max(...lay.map(r => r.y + r.h));
    assert.ok(DESIGN.height - bottom >= 50, '손패 아래 여백 ≥ 50');
    assert.equal(REGIONS.hand.y + REGIONS.hand.h, 1560);
    assert.deepEqual(panelSizes(), base);
    const o2 = regionsInOrder();
    for (let i = 1; i < o2.length; i++) assert.ok(o2[i].y >= o2[i - 1].y + o2[i - 1].h, `1560: 영역 ${i} 겹침`);
    // 1440: 배분 공식(160의 70% → 화투판 112, 30% 48 + 기준 초과분 4 → 여백 52)
    configureLayout(1440);
    assert.equal(REGIONS.table.h, 600); assert.equal(LAYOUT.handTopPad, 76); assert.equal(REGIONS.hand.y, 1440 - (76 + CARD.hand.h * 2 + 10 + BOTTOM_SAFE));
  } finally {
    configureLayout(1280);
  }
  assert.equal(JSON.stringify(REGIONS), snapshot, '되돌린 뒤 기존 값');
});

test('상태 칩 흐름 배치: 왼쪽부터 놓고 최대 x를 넘으면 다음 줄로', () => {
  const rects = flowChips([30, 40, 50], 100, 10, 220); // 44·54·64 폭: 셋째가 220을 넘어 다음 줄
  assert.deepEqual(rects.map(r => r.y), [10, 10, 10 + INFO.chip.h + INFO.chip.rowGap]);
  assert.equal(rects[0].w, 44); assert.equal(rects[0].h, INFO.chip.h);
  assert.equal(rects[1].x, 100 + 44 + 6);
  assert.equal(rects[2].x, 100);
  assert.equal(flowChips([30, 40], 150, 0, 300, 100)[1].x, 150 + 44 + 6);
  assert.deepEqual(flowChips([], 0, 0, 100), []);
});

test('요청 12-5: 칩 6개(고·흔·폭 아이콘 + 뒤집기·국진·뻑 칩) 상태에서 칩은 내 정보 패널 안 한 줄에만 놓여 기술 줄과 겹치지 않는다', () => {
  // 고·흔·폭은 아이콘(패널 안 고정 자리), 나머지가 칩으로 아이콘 아랫줄에 온다(panels.drawPlayerInfo와 같은 자리 계산)
  const my = REGIONS.myInfo, act = activeBoxRect(my, false);
  const x0 = COUNT_ICON.myX, y0 = my.y + 4 + COUNT_ICON.d + 3, maxX = act.x - 6;
  const chips = [
    { text: '뒤집기 2', short: '뒤집기2' },
    { text: '국진→쌍피', short: '국→쌍' },
    { text: '뻑 2', short: '뻑2' },
  ];
  for (const perChar of [4, 7, 10, 18, 30]) { // 글자 폭이 어떻든 한 줄·패널 안은 지켜진다
    const fit = fitChipsOneRow(chips, t => t.length * perChar, x0, y0, maxX);
    assert.ok(fit.rects.length >= 1);
    assert.equal(new Set(fit.rects.map(r => r.y)).size, 1, '한 줄');
    for (const r of fit.rects) {
      assert.ok(r.y >= my.y && r.y + r.h <= my.y + my.h, '내 정보 패널 안');
      assert.ok(r.y + r.h <= REGIONS.skillBar.y, '기술 줄과 겹치지 않음');
      assert.ok(r.x + r.w <= maxX, '차례 상자 앞에서 끝남');
    }
  }
  // 다 들어가면 원래 글자 그대로
  const slim = fitChipsOneRow(chips, t => t.length * 4, x0, y0, maxX);
  assert.deepEqual(slim.texts, chips.map(c => c.text)); assert.equal(slim.kept, 3);
  // 원래 글자가 넘치면 전부 줄임말로
  const mid = fitChipsOneRow(chips, t => t.length * 7, x0, y0, maxX);
  assert.deepEqual(mid.texts, chips.map(c => c.short)); assert.equal(mid.kept, 3);
  // 줄임말도 넘치면 뒤 칩을 "+N" 하나로 묶는다
  const squeezed = fitChipsOneRow(chips, t => t.length * 18, x0, y0, maxX);
  assert.ok(squeezed.kept < 3);
  assert.ok(squeezed.texts[squeezed.texts.length - 1] === `+${3 - squeezed.kept}`, '마지막 칩은 +N');
  assert.deepEqual(squeezed.texts.slice(0, -1), chips.slice(0, squeezed.kept).map(c => c.short));
  assert.deepEqual(fitChipsOneRow([], t => t.length, x0, y0, maxX).rects, []);
});

test('기술 8개 + 가방: 두 줄(윗줄 4 · 아랫줄 4 + 가방)이 모두 화면 안, 서로 겹치지 않음. 1280 화투판 ≥ 440, 획득 패는 패널 안', () => {
  try {
    for (const h of [1280, 1440, 1600]) {
      configureLayout(h, { top: 0, bottom: 0 }, skillRowsFor(8));
      const reg = REGIONS.skillBar, sb = skillBarLayout(reg, 8);
      assert.equal(sb.buttons.length, 8);
      const all = [...sb.buttons, sb.bag];
      for (const r of all) { assert.ok(inside(r, reg), `${h}: 기술 줄 밖`); assert.ok(r.x >= 0 && r.x + r.w <= DESIGN.width); }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlaps(all[i], all[j]), `${h}: ${i}·${j} 겹침`);
      assert.ok(sb.bag.y > sb.buttons[0].y, '가방은 아랫줄');
      assert.ok(REGIONS.table.h >= TABLE_MIN_H, `${h}: 화투판 ${REGIONS.table.h}`);
      const o = [REGIONS.topBar, REGIONS.oppInfo, REGIONS.oppCaptured, REGIONS.table, REGIONS.myInfo, REGIONS.skillBar, REGIONS.myCaptured, REGIONS.hand];
      for (let i = 1; i < o.length; i++) assert.ok(o[i].y >= o[i - 1].y + o[i - 1].h);
      assert.equal(REGIONS.hand.y + REGIONS.hand.h, h);
      const by = (k: string) => CARDS.filter(c => c.kind === k);
      const lay = capturedRects(REGIONS.myCaptured, { 광: by('광'), 열끗: by('열끗'), 띠: by('띠'), 피: by('피') });
      for (const cell of lay.cells) for (const c of by(cell.kind)) assert.ok(inside(lay.rects.get(c.id)!, cell), `${h}: 획득 패 밖`);
    }
    assert.equal(skillRowsFor(5), 1); assert.equal(skillRowsFor(6), 2);
  } finally { configureLayout(1280); }
  assert.equal(REGIONS.skillBar.h, 52, '한 줄로 돌아온다');
});
