import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, cardById } from './cards.ts';
import { GameState, type Setup } from './game.ts';
import { AI_GO_POLICY, type AiView, STRATEGIC, bombMonths, chooseFloorTarget, chooseGukjinUse, chooseHandCard, decideGoStop, publicView, rankHandCards, shakeMonths } from './ai.ts';
import { BEGINNER, BEGINNER_CONFIG, chooseEarly, chooseLate, makeBeginner } from './beginner.ts';
import { seededRng } from './rng.ts';
import { dealSetup, playMatch, playRound } from './sim.ts';

const ids = (xs: number[]) => xs.map(cardById);
/** 손패·바닥·획득패만 지정한 판단 입력. 상대 손패·더미는 장수만. */
function view(p: { hand: number[]; table: number[]; mine?: number[]; opp?: number[]; gukjinAsPi?: boolean; myGo?: number; chances?: number; oppHand?: number; shakes?: number[] }): AiView {
  return { me: 1, hand: ids(p.hand), table: ids(p.table), myCaptured: ids(p.mine ?? []), oppCaptured: ids(p.opp ?? []), gukjinAsPi: p.gukjinAsPi ?? false,
    myGo: p.myGo ?? 0, oppGo: 0, myFlipChances: p.chances ?? 0, oppFlipChances: 0, oppHandCount: p.oppHand ?? 5, deckCount: 10, ppeok: [], myShakes: p.shakes ?? [] };
}
const 국진 = CARDS.find(c => c.gukjin)!.id;
const 피들 = CARDS.filter(c => c.kind === '피' && !c.ssangpi).map(c => c.id);

// ---- 손패 선택 ----
test('조합 완성 패를 고른다: 홍단 2장 보유 시 3월 광으로 3월 홍단을 가져와 홍단 완성', () => {
  // 바닥: 3월 홍단(9), 3월 피(10), 5월 피(18). 손패: 3월 광(8), 5월 피(19), 7월 피(26)
  const v = view({ hand: [8, 19, 26], table: [9, 10, 18], mine: [1, 5] });
  const d = chooseHandCard(v);
  assert.equal(d.cardId, 8); assert.equal(d.targetId, 9); assert.equal(d.mode, 'capture');
  assert.match(d.reason, /기본 \+3점/);
});

test('완성까지 남은 장수를 반영한다: 고도리 2장 보유면 기러기(8월 열끗)를 다른 열끗보다 우선', () => {
  // 바닥: 8월 피(30), 10월 피(38). 손패: 8월 기러기(29), 10월 사슴(36)
  const v = view({ hand: [29, 36], table: [30, 38], mine: [4, 12] });
  assert.equal(chooseHandCard(v).cardId, 29);
  // 상대가 고도리 패를 가졌으면 그 조합은 죽어 사슴 쪽 가치가 같아진다(조합 진행 0)
  const dead = view({ hand: [29, 36], table: [30, 38], mine: [4], opp: [12] });
  const r = rankHandCards(dead);
  assert.ok(!r.find(x => x.cardId === 29)!.reasons.some(s => s.startsWith('조합 진행')));
});

test('피박 위험 완화가 선택에 반영된다: 상대 피가 10에 가까우면 피를 모아 8 이상을 만드는 쪽을 고른다', () => {
  // 내 피 6장(가치 6). 손패: 7월 피(26)↔바닥 7월 피(27) / 10월 사슴(36)↔바닥 10월 청단(37)
  const base = { hand: [26, 36], table: [27, 37], mine: 피들.slice(0, 6) };
  const pressured = chooseHandCard(view({ ...base, opp: 피들.slice(6, 15) })); // 상대 피 9장
  assert.equal(pressured.cardId, 26); assert.ok(pressured.reasons.some(s => s.startsWith('피박 완화')));
  const relaxed = chooseHandCard(view({ ...base, opp: [] }));
  assert.equal(relaxed.cardId, 36);
});

test('광박 위험 완화: 광 0장이고 상대가 광을 모으면 첫 광을 우선', () => {
  // 손패: 1월 광(0)↔바닥 1월 피(2) / 2월 매조(4)↔바닥 2월 홍단(5)
  const v = view({ hand: [0, 4], table: [2, 5], mine: 피들.slice(0, 2), opp: [8, 28] });
  const d = chooseHandCard(v); assert.equal(d.cardId, 0); assert.ok(d.reasons.some(s => s.startsWith('광박 완화')));
});

