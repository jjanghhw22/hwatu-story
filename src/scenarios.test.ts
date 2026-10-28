import test from 'node:test';
import assert from 'node:assert/strict';
import { cardById } from './cards.ts';
import { GameState, validateSetup, type TurnPlan } from './game.ts';
import { SCENARIOS, findScenario } from './scenarios.ts';

const ids = (cards: { id: number }[]) => cards.map(c => c.id).sort((a, b) => a - b);
const uniq48 = (s: GameState) => { const all = s.allCardIds(); assert.equal(all.length, 48); assert.equal(new Set(all).size, 48); };
/** 플레이어 0이 손패 index의 카드를 내고(필요하면 선택 id) 계획을 적용한 뒤 피 이동까지 처리. */
function playTurn(s: GameState, player: number, index: number, handTarget?: number, deckTarget?: number): TurnPlan {
  const card = s.hands[player][index];
  let plan = s.planTurn(player, card, handTarget, deckTarget);
  if (plan.needsDeckChoice) plan = s.planTurn(player, card, handTarget, plan.needsDeckChoice[0].id);
  s.applyTurn(plan);
  if (s.pendingGukjin(player)) s.autoChooseGukjin(player);
  s.stealPi(1 - player, player, plan.piSteals);
  return plan;
}
/** 지정한 카드를 지금 있는 곳(손패·바닥·더미)에서 빼서 player의 획득패로 옮긴다(복제 없이 48장 유지). */
function give(s: GameState, player: number, cardIds: number[]) {
  for (const id of cardIds) {
    for (const arr of [s.hands[0], s.hands[1], s.table, s.deck]) { const i = arr.findIndex(c => c.id === id); if (i >= 0) { arr.splice(i, 1); break; } }
    s.captured[player].push(cardById(id));
  }
}
const load = (key: string) => { const sc = findScenario(key)!; assert.ok(sc, key); return new GameState(sc.setup); };

test('모든 시나리오는 고유한 48장으로 구성되고 손패 10장씩이다', () => {
  for (const sc of SCENARIOS) {
    validateSetup(sc.setup);
    const s = new GameState(sc.setup);
    uniq48(s); assert.ok(s.hands[0].length <= 10 && s.hands[1].length <= 10);
  }
});

test('쪽: 바닥에 없는 월을 놓고 더미 패가 같은 월이면 두 장 획득, 상대 피 1장', () => {
  const s = load('jjok'); give(s, 1, [22, 23]); // 상대 피 2장(6월)
  const plan = playTurn(s, 0, 0);
  assert.deepEqual(plan.events, ['쪽']); assert.equal(plan.piSteals, 1);
  assert.deepEqual(ids(plan.captureGroups.flat()), [2, 3]);
  assert.deepEqual(ids(s.captured[0]), [2, 3, 22]); assert.deepEqual(ids(s.captured[1]), [23]);
  assert.ok(!s.table.some(c => c.month === 1)); uniq48(s);
});

test('뻑: 세 장이 바닥에 남고 점수에 들어가지 않으며, 자뻑 회수 시 상대 피 2장', () => {
  const s = load('ppeok'); give(s, 1, [22, 23, 26]);
  const p1 = playTurn(s, 0, 0); // 1월 피(3) → 바닥 1월 피(2) + 더미 1월 홍단(1)
  assert.deepEqual(p1.events, ['뻑']); assert.equal(p1.piSteals, 0); assert.deepEqual(p1.captureGroups, []);
  assert.deepEqual(ids(s.table.filter(c => c.month === 1)), [1, 2, 3]); assert.equal(s.ppeok.get(1), 0);
  assert.equal(s.score(0).total, 0); assert.equal(s.captured[0].length, 0);
  // 상대 턴(1월 없음) 뒤 내가 1월 광으로 회수
  const cpu = s.hands[1][0]; const cp = s.planTurn(1, cpu); s.applyTurn(cp);
  const p2 = playTurn(s, 0, s.hands[0].findIndex(c => c.id === 0));
  assert.ok(p2.events.includes('자뻑회수')); assert.equal(p2.piSteals, 2); assert.deepEqual(p2.ppeokTaken, { month: 1, owner: 0 });
  assert.ok([0, 1, 2, 3].every(id => s.captured[0].some(c => c.id === id)));
  assert.ok(!s.ppeok.has(1)); assert.equal(s.captured[0].filter(c => c.month === 6).length, 2); uniq48(s);
});

test('상대 뻑 회수: 상대가 내 뻑을 먹으면 내 피 1장을 가져간다', () => {
  const s = load('ppeok-other'); give(s, 0, [22, 23]);
  playTurn(s, 0, 0); assert.equal(s.ppeok.get(1), 0);
  const i = s.hands[1].findIndex(c => c.id === 0);
  const p = playTurn(s, 1, i);
  assert.deepEqual(p.events, ['뻑회수']); assert.equal(p.piSteals, 1);
  assert.deepEqual(ids(s.captured[0]), [23]); assert.ok(s.captured[1].some(c => c.id === 22)); uniq48(s);
});

test('따닥: 바닥 2장 + 손패 + 더미가 같은 월이면 선택 없이 4장, 상대 피 1장', () => {
  const s = load('ttadak');
  const card = s.hands[0][0];
  assert.equal(s.analyzeHand(card).needsChoice, false);
  const plan = playTurn(s, 0, 0);
  assert.deepEqual(plan.events, ['따닥']); assert.equal(plan.piSteals, 1);
  assert.deepEqual(ids(plan.captureGroups.flat()), [4, 5, 6, 7]); assert.equal(plan.needsDeckChoice, null); uniq48(s);
});

