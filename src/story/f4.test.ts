// F3-장(요청 08) 검증: 심부름·복희 입장, 역정보 대사, 시선 돌리기 표시, 속공 타이머 자동 행동, 태오 도움, 6장 연속 판·돈 변동 없음·걸릴 뻔 1회·그날 밤 잠금·동결, 서린 토요일·비 오는 날, 들통 최소 벌점.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicView } from '../ai.ts';
import { GameState, type Setup } from '../game.ts';
import { seededRng } from '../rng.ts';
import { dealSetup } from '../sim.ts';
import { actionForTap } from '../ui/turnPlan.ts';
import { BIG_TABLE, BIG_TABLE_INTERLUDE, effectiveStake, isNearMiss, nextBigRound } from './bigtable.ts';
import { BLUFF, markBluff, pickBluff, truthBand } from './bluff.ts';
import { CH5_RAMEN_SCENES, NIGHT_CH6_SCENES, chapterById, isChapterImplemented } from './chapters.ts';
import { ERRANDS, canChallengeBokhee, completeErrand, errandsDone, isErrandDone } from './errands.ts';
import { FLAGS, isItemUnlocked, itemById, shopItems } from './items.ts';
import { BOKHEE_BLUFF, NEAR_MISS_LINE } from './lines.ts';
import { OPPONENTS } from './opponents.ts';
import { DEBT_FROZEN_FLAG, NIGHT_LOCK_FLAG, addToBag, bagCount, bump, canChallengeBonggu, completeChapter, initialProgress, isDebtFrozen, isNightLocked, rest, winsKey } from './progress.ts';
import { AFFINITY, RAIN, SATURDAY, applyEvent, eventCandidates, visitSerin } from './serin.ts';
import { TIMER_WARN_MS, assistAction, autoAction, autoChoice, turnLimitMs } from './tempo.ts';

const at = (chapterId: 'ch4' | 'ch5' | 'ch6') => ({ ...initialProgress(), chapterId, unlockedPlaces: ['barber', 'home', 'store', 'bath', 'market', 'harbor'] as const }) as ReturnType<typeof initialProgress>;

test('4장 심부름: 셋을 끝내야 복희 대결, 4장이 현재 장일 때만', () => {
  let p = at('ch4');
  assert.equal(errandsDone(p), 0); assert.ok(!canChallengeBokhee(p));
  for (const e of ERRANDS) p = completeErrand(p, e.id);
  assert.equal(errandsDone(p), 3); assert.ok(isErrandDone(p, 'find') && canChallengeBokhee(p));
  assert.ok(!canChallengeBokhee({ ...p, chapterId: 'ch5' }));
  assert.equal(completeErrand(p, 'find').flags['errand.find'], true, '두 번 끝내도 같다');
  assert.deepEqual(ERRANDS.map(e => e.kind), ['match', 'choice', 'clue']);
  assert.ok(ERRANDS[1].choice?.money === 30000);
});

test('4장 완료: 시선 돌리기·눈썰미 강화·집중력 120·항구 해금·도시락·안대 상점 해금', () => {
  const p = completeChapter(at('ch4'), chapterById('ch4'));
  assert.deepEqual(p.skills, ['lookAway']); assert.equal(p.flags[FLAGS.eyePlus], true); assert.equal(p.focusMax, 120);
  assert.ok(p.unlockedPlaces.includes('harbor') && isChapterImplemented('ch5'));
  const ids = shopItems(p.flags).map(i => i.id);
  assert.ok(ids.includes('warmLunch') && ids.includes('sleepMask'));
  assert.ok(isItemUnlocked(itemById('sleepMask'), { 'home.firstRest': true }), '첫 휴식으로도 열린다');
});

