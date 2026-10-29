// F4(요청 09) 검증: forfeit 세 종류, 상대 속임수(공개 정보만·판당 최대·간파 상태에서만 잡기·시계 1회), 잡기 → 내 승리, 7장 원본/사본,
// 학습형 잠김·연속 분류, 8장 선택과 태오 버튼, 접기 조건·점수, 아버지 손패 읽기, 접기 가르치기, 9장 완료(승리·접기), 회중시계 대상, 서린 사건 3개.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicView } from '../ai.ts';
import { cardById } from '../cards.ts';
import { FORFEIT_MIN_BASE, GameState, type Setup } from '../game.ts';
import { seededRng } from '../rng.ts';
import { settlementPoints } from '../score.ts';
import { dealSetup } from '../sim.ts';
import { CH7_COPY, CH7_ORIGINAL, CH9_FOLD, CH9_WIN, ch8Choice, chapterById, chapterWinVariant, isChapterImplemented } from './chapters.ts';
import { CATCH_WINDOW_MS, cheatReaction, decideCheat, pickCheatCard } from './cheat.ts';
import { FLAGS, shopItems } from './items.ts';
import { LEARN_LOCK_AFTER, LEARNER_WEIGHTS, captureStreak, canFold, fatherRead, isSkillRead, justRead, learnerPolicy, pickWatchTarget, shouldTeachFold, watchRefundable } from './learner.ts';
import { FATHER_READ } from './lines.ts';
import { OPPONENTS, resolveOpponent } from './opponents.ts';
import { addToBag, bagCount, completeChapter, initialProgress } from './progress.ts';
import { SIT_DOWN, applyEvent, eventCandidates } from './serin.ts';
import { taeohAvailable } from './tempo.ts';
import { STRATEGIC, AI_WEIGHTS } from '../ai.ts';

test('forfeit 세 종류: 들통(최소 7·고 공식), 잡기(내 승리·최소 7), 접기(상대 기본 그대로·최소 없음·고 공식 없음)', () => {
  const bust = new GameState(dealSetup(seededRng(5)));
  const rb = bust.forfeit(0);
  assert.ok(rb.outcome === '승리' && rb.winner === 1 && rb.endKind === 'bust' && rb.forfeit && rb.base === FORFEIT_MIN_BASE);
  const caught = new GameState(dealSetup(seededRng(6)));
  const rc = caught.forfeit(1, { kind: 'caught' });
  assert.ok(rc.outcome === '승리' && rc.winner === 0 && rc.endKind === 'caught' && rc.base === Math.max(caught.baseScore(0), 7));
  const fold = new GameState(dealSetup(seededRng(7)));
  fold.captured[1] = fold.deck.splice(0, 8); fold.goCount[1] = 0;
  const base = fold.baseScore(1);
  const rf = fold.forfeit(0, { kind: 'fold' });
  assert.ok(rf.outcome === '승리' && rf.winner === 1 && rf.endKind === 'fold');
  if (rf.outcome !== '승리') return;
  assert.equal(rf.base, base, '최소 7 없음'); assert.equal(rf.final, base, '고 공식 없음');
  assert.deepEqual([rf.baks, rf.declared, rf.multiplier, rf.declMultiplier], [[], [], 1, 1]);
  const go = new GameState(dealSetup(seededRng(7))); go.captured[1] = go.deck.splice(0, 8); go.goCount[1] = 2;
  const rg = go.forfeit(0);
  assert.ok(rg.outcome === '승리' && rg.settled === settlementPoints(Math.max(go.baseScore(1), 7), 2), '들통은 고 공식 적용');
});