test('일반 두 장 중 선택: 더미가 다른 월이면 선택이 필요하고 고른 장만 가져온다', () => {
  const s = load('choice');
  const card = s.hands[0][0];
  assert.equal(s.analyzeHand(card).needsChoice, true);
  const plan = playTurn(s, 0, 0, 7);
  assert.deepEqual(plan.events, []); assert.deepEqual(ids(plan.captureGroups[0]), [4, 7]);
  assert.ok(s.table.some(c => c.id === 6)); uniq48(s);
});

test('쓸: 바닥을 모두 가져가면 상대 피 1장. 빈 바닥 시작과 마지막 턴은 제외', () => {
  const s = load('sseul'); give(s, 1, [30]);
  const plan = playTurn(s, 0, 0);
  assert.deepEqual(plan.events, ['쓸']); assert.equal(plan.piSteals, 1); assert.equal(s.table.length, 0);
  assert.ok(s.captured[0].some(c => c.id === 30)); uniq48(s);
  const e = load('empty-floor'); const pe = playTurn(e, 0, 0);
  assert.deepEqual(pe.events, []); assert.equal(e.table.length, 2);
  // 마지막 턴: 양쪽 손패가 이 턴으로 모두 소진되면 쓸 없음
  const l = load('sseul'); l.hands[0] = [l.hands[0][0]]; l.hands[1] = [];
  const pl = l.planTurn(0, l.hands[0][0]);
  assert.equal(pl.lastTurn, true); assert.deepEqual(pl.events, []); assert.equal(pl.floorCountAfter, 0);
});

test('따닥 + 쓸은 보너스를 합산한다(상대 피 2장)', () => {
  const s = load('ttadak-sseul'); give(s, 1, [22, 23, 26]);
  const plan = playTurn(s, 0, 0);
  assert.deepEqual(plan.events, ['따닥', '쓸']); assert.equal(plan.piSteals, 2);
  assert.equal(s.captured[1].length, 1); uniq48(s);
});

test('처음 깔린 같은 월 3장은 뻑이 아니다: 4장을 가져가지만 보너스 없음', () => {
  const s = load('initial-three'); give(s, 1, [22]);
  assert.equal(s.ppeok.size, 0);
  const plan = playTurn(s, 0, 0);
  assert.deepEqual(plan.events, []); assert.equal(plan.piSteals, 0); assert.equal(plan.ppeokTaken, null);
  assert.deepEqual(ids(plan.captureGroups.flat()), [0, 1, 2, 3]); assert.equal(s.captured[1].length, 1); uniq48(s);
});

test('폭탄 시나리오: 조건 충족, 4장 획득, 기회 2회. 흔들기 후 같은 월 폭탄은 배수 한 번',()=>{
  const s = load('bomb');
  assert.deepEqual(s.bombCandidates(0), [1]);
  const plan = s.planBomb(0, 1); s.applyTurn(plan); s.stealPi(1, 0, plan.piSteals);
  assert.deepEqual(plan.events, ['폭탄']); assert.ok([0, 1, 2, 3].every(id => s.captured[0].some(c => c.id === id)));
  assert.equal(s.flipChances[0], 2); assert.equal(s.hands[0].length, 7); uniq48(s);
  const t = load('bomb-vs-shake');
  assert.deepEqual(t.bombCandidates(0), [1]); assert.deepEqual(t.shakeCandidates(0), [1, 3]);
  t.declareShake(0, 1); t.applyTurn(t.planBomb(0, 1)); // 같은 월 흔들기+폭탄 → 배수 한 번
  assert.deepEqual(t.declaredMonths(0), [{ month: 1, kinds: ['흔들기', '폭탄'] }]);
  assert.equal(t.previewSettlement(0).declMultiplier, 2);
});
test('기회만 남은 시나리오: 손패 0이어도 끝나지 않고 기회를 다 쓰면 끝난다', () => {
  const s = load('flip-only');
  assert.equal(s.hands[0].length, 0); assert.equal(s.flipChances[0], 2); assert.equal(s.finished, false);
  const p1 = s.planFlip(0); s.applyTurn(p1); assert.equal(s.flipChances[0], 1); assert.equal(s.finished, false);
  uniq48(s);
});

test('족보·국진·고/스톱 시나리오: 획득패 포함 48장, 고도리 완성, 국진 선택 대기, 8점으로 고/스톱 가능', () => {
  const c = load('combo'); uniq48(c); assert.equal(c.captured[0].length, 4);
  const plan = playTurn(c, 0, 0); assert.ok(plan.captureGroups.flat().some(x => x.id === 29)); assert.ok(c.score(0).열끗.bonuses.includes('고도리')); uniq48(c);
  const g = load('gukjin'); uniq48(g); const s2 = new GameState(findScenario('gukjin')!.setup);
  const p2 = s2.planTurn(0, s2.hands[0][0]); s2.applyTurn(p2); assert.equal(s2.pendingGukjin(0), true);
  const gs = load('gostop'); uniq48(gs); assert.equal(gs.baseScore(0), 6); assert.equal(gs.hands[1].length, 10);
  playTurn(gs, 0, 0); assert.equal(gs.baseScore(0), 8); assert.equal(gs.canDecide(0), true); assert.equal(gs.canGo(0), true);
  void g;
});