test('복희 역정보: 거짓이면 실제 상태의 반대(5점 이상 비관, 2점 이하 낙관), 아니면 사실(상태 띠), 결정적 rng', () => {
  const lie = () => 0, truth = () => 0.99;
  assert.ok(BOKHEE_BLUFF.pessimist.includes(pickBluff(lie, 0.6, 6, BOKHEE_BLUFF).text));
  assert.ok(BOKHEE_BLUFF.optimist.includes(pickBluff(lie, 0.6, 1, BOKHEE_BLUFF).text));
  assert.equal(pickBluff(lie, 0.6, 3, BOKHEE_BLUFF).truthful, true, '3~4점은 속일 말이 없어 사실');
  assert.deepEqual(pickBluff(truth, 0.6, 6, BOKHEE_BLUFF), { text: BOKHEE_BLUFF.truthful[2], truthful: true });
  assert.deepEqual(pickBluff(truth, 0.6, 0, BOKHEE_BLUFF), { text: BOKHEE_BLUFF.truthful[0], truthful: true });
  assert.equal(pickBluff(() => 0.5, 0, 6, BOKHEE_BLUFF).truthful, true, 'bluff 0이면 항상 사실');
  assert.deepEqual([truthBand(0), truthBand(2), truthBand(3), truthBand(4), truthBand(5)], [0, 0, 1, 1, 2]);
  assert.equal(BLUFF.pessimistAt, 5); assert.equal(OPPONENTS.bokhee.bluff, 0.6);
  const rng = seededRng(3);
  const a = Array.from({ length: 20 }, () => pickBluff(rng, 0.6, 6, BOKHEE_BLUFF).text);
  const rng2 = seededRng(3);
  assert.deepEqual(a, Array.from({ length: 20 }, () => pickBluff(rng2, 0.6, 6, BOKHEE_BLUFF).text));
  assert.equal(BOKHEE_BLUFF.pessimist[0], '아이고 이번 판은 틀렸네.');
});

test('시선 돌리기 표시: 켜져 있으면 다음 말풍선에 "(거짓)"/"(참)"', () => {
  assert.equal(markBluff({ text: 'x', truthful: false }, true), 'x (거짓)');
  assert.equal(markBluff({ text: 'x', truthful: true }, true), 'x (참)');
  assert.equal(markBluff({ text: 'x', truthful: false }, false), 'x');
});

test('속공 타이머: 봉구만 8초(마지막 3초 경고), 만료 시 자동 행동은 가장 왼쪽 손패의 합법 행동, 선택창은 첫 후보', () => {
  assert.equal(turnLimitMs(OPPONENTS.bonggu), 8000); assert.equal(OPPONENTS.bonggu.thinkMs, 150);
  for (const o of [OPPONENTS.barber, OPPONENTS.ma, OPPONENTS.bokhee, OPPONENTS.highroller]) assert.equal(turnLimitMs(o), undefined);
  assert.equal(TIMER_WARN_MS, 3000);
  for (let seed = 0; seed < 20; seed++) {
    const s = new GameState(dealSetup(seededRng(seed)));
    const a = autoAction(s)!;
    assert.ok(a);
    const sorted = [...s.hands[0]].sort((x, y) => x.month - y.month || x.id - y.id);
    const expect = actionForTap(s, 0, s.hands[0].indexOf(sorted[0]));
    assert.deepEqual(a, expect);
    if (a.kind === 'normal') assert.ok(s.hands[0][a.index]);
    if (a.kind === 'bomb') assert.ok(s.canBomb(0, a.month));
  }
  const empty = new GameState(dealSetup(seededRng(1))); empty.hands[0].length = 0; empty.flipChances[0] = 1;
  assert.deepEqual(autoAction(empty), { kind: 'flip' });
  empty.flipChances[0] = 0; assert.equal(autoAction(empty), null);
  assert.equal(autoChoice([7, 8]), 7);
});

