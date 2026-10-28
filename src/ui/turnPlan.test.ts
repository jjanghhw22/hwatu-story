import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, cardById } from '../cards.ts';
import { GameState } from '../game.ts';
import { captureKind, plannedCapture } from './turnPlan.ts';

test('plannedCapture는 place()가 실제로 가져가는 카드와 항상 같다', () => {
  // 0장·1장·2장(지정/미지정)·3장 일치 사례
  const cases: { table: number[]; card: number; target?: number }[] = [
    { table: [4, 8], card: 0 },                 // 일치 없음
    { table: [1, 8], card: 0 },                 // 1장
    { table: [1, 2, 8], card: 0, target: 2 },   // 2장 중 지정
    { table: [1, 2, 8], card: 0 },              // 2장 중 미지정 → 첫 장
    { table: [1, 2, 3, 8], card: 0 },           // 3장 → 전부
  ];
  for (const c of cases) {
    const s = new GameState();
    s.table = c.table.map(cardById);
    const card = cardById(c.card);
    const plan = plannedCapture(s, card, c.target);
    s.place(0, card, c.target);
    const got = s.captured[0].filter(x => x.id !== card.id).map(x => x.id).sort();
    assert.deepEqual(plan.map(x => x.id).sort(), got, JSON.stringify(c));
    if (plan.length === 0) assert.ok(s.table.some(x => x.id === card.id), '일치 없으면 바닥에 놓임');
  }
});

test('captureKind: 국진은 쌍피 선택 시에만 피 칸, 나머지는 분류 그대로', () => {
  const 국진 = CARDS.find(c => c.gukjin)!;
  assert.equal(captureKind(국진, {}), '열끗');
  assert.equal(captureKind(국진, { gukjinAsPi: true }), '피');
  assert.equal(captureKind(cardById(0), { gukjinAsPi: true }), '광');
  assert.equal(captureKind(cardById(1), {}), '띠');
});

import { actionForTap, handDisplay } from './turnPlan.ts';
const mkState = (h0: number[], table: number[], chances: [number, number] = [0, 0]) => {
  const used = new Set([...h0, ...table]);
  return new GameState({ hands: [h0, []], table, deck: CARDS.filter(c => !used.has(c.id)).map(c => c.id), flipChances: chances });
};
test('손패 카드 누르기: 폭탄 가능한 월의 세 장은 어느 장을 눌러도 같은 폭탄, 일반 패는 한 장 내기, 불가 조건은 일반', () => {
  const s = mkState([0, 1, 2, 20, 24], [3]);
  for (const i of [0, 1, 2]) assert.deepEqual(actionForTap(s, 0, i), { kind: 'bomb', month: 1 });
  assert.deepEqual(actionForTap(s, 0, 3), { kind: 'normal', index: 3 });
  assert.deepEqual(actionForTap(mkState([0, 1, 2, 3, 20], []), 0, 0), { kind: 'normal', index: 0 });   // 같은 월 4장
  assert.deepEqual(actionForTap(mkState([0, 1, 2, 20], []), 0, 0), { kind: 'normal', index: 0, shakeMonth: 1 }); // 바닥 0장 → 폭탄 아님, 자동 흔들기
  assert.deepEqual(actionForTap(mkState([0, 1, 2, 20], [3, 4]), 0, 0), { kind: 'bomb', month: 1 });    // 바닥 1장(다른 월 무관)
  assert.deepEqual(actionForTap(mkState([0, 1, 20], [2, 3]), 0, 0), { kind: 'normal', index: 0 });     // 손패 2장
  assert.throws(() => actionForTap(s, 0, 9), RangeError);
  // 같은 폭탄을 두 번 적용할 수 없다(연속 클릭 방지의 규칙 계층 보강)
  const b = mkState([0, 1, 2, 20], [3]); const plan = b.planBomb(0, 1); b.applyTurn(plan);
  assert.throws(() => b.applyTurn(plan), /이미 적용/); assert.equal(b.flipChances[0], 2);
});
test('손패 표시: 월순 정렬 뒤에 기회 패를 남은 기회만큼 붙이고, 기회 패는 카드 데이터에 없다', () => {
  const s = mkState([24, 0, 20, 2], [3], [2, 0]);
  const d = handDisplay(s, 0);
  assert.deepEqual(d.map(x => x.kind), ['card', 'card', 'card', 'card', 'chance', 'chance']);
  assert.deepEqual(d.filter(x => x.kind === 'card').map(x => (x as { card: { id: number } }).card.id), [0, 2, 20, 24]);
  assert.deepEqual(d.filter(x => x.kind === 'card').map(x => (x as { index: number }).index), [1, 3, 2, 0]); // 원래 손패 index 보존
  assert.equal(s.allCardIds().length, 48);
  // 폭탄 → 기회 2장, 기회 패 사용 → 1장, 일반 손패는 유지
  const b = mkState([0, 1, 2, 20], [3]);
  assert.equal(handDisplay(b, 0).filter(x => x.kind === 'chance').length, 0);
  b.applyTurn(b.planBomb(0, 1));
  assert.equal(handDisplay(b, 0).filter(x => x.kind === 'chance').length, 2);
  b.turn += 1; // 상대 차례를 건너뛴 것으로 가정
  const before = b.hands[0].map(c => c.id), deck = b.deck.length;
  b.applyTurn(b.planFlip(0));
  assert.equal(handDisplay(b, 0).filter(x => x.kind === 'chance').length, 1);
  assert.deepEqual(b.hands[0].map(c => c.id), before); assert.equal(b.deck.length, deck - 1); assert.equal(b.allCardIds().length, 48);
  // 손패 0장이어도 기회 패만 남아 진행 가능, 여러 폭탄 기회 누적
  const e = mkState([], [], [3, 0]);
  assert.deepEqual(handDisplay(e, 0).map(x => x.kind), ['chance', 'chance', 'chance']); assert.equal(e.canFlipOnly(0), true);
  const n = new GameState(); assert.equal(handDisplay(n, 0).filter(x => x.kind === 'chance').length, 0);
});