test('상대 속임수: 바닥과 맞지 않는 손패를 공개 정보만으로 고르고, 판당 최대 횟수, 잡기 창은 간파 중에만, 시계는 1회', () => {
  const sangcheol = OPPONENTS.sangcheol.cheat!;
  assert.deepEqual(sangcheol, { perTurn: 0.35, maxPerMatch: 3 });
  assert.equal(OPPONENTS.ma.cheat, undefined);
  assert.ok(decideCheat(() => 0.1, sangcheol, 2) && !decideCheat(() => 0.1, sangcheol, 3) && !decideCheat(() => 0.5, sangcheol, 0) && !decideCheat(() => 0, undefined, 0));
  for (let seed = 0; seed < 15; seed++) {
    const s = new GameState(dealSetup(seededRng(seed))); s.turn = 1;
    const c = pickCheatCard(publicView(s, 1));
    if (c) { assert.ok(s.hands[1].includes(c)); assert.ok(!s.table.some(t => t.month === c.month), '바닥과 맞지 않는 패'); }
  }
  // 같은 공개 정보 → 같은 패(사용자 손패·더미 순서는 입력에 없음)
  const a = dealSetup(seededRng(11));
  const b: Setup = { hands: [[...a.deck.slice(0, 10)], [...a.hands[1]]], table: [...a.table], deck: [...a.hands[0], ...a.deck.slice(10)].reverse() };
  const sa = new GameState(a), sb = new GameState(b); sa.turn = sb.turn = 1;
  assert.deepEqual(pickCheatCard(publicView(sa, 1)), pickCheatCard(publicView(sb, 1)));
  assert.equal(cheatReaction(true, true, true, false), 'catch');
  assert.equal(cheatReaction(true, false, true, false), 'buzz');
  assert.equal(cheatReaction(true, false, true, true), 'none', '시계는 판당 1회');
  assert.equal(cheatReaction(false, true, true, false), 'none', '속임수가 없으면 잡기 창도 없다');
  assert.equal(CATCH_WINDOW_MS, 2500);
  // 속임수 실행 = swapHandWithDeck(1, id): 48장 보존
  const s = new GameState(dealSetup(seededRng(3))); s.turn = 1;
  const card = pickCheatCard(publicView(s, 1));
  if (card) { s.swapHandWithDeck(1, card.id); assert.equal(s.deck[0], card); assert.equal(new Set(s.allCardIds()).size, 48); }
});

test('7장: 잡기로 이기면 원본, 그냥 이기면 사본(둘 다 진행), 완료 시 당구장', () => {
  assert.deepEqual(chapterWinVariant('ch7', { caught: true }), { prefix: CH7_ORIGINAL, flags: ['ch7.original'] });
  assert.deepEqual(chapterWinVariant('ch7', { caught: false }), { prefix: CH7_COPY, flags: ['ch7.copy'] });
  const p = completeChapter({ ...initialProgress(), chapterId: 'ch7' }, chapterById('ch7'));
  assert.ok(p.unlockedPlaces.includes('billiards') && p.chapterId === 'ch8');
  assert.ok(shopItems({ 'ch7.courier': true }).some(i => i.id === 'buzzWatch' && i.price === 12000));
});

test('학습형: 같은 기술 두 번이면 그 기술만 잠기고, 3턴 연속 같은 분류면 저지 강화(공개 정보만)', () => {
  assert.equal(LEARN_LOCK_AFTER, 2);
  const uses = { eye: 2, calmFace: 1 } as const;
  assert.ok(isSkillRead(uses, 'eye') && !isSkillRead(uses, 'calmFace') && !isSkillRead(uses, 'swap'));
  assert.ok(justRead({ eye: 2 }, 'eye') && !justRead({ eye: 3 }, 'eye') && !justRead({ eye: 1 }, 'eye'));
  assert.equal(captureStreak([['피'], ['피', '띠'], ['피']]), '피');
  assert.equal(captureStreak([['광'], ['피'], ['피']]), null);
  assert.equal(captureStreak([['피'], ['피']]), null);
  assert.equal(LEARNER_WEIGHTS.block, AI_WEIGHTS.block * 1.5);
  assert.ok(OPPONENTS.taeoh.learner && OPPONENTS.taeoh.sharpness === 1.3);
  const a = dealSetup(seededRng(12));
  const b: Setup = { hands: [[...a.deck.slice(0, 10)], [...a.hands[1]]], table: [...a.table], deck: [...a.hands[0], ...a.deck.slice(10)].reverse() };
  const sa = new GameState(a), sb = new GameState(b); sa.turn = sb.turn = 1;
  const pol = learnerPolicy(STRATEGIC, () => true);
  assert.deepEqual(pol.chooseAction(publicView(sa, 1), seededRng(1), 0), pol.chooseAction(publicView(sb, 1), seededRng(1), 0));
});

test('8장 선택: 받아들이면 9장부터 태오 버튼 재등장, 자료만이면 없음. 완료 시 호텔', () => {
  assert.deepEqual(ch8Choice(true).flags, ['taeoh.accepted']); assert.deepEqual(ch8Choice(false).flags, ['taeoh.declined']);
  assert.ok(taeohAvailable('ch5', {}) && !taeohAvailable('ch6', {}) && !taeohAvailable('ch8', { 'taeoh.accepted': true }));
  assert.ok(taeohAvailable('ch9', { 'taeoh.accepted': true }) && taeohAvailable('ch11', { 'taeoh.accepted': true }) && !taeohAvailable('ch9', { 'taeoh.declined': true }));
  const p = completeChapter({ ...initialProgress(), chapterId: 'ch8' }, chapterById('ch8'));
  assert.ok(p.unlockedPlaces.includes('hotel') && p.chapterId === 'ch9');
});