test('태오 도움: 전략 정책이 고른 합법 행동, 공개 정보만 본다(같은 공개 정보 → 같은 행동)', () => {
  for (let seed = 0; seed < 10; seed++) {
    const s = new GameState(dealSetup(seededRng(seed)));
    const a = assistAction(s, seededRng(seed))!;
    assert.ok(a);
    if (a.kind === 'normal') { assert.ok(s.hands[0][a.index]); if (a.target !== undefined) assert.ok(s.table.some(c => c.id === a.target)); }
    if (a.kind === 'bomb') assert.ok(s.canBomb(0, a.month));
  }
  const a = dealSetup(seededRng(11));
  const b: Setup = { hands: [[...a.hands[0]], [...a.deck.slice(0, 10)]], table: [...a.table], deck: [...a.hands[1], ...a.deck.slice(10)].reverse() };
  const sa = new GameState(a), sb = new GameState(b);
  assert.deepEqual(publicView(sa, 0), publicView(sb, 0));
  assert.deepEqual(assistAction(sa, seededRng(5)), assistAction(sb, seededRng(5)));
});

test('5장: 봉구 입장은 항구 1승 + 5장, 완료 보상 바꿔치기·동전 1개·상점 동전·새 가구', () => {
  const p = at('ch5');
  assert.ok(!canChallengeBonggu(p));
  const w = bump(p, winsKey('harbor'));
  assert.ok(canChallengeBonggu(w) && !canChallengeBonggu({ ...w, chapterId: 'ch4' }));
  const done = completeChapter(w, chapterById('ch5'));
  assert.ok(done.skills.includes('swap')); assert.equal(bagCount(done, 'luckyCoin'), 1);
  assert.equal(done.flags[FLAGS.taeohCoin], true); assert.equal(done.flags['home.newFurniture'], true);
  assert.ok(shopItems(done.flags).some(i => i.id === 'luckyCoin'));
  assert.equal(done.chapterId, 'ch6');
  assert.ok(CH5_RAMEN_SCENES.some(s => s.kind === 'line' && s.text === '저 사람은 웃을 때 대답을 안 해.'));
  const again = completeChapter(done, chapterById('ch5'));
  assert.equal(bagCount(again, 'luckyCoin'), 1, '두 번 완료해도 동전은 한 개');
});

test('6장 큰 판: 두 판 연속, 돈 변동 없음, 걸릴 뻔 1회, 완료 시 동결·그날 밤 잠금, 휴식하면 풀림', () => {
  assert.equal(BIG_TABLE.rounds, 2); assert.equal(nextBigRound(1), 2); assert.equal(nextBigRound(2), null);
  assert.equal(effectiveStake({ stake: 200000, noPayout: true }), 0); assert.equal(effectiveStake({ stake: 10000 }), 10000);
  assert.ok(BIG_TABLE_INTERLUDE.length === 1 && OPPONENTS.highroller.sharpness === 2.0);
  assert.ok(isNearMiss(true, 40, 52, false) && !isNearMiss(true, 40, 52, true) && !isNearMiss(false, 40, 52, false) && !isNearMiss(true, 55, 60, false));
  assert.equal(NEAR_MISS_LINE, '…방금 뭐였지?');
  const done = completeChapter(at('ch6'), chapterById('ch6'));
  assert.ok(isDebtFrozen(done) && isNightLocked(done)); assert.equal(done.flags[DEBT_FROZEN_FLAG], true); assert.equal(done.chapterId, 'ch7');
  assert.ok(!isChapterImplemented('ch10'));
  const night = rest(addToBag(done, 'riceBall', 2));
  assert.ok(!isNightLocked(night) && isDebtFrozen(night)); assert.equal(night.flags[NIGHT_LOCK_FLAG], false); assert.equal(bagCount(night, 'riceBall'), 2);
  assert.ok(NIGHT_CH6_SCENES.some(s => s.kind === 'line' && s.text === '먹고 화내. 굶으면 판단부터 이상해져.'));
});