test('클릭 통합: 흔들기 가능한 세 장은 어느 장을 눌러도 자동 흔들기 뒤 그 장만 내기, 이미 흔든 월은 일반, 폭탄 우선, 4장은 일반', () => {
  const s = mkState([0, 1, 2, 20, 24], []); // 1월 세 장, 바닥에 1월 없음 → 흔들기
  for (const i of [0, 1, 2]) assert.deepEqual(actionForTap(s, 0, i), { kind: 'normal', index: i, shakeMonth: 1 });
  assert.deepEqual(actionForTap(s, 0, 3), { kind: 'normal', index: 3 });
  // 화면 흐름 재현: 선언(공개) → 그 뒤 일반 턴 계획 → 적용 성공, 손패는 한 장만 줄고 선언 기록은 1월
  const a = actionForTap(s, 0, 1) as { kind: 'normal'; index: number; shakeMonth: number };
  const stale = s.planTurn(0, s.hands[0][a.index]); // 선언 전에 만든 계획은 무효가 되어야 함
  s.declareShake(0, a.shakeMonth);
  assert.throws(() => s.applyTurn(stale), /상태가 바뀌었습니다/);
  const plan = s.planTurn(0, s.hands[0][a.index]); s.applyTurn(plan);
  assert.equal(s.hands[0].length, 4); assert.deepEqual(s.shakes[0], [1]); assert.equal(s.turn, 1); assert.equal(s.allCardIds().length, 48);
  // 이미 흔든 월: 남은 1월 두 장은 일반 내기(shakeMonth 없음)
  s.turn += 1; // 상대 차례 건너뜀
  const rest = s.hands[0].map((c, i) => [c.month, i] as const).filter(([mo]) => mo === 1).map(([, i]) => i);
  for (const i of rest) assert.deepEqual(actionForTap(s, 0, i), { kind: 'normal', index: i });
  // 폭탄 우선: 바닥에 1월이 한 장 있으면 흔들기가 아니라 폭탄
  const b = mkState([0, 1, 2, 20], [3]); assert.deepEqual(actionForTap(b, 0, 2), { kind: 'bomb', month: 1 });
  // 같은 월 4장: 흔들기·폭탄 모두 아님
  const f = mkState([0, 1, 2, 3, 20], []); for (const i of [0, 1, 2, 3]) assert.deepEqual(actionForTap(f, 0, i), { kind: 'normal', index: i });
  // 이미 흔든 월은 다시 선언하지 않음(두 번째 클릭이 와도 일반)
  const r = mkState([0, 1, 2, 20], []); r.declareShake(0, 1); assert.deepEqual(actionForTap(r, 0, 0), { kind: 'normal', index: 0 });
});