test('상대 조합 저지: 상대가 청단 2장이면 바닥의 청단을 가져가는 쪽에 저지 가치가 붙는다', () => {
  const v = view({ hand: [36, 26], table: [37, 27], opp: [21, 33] });
  const r = rankHandCards(v);
  const 사슴 = r.find(x => x.cardId === 36)!;
  assert.ok(사슴.reasons.some(s => s.startsWith('상대 저지'))); assert.equal(r[0].cardId, 36);
});

test('먹을 패가 없으면 자기·상대 조합에 덜 중요한 패를 내려놓고, 같은 월을 더 들고 있으면 그 월을 선호한다', () => {
  // 바닥에 맞는 월 없음. 손패: 2월 매조(4, 고도리), 6월 피(22), 6월 피(23)
  const v = view({ hand: [4, 22, 23], table: [38, 39], mine: [12] });
  const d = chooseHandCard(v); assert.equal(d.mode, 'discard'); assert.equal(d.cardId, 22);
  assert.ok(d.reasons.some(s => s.includes('같은 월')));
  // 고도리 패는 내가 2장 가진 상태에서 가장 내려놓기 아깝다
  const r = rankHandCards(v); assert.equal(r[r.length - 1].cardId, 4);
});

test('동점은 카드 id 오름차순으로 결정돼 재현된다', () => {
  // 서로 구별되지 않는 두 피(6월 22, 23)와 바닥의 두 피(6월? 아님) → 둘 다 내려놓기이며 같은 값
  const v = view({ hand: [23, 22], table: [38] });
  const r = rankHandCards(v); assert.equal(r[0].value, r[1].value); assert.equal(r[0].cardId, 22);
});

// ---- 바닥패 선택·국진 ----
test('같은 월 바닥 두 장 중 유리한 패: 쌍피 > 피, 홍단 완성 > 피, 동점은 id', () => {
  assert.equal(chooseFloorTarget(view({ hand: [], table: [41, 43] }), cardById(42), ids([43, 41])).targetId, 41);
  assert.equal(chooseFloorTarget(view({ hand: [], table: [9, 10], mine: [1, 5] }), cardById(8), ids([9, 10])).targetId, 9);
  assert.equal(chooseFloorTarget(view({ hand: [], table: [22, 23] }), cardById(20), ids([23, 22])).targetId, 22);
  // 더미 공개 뒤 선택: 공개된 더미 패(8)와 후보만으로 판단
  const s = new GameState({ hands: [[], [20]], table: [9, 10], deck: CARDS.filter(c => ![20, 9, 10].includes(c.id)).map(c => c.id) });
  s.captured[1] = ids([1, 5]); s.turn = 1;
  const d = chooseFloorTarget(publicView(s, 1), cardById(8), ids([9, 10])); assert.equal(d.targetId, 9);
});

test('국진: 열끗 4장이면 열끗, 피 8장이면 쌍피, 피박 위험이 큰 상황은 쌍피, 이미 결정된 판은 다시 묻지 않는다', () => {
  const 열끗4 = CARDS.filter(c => c.kind === '열끗' && !c.gukjin).slice(0, 4).map(c => c.id);
  assert.equal(chooseGukjinUse(view({ hand: [], table: [], mine: [국진, ...열끗4] })).choice, '열끗');
  assert.equal(chooseGukjinUse(view({ hand: [], table: [], mine: [국진, ...피들.slice(0, 8)] })).choice, '피');
  // 점수는 같지만(0점) 내 피 5·상대 피 9 → 피박 위험 완화로 쌍피
  assert.equal(chooseGukjinUse(view({ hand: [], table: [], mine: [국진, ...피들.slice(0, 5)], opp: 피들.slice(5, 14) })).choice, '피');
  assert.throws(() => chooseGukjinUse(view({ hand: [], table: [] })), /국진/);
  // 이미 결정된 판: 상대가 국진을 가져가도 pendingGukjin이 false라 선택 흐름에 들어가지 않는다
  const s = new GameState(); s.captured[0] = [cardById(국진)]; s.chooseGukjin(0, '열끗');
  s.captured[0] = []; s.captured[1] = [cardById(국진)];
  assert.equal(s.pendingGukjin(1), false); assert.throws(() => s.chooseGukjin(1, '피'), /이미 확정/); assert.equal(s.gukjinUse(1), '열끗');
});