test('서린 토요일 약속: 호감 5 이상에서만 추첨, 약속 → 다음 방문에 고물상(투시경 해금 또는 동전) + 핫팩, 두 번 받지 않는다', () => {
  const base = { ...initialProgress(), chapterId: 'ch3' as const };
  assert.ok(!eventCandidates(base).some(e => e.id === 'saturday'));
  const p5 = { ...base, serin: { ...base.serin, affinity: SATURDAY.needAffinity, seen: ['textbook', 'stock'] } };
  assert.ok(eventCandidates(p5).some(e => e.id === 'saturday'));
  const promised = applyEvent(p5, 'saturday').progress;
  assert.equal(promised.flags[SATURDAY.pending], true); assert.equal(promised.serin.affinity, SATURDAY.needAffinity + AFFINITY.talk);
  // 같은 날 다시 가면 사건 없음(하루 1회), 다음 날 가면 추첨 대신 후속
  const sameDay = visitSerin({ ...promised, serin: { ...promised.serin, lastEventDay: promised.day } }, seededRng(1));
  assert.equal(sameDay.event, undefined);
  const next = visitSerin(rest(promised), seededRng(1));
  assert.equal(next.event?.id, 'saturdayVisit'); assert.equal(next.tier, undefined);
  const r1 = applyEvent(next.progress, 'saturdayVisit');
  assert.equal(r1.progress.flags[FLAGS.serinJunk], true); assert.equal(bagCount(r1.progress, 'hotPack'), 1); assert.equal(bagCount(r1.progress, 'luckyCoin'), 0);
  assert.equal(r1.progress.serin.affinity, next.progress.serin.affinity + AFFINITY.promise);
  assert.equal(r1.progress.flags[SATURDAY.pending], false);
  const r2 = applyEvent(r1.progress, 'saturdayVisit');
  assert.equal(bagCount(r2.progress, 'hotPack'), 1, '중복 보상 없음'); assert.equal(r2.progress.serin.affinity, r1.progress.serin.affinity);
  // 이미 투시경이 해금된 상태였으면 동전
  const junkFirst = applyEvent({ ...next.progress, flags: { ...next.progress.flags, [FLAGS.serinJunk]: true } }, 'saturdayVisit');
  assert.equal(bagCount(junkFirst.progress, 'luckyCoin'), 1);
  assert.ok(!eventCandidates(r1.progress).some(e => e.id === 'saturday'), '1회성');
  assert.ok(isItemUnlocked(itemById('hotPack'), r1.progress.flags) && itemById('hotPack').price === null);
});

test('서린 비 오는 날: 호감 8 이상 + 4장 이후, 선택에 따라 +3/+1, 1회성', () => {
  const p = { ...initialProgress(), chapterId: 'ch5' as const, serin: { ...initialProgress().serin, affinity: RAIN.needAffinity, seen: ['textbook', 'stock', 'saturday'] } };
  assert.ok(eventCandidates(p).some(e => e.id === 'rain'));
  assert.ok(!eventCandidates({ ...p, chapterId: 'ch4' }).some(e => e.id === 'rain'), '4장 이후');
  assert.ok(!eventCandidates({ ...p, serin: { ...p.serin, affinity: 7 } }).some(e => e.id === 'rain'));
  const together = applyEvent(p, 'rain', 'accept'), apart = applyEvent(p, 'rain', 'decline');
  assert.equal(together.progress.serin.affinity, RAIN.needAffinity + 3); assert.equal(apart.progress.serin.affinity, RAIN.needAffinity + 1);
  assert.ok(together.notice.some(n => n.includes('어머니 병원')) && apart.notice.some(n => n.includes('어머니 병원')));
  assert.equal(together.moneyDelta, 0);
  assert.ok(!eventCandidates({ ...together.progress, serin: { ...together.progress.serin, seen: [...together.progress.serin.seen, 'rain'] } }).some(e => e.id === 'rain'));
});