import { bonusCards, nearBonuses, newBonuses } from './turnPlan.ts';
import { scoreCaptured } from '../score.ts';
test('새로 완성된 족보만 돌려주고(삼광→사광은 새 단계만), 보유 중인 족보는 반복하지 않는다', () => {
  const 광 = CARDS.filter(c => c.kind === '광' && !c.rainGwang), 고도리 = CARDS.filter(c => c.godori);
  const before = scoreCaptured([...광.slice(0, 2), ...고도리.slice(0, 2)]);
  const after = scoreCaptured([...광.slice(0, 3), ...고도리]);
  assert.deepEqual(newBonuses(before, after), ['삼광', '고도리']);
  assert.deepEqual(newBonuses(after, after), []);
  const four = scoreCaptured([...광.slice(0, 4), ...고도리]);
  assert.deepEqual(newBonuses(after, four), ['사광']);
  assert.deepEqual(bonusCards(after, '고도리').map(c => c.id), 고도리.map(c => c.id));
  assert.equal(bonusCards(four, '사광').length, 4);
  assert.deepEqual(bonusCards(scoreCaptured(CARDS.filter(c => c.band === '홍단')), '홍단').length, 3);
});
import { bakWarnings, dealOrder } from './turnPlan.ts';
import { judgeBak } from '../score.ts';
test('박 위험 표시는 judgeBak과 같다: 피 가치 0·7·8, 광 0·1장, 상대 피 점수 0일 때의 경계', () => {
  const 피 = CARDS.filter(c => c.kind === '피' && !c.ssangpi), 광 = CARDS.filter(c => c.kind === '광' && !c.rainGwang);
  const mk = (mine: number[], theirs: number[]) => { const s = new GameState(); s.captured = [mine.map(cardById), theirs.map(cardById)]; return s; };
  const oppPi10 = 피.slice(0, 10).map(c => c.id), opp광3 = 광.slice(0, 3).map(c => c.id);
  // 상대 피 10장(1점) 기준: 내 피 가치 0 → 피박 아님, 7 → 피박, 8 → 아님
  assert.deepEqual(bakWarnings(mk([], oppPi10), 0), []);
  assert.deepEqual(bakWarnings(mk(피.slice(10, 17).map(c => c.id), oppPi10), 0), ['피박']);
  assert.deepEqual(bakWarnings(mk(피.slice(10, 18).map(c => c.id), oppPi10), 0), []);
  // 상대 피 점수 0(9장)이면 내 피가 적어도 피박 아님
  assert.deepEqual(bakWarnings(mk(피.slice(10, 13).map(c => c.id), 피.slice(0, 9).map(c => c.id)), 0), []);
  // 상대 광 3장(점수 있음): 내 광 0장 → 광박, 1장 → 아님
  assert.deepEqual(bakWarnings(mk([], opp광3), 0), ['광박']);
  assert.deepEqual(bakWarnings(mk([광[3].id], opp광3), 0), []);
  // 둘 다
  const both = mk(피.slice(10, 12).map(c => c.id), [...oppPi10, ...opp광3]);
  assert.deepEqual(bakWarnings(both, 0), ['피박', '광박']);
  assert.deepEqual(bakWarnings(both, 1), [], '상대 쪽은 같은 규칙으로 판정');
  // 고박은 제외(세 번째 인자 0): 내가 고를 했어도 결과에 고박이 없다
  both.goCount[0] = 1;
  assert.deepEqual(bakWarnings(both, 0), ['피박', '광박']);
  assert.deepEqual(judgeBak(both.score(1), both.score(0), 0).filter(b => b !== '고박'), bakWarnings(both, 0));
});
test('패 나누기 순서: 28장, 상대 5 → 나 5 → 바닥 4 → 상대 5 → 나 5 → 바닥 4, 중복 없음, 각 그룹은 배열 순서', () => {
  const s = new GameState();
  const d = dealOrder(s);
  assert.equal(d.length, 28);
  const seq = d.map(x => x.to);
  const expect = [...Array(5).fill('opp'), ...Array(5).fill('me'), ...Array(4).fill('floor')];
  assert.deepEqual(seq, [...expect, ...expect]);
  assert.equal(new Set(d.map(x => x.card.id)).size, 28);
  assert.deepEqual(d.filter(x => x.to === 'opp').map(x => x.card.id), s.hands[1].map(c => c.id));
  assert.deepEqual(d.filter(x => x.to === 'me').map(x => x.card.id), s.hands[0].map(c => c.id));
  assert.deepEqual(d.filter(x => x.to === 'floor').map(x => x.card.id), s.table.map(c => c.id));
  assert.equal(s.allCardIds().length, 48, '상태는 바뀌지 않는다');
});
test('족보 완성 직전 힌트: 남은 한 장이 내 손패나 공개 바닥패에 있을 때만, 더미·상대 손패는 보지 않는다', () => {
  const 고도리 = CARDS.filter(c => c.godori), 홍단 = CARDS.filter(c => c.band === '홍단'), 광 = CARDS.filter(c => c.kind === '광');
  assert.deepEqual(nearBonuses(고도리.slice(0, 2), [고도리[2]], []), ['고도리 1장']);
  assert.deepEqual(nearBonuses(고도리.slice(0, 2), [], [고도리[2]]), ['고도리 1장']);
  assert.deepEqual(nearBonuses(고도리.slice(0, 2), [], []), [], '남은 장이 더미에 있어도 힌트 없음');
  assert.deepEqual(nearBonuses([...홍단.slice(0, 2), ...광.slice(0, 2)], [홍단[2], 광[3]], []), ['홍단 1장', '삼광 1장']);
  assert.deepEqual(nearBonuses(고도리, [], []), [], '이미 완성이면 힌트 없음');
});