// ---- 고/스톱 ----
const 칠점 = () => [...CARDS.filter(c => c.kind === '광' && !c.rainGwang).slice(0, 3).map(c => c.id), ...피들.slice(0, 13)];
test('고/스톱 정책: 고를 하는 사례와 상대 위험·마지막 행동·이미 1고·남은 행동 부족·더미 운만 남은 스톱 사례', () => {
  // 손패 5월 피(19)가 바닥 5월 피(18)와 맞아 피 14→+1점 가능 → 고
  const go = decideGoStop(view({ hand: [19, 33], table: [18, 40], mine: 칠점() }));
  assert.equal(go.decision, 'go'); assert.match(go.reason, /가능성/); assert.match(go.reason, /더미 결과/);
  assert.equal(decideGoStop(view({ hand: [], table: [18], mine: 칠점(), chances: 0 })).decision, 'stop');
  assert.match(decideGoStop(view({ hand: [19, 33], table: [18], mine: 칠점(), myGo: 1 })).reason, /이미 1고/);
  assert.match(decideGoStop(view({ hand: [19, 33], table: [18], mine: 칠점(), opp: [...CARDS.filter(c => c.godori).map(c => c.id)] })).reason, /상대 기본 점수 5점/);
  assert.match(decideGoStop(view({ hand: [19], table: [18], mine: 칠점() })).reason, /남은 행동 1회/);
  // 바닥에 맞는 패가 없으면 더미 운에만 기대는 것이라 스톱
  assert.match(decideGoStop(view({ hand: [33, 41], table: [18, 22], mine: 칠점() })).reason, /더미 운/);
  assert.equal(AI_GO_POLICY.maxGoCount, 1);
});

// ---- 공정성·불변 ----
function snapshot(s: GameState) { return JSON.stringify({ h: s.hands.map(h => h.map(c => c.id)), t: s.table.map(c => c.id), d: s.deck.map(c => c.id), c: s.captured.map(h => h.map(c => c.id)), v: s.version, turn: s.turn, fc: s.flipChances, g: s.goCount }); }
test('AI는 후보 평가 중 실제 게임 상태를 바꾸지 않는다', () => {
  const s = new GameState(dealSetup(seededRng(3))); s.turn = 1; s.captured[1] = s.deck.splice(0, 4);
  const before = snapshot(s);
  const v = publicView(s, 1);
  rankHandCards(v); chooseHandCard(v); decideGoStop(v); STRATEGIC.chooseAction(v, seededRng(1), 0); BEGINNER.chooseAction(v, seededRng(1), 0);
  if (s.table.length) chooseFloorTarget(v, s.hands[1][0], s.table.slice(0, 2));
  assert.equal(snapshot(s), before);
});

test('공개 정보가 같고 사용자 손패·더미 순서만 다르면 같은 판단을 낸다(판단 입력에 그 정보가 없음)', () => {
  const a = dealSetup(seededRng(11));
  const b: Setup = { hands: [[...a.deck.slice(0, 10)], [...a.hands[1]]], table: [...a.table], deck: [...a.hands[0], ...a.deck.slice(10)].reverse() };
  const sa = new GameState(a), sb = new GameState(b); sa.turn = sb.turn = 1;
  const va = publicView(sa, 1), vb = publicView(sb, 1);
  assert.deepEqual(va, vb);
  assert.deepEqual(chooseHandCard(va), chooseHandCard(vb));
  assert.deepEqual(STRATEGIC.chooseAction(va, seededRng(5), 0), STRATEGIC.chooseAction(vb, seededRng(5), 0));
  assert.deepEqual(BEGINNER.chooseAction(va, seededRng(5), 0), BEGINNER.chooseAction(vb, seededRng(5), 0));
  assert.deepEqual(decideGoStop(va), decideGoStop(vb));
  assert.ok(!('deck' in va) && !JSON.stringify(va).includes('"oppHand":'), '판단 입력에 더미·상대 손패 내용이 없다');
});