test('접기: 상대가 고 중이면 불가, 내 차례에만', () => {
  const s = new GameState(dealSetup(seededRng(9)));
  assert.ok(canFold(s));
  s.goCount[1] = 1; assert.ok(!canFold(s));
  s.goCount[1] = 0; s.turn = 1; assert.ok(!canFold(s), '상대 차례');
  s.turn = 0; s.forfeit(0, { kind: 'fold' }); assert.ok(!canFold(s), '끝난 판');
});

test('아버지: 7점이면 3고까지, 손패 읽기는 내 실제 손패의 월, 접기 가르치기 조건, 미션·의심 없음', () => {
  const f = OPPONENTS.father;
  assert.ok(f.readsHand && f.teachesFold && f.eagerGo === 3 && f.sharpness === 0);
  assert.ok(resolveOpponent(f).key.includes('도발'));
  for (let seed = 0; seed < 10; seed++) {
    const hand = new GameState(dealSetup(seededRng(seed))).hands[0];
    const r = fatherRead(hand, seededRng(seed), FATHER_READ)!;
    assert.ok(hand.some(c => c.month === r.month), '실제 손패의 월');
    assert.ok(r.text.includes(`${r.month}월`));
  }
  assert.equal(fatherRead([], seededRng(1), FATHER_READ), null);
  assert.equal(FATHER_READ[0], '넌 지금 {m}월 들고 뻑 기다리지.');
  assert.ok(shouldTeachFold(false, 5, 3, false));
  assert.ok(!shouldTeachFold(true, 5, 3, false), '이미 배웠으면 없음');
  assert.ok(!shouldTeachFold(false, 4, 3, false) && !shouldTeachFold(false, 5, 5, false) && !shouldTeachFold(false, 6, 3, true), '그 판 한 번만');
});

test('9장 완료: 접기·승리 모두 완료, 접기 정식 습득·집중력 140·자료 플래그, 10장은 준비 중', () => {
  assert.deepEqual(chapterWinVariant('ch9', { folded: true }).prefix, CH9_FOLD);
  assert.deepEqual(chapterWinVariant('ch9', { folded: false }).prefix, CH9_WIN);
  const p = completeChapter({ ...initialProgress(), chapterId: 'ch9' }, chapterById('ch9'));
  assert.ok(p.skills.includes('fold') && p.focusMax === 140 && p.flags['ch9.files'] && p.chapterId === 'ch10');
  assert.ok(!isChapterImplemented('ch10'));
});

test('회중시계: 정직·비희귀 기술만, 쓴 순서의 가장 최근 것, 남은 횟수가 최대면 건너뜀', () => {
  assert.ok(watchRefundable('eye') && watchRefundable('readThrough') && watchRefundable('fold'));
  assert.ok(!watchRefundable('swap') && !watchRefundable('handSwap') && !watchRefundable('memory'));
  const skills = [{ id: 'eye' as const, uses: 1 }, { id: 'swap' as const, uses: 0 }, { id: 'calmFace' as const, uses: 1 }];
  assert.equal(pickWatchTarget(['eye', 'swap'], skills), 'eye', '속임수(바꿔치기)는 건너뜀');
  assert.equal(pickWatchTarget(['eye', 'calmFace'], skills), 'eye', '태연한 얼굴은 남은 횟수가 최대(1)라 건너뜀');
  assert.equal(pickWatchTarget(['swap'], skills), null);
});

test('서린 사건: 앉아 있다 가(7장 이후·방문 6회·1회, 우유·호감 +3), 오래된 선물(회중시계 1회)', () => {
  const p = { ...initialProgress(), chapterId: 'ch7' as const, serin: { ...initialProgress().serin, visits: SIT_DOWN.needVisits, seen: ['textbook', 'stock'] } };
  assert.ok(eventCandidates(p).some(e => e.id === 'sitDown'));
  assert.ok(!eventCandidates({ ...p, chapterId: 'ch6' }).some(e => e.id === 'sitDown'));
  assert.ok(!eventCandidates({ ...p, serin: { ...p.serin, visits: 5 } }).some(e => e.id === 'sitDown'));
  const r = applyEvent(p, 'sitDown');
  assert.equal(bagCount(r.progress, 'milk'), 1); assert.equal(r.progress.serin.affinity, 3);
  assert.ok(!eventCandidates(r.progress).some(e => e.id === 'sitDown'));
  assert.equal(bagCount(applyEvent(r.progress, 'sitDown').progress, 'milk'), 1, '중복 없음');
  const g = applyEvent(initialProgress(), 'gift');
  assert.equal(bagCount(g.progress, 'pocketWatch'), 1); assert.equal(g.progress.flags[FLAGS.serinWatch], true);
  assert.equal(bagCount(applyEvent(g.progress, 'gift').progress, 'pocketWatch'), 1);
  assert.ok(addToBag && cardById(0));
});