test('폭탄·흔들기 월 판정은 GameState와 같다', () => {
  for (let i = 0; i < 50; i++) {
    const s = new GameState(dealSetup(seededRng(100 + i))); s.turn = 1;
    assert.deepEqual(bombMonths(publicView(s, 1)), s.bombCandidates(1));
    assert.deepEqual(shakeMonths(publicView(s, 1)), s.shakeCandidates(1).filter(m => s.table.every(c => c.month !== m)));
  }
});

// ---- 초보 정책 ----
const 폭탄판 = () => view({ hand: [0, 1, 2, 20, 24], table: [3, 21, 25] }); // 1월 세 장 + 바닥 1월 한 장(폭탄), 5월·7월은 먹을 수 있음
test('초보 초반: 먹을 패가 있어도 70% 쪽에서는 먹을 수 없는 패를 고르고, 30% 쪽에서는 먹을 수 있는 패 중 무작위', () => {
  const v = view({ hand: [20, 24, 40, 44], table: [21, 25] }); // 20·24 먹을 수 있음, 40·44 없음
  const hold = chooseEarly(v, () => 0.1); assert.equal(hold.kind, 'normal'); assert.ok([40, 44].includes((hold as { cardId: number }).cardId)); assert.match(hold.reason, /보유/);
  const take = chooseEarly(v, () => 0.9); assert.ok([20, 24].includes((take as { cardId: number }).cardId));
});
test('초보 초반: 전부 먹을 수 있으면 이득이 가장 작은 패, 전부 먹을 수 없으면 무작위로 정상 진행', () => {
  const all = view({ hand: [0, 24], table: [2, 25] }); // 1월 광(큰 이득) vs 7월 피(작은 이득)
  assert.equal((chooseEarly(all, () => 0.1) as { cardId: number }).cardId, 24);
  const none = view({ hand: [40, 44], table: [25] });
  const a = chooseEarly(none, () => 0.9); assert.ok([40, 44].includes((a as { cardId: number }).cardId)); assert.match(a.reason, /전부 먹을 수 없어/);
});
test('초보 초반: 다른 월이 있으면 폭탄·흔들기 월을 보유하고, 대안이 없으면 규칙대로 폭탄·흔들기를 실행한다', () => {
  const v = 폭탄판();
  for (const r of [0.1, 0.9]) { const a = chooseEarly(v, () => r); assert.equal(a.kind, 'normal'); assert.ok([20, 24].includes((a as { cardId: number }).cardId)); assert.match(a.reason, /보유/); }
  // 1월 세 장뿐 → 폭탄(세 장, 한 장만 내지 않음)
  const only = view({ hand: [0, 1, 2], table: [3] });
  const b = chooseEarly(only, () => 0.1); assert.deepEqual([b.kind, (b as { month: number }).month], ['bomb', 1]);
  // 흔들기 월만 있으면 그 월 한 장 내기(실행기가 공개 뒤 낸다)
  const shake = view({ hand: [0, 1, 2], table: [20] });
  const c = chooseEarly(shake, () => 0.5); assert.equal(c.kind, 'normal'); assert.ok([0, 1, 2].includes((c as { cardId: number }).cardId));
  assert.deepEqual(shakeMonths(shake), [1]);
});
test('초보 초반 이후: 30%는 전략 최선(폭탄 우선 포함), 70%는 무작위 합법 손패(폭탄 월이면 폭탄)', () => {
  const v = 폭탄판();
  assert.equal(chooseLate(v, () => 0.1).kind, 'bomb');
  const seq = [0.9, 0.0]; const rnd = chooseLate(v, () => seq.shift() ?? 0); // 무작위 → 손패 첫 장(1월) → 폭탄 월이라 폭탄
  assert.equal(rnd.kind, 'bomb');
  const seq2 = [0.9, 0.99]; const rnd2 = chooseLate(v, () => seq2.shift() ?? 0); assert.equal((rnd2 as { cardId: number }).cardId, 24);
});
test('초보: 3번 행동 뒤 정책이 바뀌고 새 판에서 초기화된다, 손패 없으면 기회 패, 고/스톱은 항상 스톱', () => {
  const v = 폭탄판();
  assert.equal(BEGINNER.chooseAction(v, () => 0.1, 2).kind, 'normal');  // 초반(0,1,2번째 행동): 폭탄 월 보유
  assert.equal(BEGINNER.chooseAction(v, () => 0.1, 3).kind, 'bomb');    // 초반 이후: 전략 최선
  assert.equal(BEGINNER.chooseAction(v, () => 0.1, 0).kind, 'normal');  // 새 판(0부터) 다시 초반
  assert.equal(BEGINNER.chooseAction(view({ hand: [], table: [3], chances: 2 }), () => 0.1, 5).kind, 'flip');
  assert.equal(BEGINNER.decideGoStop(view({ hand: [19], table: [18], mine: 칠점() })).decision, 'stop');
  assert.equal(BEGINNER_CONFIG.earlyActions, 3);
  const custom = makeBeginner({ ...BEGINNER_CONFIG, earlyActions: 1 });
  assert.equal(custom.chooseAction(v, () => 0.1, 1).kind, 'bomb');
});

// ---- 전체 판 진행 ----
function invariants(s: GameState) {
  const all = s.allCardIds(); assert.equal(all.length, 48); assert.equal(new Set(all).size, 48);
  assert.equal(s.deck.length, s.remainingActions(0) + s.remainingActions(1), '남은 더미 = 남은 행동 수');
}
test('전략 AI끼리·초보 AI끼리 고정 시드 전체 판: 합법 행동만, 종료, 48장 보존, 더미와 남은 행동 일치', () => {
  for (const pair of [[STRATEGIC, STRATEGIC], [BEGINNER, BEGINNER], [BEGINNER, STRATEGIC]] as const) {
    for (let i = 0; i < 40; i++) {
      const s = new GameState(dealSetup(seededRng(500 + i)));
      const r = playRound(s, { players: [pair[0], pair[1]], rngs: [seededRng(i), seededRng(i + 1000)], check: invariants });
      assert.ok(s.over); assert.ok(r.outcome === '승리' || r.outcome === '나가리');
      if (r.outcome === '나가리') assert.ok(s.finished);
      invariants(s);
    }
  }
});
test('폭탄·자동 흔들기·기회 패를 포함한 판 진행', () => {
  // 좌석 1(컴퓨터)에 1월 세 장 + 바닥 1월 한 장(폭탄), 3월 세 장(흔들기). 전략 AI는 폭탄을 먼저 쓴다.
  const fixed = [0, 1, 2, 8, 9, 10, 20, 24, 28, 32], table = [3, 21, 25, 29, 33, 37, 41, 45];
  const rest = CARDS.map(c => c.id).filter(id => !fixed.includes(id) && !table.includes(id));
  const s = new GameState({ hands: [rest.slice(0, 10), fixed], table, deck: rest.slice(10) });
  let bombSeen = false, flipSeen = false, shakeSeen = false;
  playRound(s, { players: [STRATEGIC, STRATEGIC], rngs: [seededRng(1), seededRng(2)], check: st => { invariants(st); if (st.bombs[1].length) bombSeen = true; if (st.shakes[1].length) shakeSeen = true; if (st.hands[1].length === 0 && st.flipChances[1] > 0) flipSeen = true; } });
  assert.ok(bombSeen, '폭탄 사용'); assert.ok(s.over); invariants(s);
  assert.ok(flipSeen || s.flipChances[1] === 0, '기회 패 사용 흐름');
  assert.ok(shakeSeen || s.over, '흔들기 흐름');
});
test('초보 AI 대 전략 AI 고정 시드 대결 집계(선공 교대). 실제 사용자 승률이 아니다.', () => {
  const m = playMatch(BEGINNER, STRATEGIC, 20, 7);
  assert.equal(m.rounds, 20);
  const b = m.seats.beginner, st = m.seats.strategic;
  assert.equal(b.wins + b.losses + b.draws, 20); assert.equal(b.wins, st.losses); assert.equal(b.draws, st.draws);
  assert.deepEqual(playMatch(BEGINNER, STRATEGIC, 5, 7), playMatch(BEGINNER, STRATEGIC, 5, 7), '같은 시드는 같은 결과');
});
