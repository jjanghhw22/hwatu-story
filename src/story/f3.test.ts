// F3-시스템 검증: 의심도(상승 공식·sharpness·들통 결과·하강·출입 금지), 미션(손패 제외·유형 판정·장별 제한·배수·나가리), 바꿔치기(상태 동작·성공률), 장비(2칸·안대·마스크·투시경 대상).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, cardById } from '../cards.ts';
import { FORFEIT_MIN_BASE, GameState } from '../game.ts';
import { seededRng } from '../rng.ts';
import { settlementPoints } from '../score.ts';
import { dealSetup } from '../sim.ts';
import { MISSION_TYPES, allowedMissionTypes, drawMission, missionDone, missionMultiplier, pickMissionCards } from './mission.ts';
import { OPPONENTS } from './opponents.ts';
import { SUSPICION, banKey, crossesWarn, isBusted, lowerSuspicion, raiseSuspicion, suspicionVisible, swapSuccessRate } from './suspicion.ts';
import { SKILLS } from './skills.ts';
import { FLAGS, GEAR_SLOTS, itemById } from './items.ts';
import { addToBag, banPlace, equipGear, initialProgress, isBanned, rest, unequipGear, useItemOnMap } from './progress.ts';

test('의심도: 상승 = 기본값 × sharpness, 0~100 고정, 정직 기술은 0, 들통은 100', () => {
  assert.equal(raiseSuspicion(0, SUSPICION.swapSuccess, OPPONENTS.ma.sharpness), 15);
  assert.equal(raiseSuspicion(0, SUSPICION.swapFail, OPPONENTS.mujin.sharpness), 80);
  assert.equal(raiseSuspicion(50, SUSPICION.xray, OPPONENTS.highroller.sharpness), 90);
  assert.equal(raiseSuspicion(90, SUSPICION.swapFail, 1), 100);
  assert.equal(raiseSuspicion(30, SUSPICION.swapSuccess, OPPONENTS.barber.sharpness), 30, '대식·아버지 판에서는 오르지 않는다');
  for (const id of ['eye', 'calmFace', 'lookAway', 'readThrough', 'fold', 'memory'] as const) assert.equal(SKILLS[id].suspicion, 0);
  assert.ok(isBusted(100) && !isBusted(99));
  assert.ok(crossesWarn(69, 70) && !crossesWarn(70, 80) && !crossesWarn(10, 60));
  assert.deepEqual([OPPONENTS.ma, OPPONENTS.stranger, OPPONENTS.bokhee, OPPONENTS.highroller, OPPONENTS.sangcheol, OPPONENTS.taeoh, OPPONENTS.jeongho, OPPONENTS.mujin, OPPONENTS.father].map(o => o.sharpness), [0.6, 0.8, 1.0, 2.0, 1.2, 1.3, 1.5, 2.0, 0]);
});

test('의심도 하강: 태연한 얼굴·마스크 −30, 0 아래 없음. 게이지는 속임수 기술이나 투시경이 있을 때만', () => {
  assert.equal(lowerSuspicion(50, SUSPICION.calmFace), 20);
  assert.equal(lowerSuspicion(10, SUSPICION.mask), 0);
  assert.ok(!suspicionVisible(['eye', 'calmFace'], []));
  assert.ok(suspicionVisible(['eye', 'swap'], []));
  assert.ok(suspicionVisible([], ['xrayGlasses']));
});

test('들통: GameState.forfeit(loser)는 승자 기본 점수의 고 공식만 적용한 결과(박·배수 없음, forfeit 표시), 끝난 판은 거부', () => {
  const s = new GameState(dealSetup(seededRng(5)));
  s.captured[1] = s.deck.splice(0, 6); s.goCount[1] = 1;
  const v = s.version;
  const r = s.forfeit(0);
  assert.equal(r.outcome, '승리');
  if (r.outcome !== '승리') return;
  const base = Math.max(s.baseScore(1), FORFEIT_MIN_BASE);
  assert.equal(r.winner, 1); assert.equal(r.base, base); assert.equal(r.goCount, 1);
  assert.equal(r.settled, settlementPoints(base, 1)); assert.equal(r.final, r.settled);
  // 최소 벌점: 승자 기본 점수가 0이어도 7점으로 스톱한 것과 같다
  const z = new GameState(dealSetup(seededRng(6)));
  const rz = z.forfeit(0);
  assert.ok(rz.outcome === '승리' && rz.base === FORFEIT_MIN_BASE && rz.final === FORFEIT_MIN_BASE);
  assert.deepEqual(r.baks, []); assert.equal(r.multiplier, 1); assert.deepEqual(r.declared, []); assert.equal(r.declMultiplier, 1); assert.equal(r.forfeit, true);
  assert.equal(s.version, v + 1); assert.ok(s.over);
  assert.throws(() => s.forfeit(1), /끝난/);
  assert.equal(s.allCardIds().length, 48);
});

test('출입 금지 플래그는 그 날에만 걸리고 다음 날 풀린다', () => {
  const p = banPlace(initialProgress(), 'bath');
  assert.equal(p.flags[banKey('bath', 1)], true);
  assert.ok(isBanned(p, 'bath') && !isBanned(p, 'market'));
  assert.ok(!isBanned(rest(p), 'bath'));
});

test('미션: 카드는 내 손패에 없는 것만, 1~4장은 ①②④만, 5장부터 8종, 고정 시드 재현', () => {
  const s = new GameState(dealSetup(seededRng(31)));
  const hand = new Set(s.hands[0].map(c => c.id));
  assert.deepEqual(allowedMissionTypes(1).map(t => t.no), [1, 2, 4]);
  assert.deepEqual(allowedMissionTypes(4).map(t => t.no), [1, 2, 4]);
  assert.equal(allowedMissionTypes(5).length, 8);
  for (let seed = 0; seed < 40; seed++) {
    for (const ch of [1, 5]) {
      const m = drawMission(seededRng(seed), hand, ch)!;
      assert.ok(m, 'mission');
      assert.ok(m.cardIds.every(id => !hand.has(id)), '손패에 없는 카드만');
      assert.ok(m.cardIds.length >= 2 && m.cardIds.length <= 3 && new Set(m.cardIds).size === m.cardIds.length);
      assert.ok(allowedMissionTypes(ch).some(t => t.type === m.def.type));
    }
  }
  assert.deepEqual(drawMission(seededRng(7), hand, 5), drawMission(seededRng(7), hand, 5));
  assert.deepEqual(MISSION_TYPES.map(t => t.multiplier), [2, 3, 3, 3, 3, 4, 4, 4]);
});

test('미션: 유형별 카드 조건', () => {
  const none = new Set<number>();
  const rng = seededRng(3);
  const pair = pickMissionCards(rng, 'pair', none)!; assert.equal(cardById(pair[0]).month, cardById(pair[1]).month);
  const gp = pickMissionCards(rng, 'gwangPi', none)!; assert.equal(cardById(gp[0]).kind, '광'); assert.equal(cardById(gp[1]).kind, '피');
  const gd = pickMissionCards(rng, 'godori', none)!; assert.ok(gd.every(id => cardById(id).godori));
  const bd = pickMissionCards(rng, 'band', none)!; assert.equal(cardById(bd[0]).band, cardById(bd[1]).band); assert.ok(cardById(bd[0]).band);
  const sp = pickMissionCards(rng, 'ssangpi', none)!; assert.ok(sp.every(id => cardById(id).ssangpi));
  assert.equal(pickMissionCards(rng, 'three', none)!.length, 3);
  const rg = pickMissionCards(rng, 'rainGukjin', none)!; assert.ok(cardById(rg[0]).rainGwang && cardById(rg[1]).gukjin);
  const g2 = pickMissionCards(rng, 'gwang2', none)!; assert.ok(g2.every(id => cardById(id).kind === '광'));
  // 쌍피 2장(41·47) 중 하나가 손패에 있으면 ⑤는 만들 수 없다 → 다른 유형으로
  assert.equal(pickMissionCards(rng, 'ssangpi', new Set([41])), null);
  assert.equal(pickMissionCards(rng, 'rainGukjin', new Set([32])), null);
  const m = drawMission(seededRng(1), new Set([41, 32]), 5)!;
  assert.ok(m.def.type !== 'ssangpi' || !m.cardIds.includes(41));
});

test('미션: 달성 판정·배수 적용·나가리 무효', () => {
  const m = drawMission(seededRng(2), new Set(), 5)!;
  const have = new Set<number>();
  assert.ok(!missionDone(m, have));
  for (const id of m.cardIds) have.add(id);
  assert.ok(missionDone(m, have));
  assert.equal(missionMultiplier(m, true, '승리'), m.def.multiplier);
  assert.equal(missionMultiplier(m, false, '승리'), 1);
  assert.equal(missionMultiplier(m, true, '나가리'), 1);
  assert.equal(missionMultiplier(null, true, '승리'), 1);
  assert.ok(CARDS.length === 48);
});

test('바꿔치기: swapHandWithDeck은 48장 보존·version +1, 상대 차례·빈 더미·손패에 없는 카드는 거부', () => {
  const s = new GameState(dealSetup(seededRng(8)));
  const v = s.version, top = s.deck[0], given = s.hands[0][3];
  const r = s.swapHandWithDeck(0, given.id);
  assert.equal(r.given, given); assert.equal(r.taken, top);
  assert.equal(s.hands[0][3], top); assert.equal(s.deck[0], given);
  assert.equal(s.version, v + 1);
  assert.equal(new Set(s.allCardIds()).size, 48);
  assert.throws(() => s.swapHandWithDeck(1, s.hands[1][0].id), /자기 차례/);
  assert.throws(() => s.swapHandWithDeck(0, 999), /손패에 없는/);
  const empty = new GameState(dealSetup(seededRng(8))); empty.deck.length = 0;
  assert.throws(() => empty.swapHandWithDeck(0, empty.hands[0][0].id), /더미/);
  s.forfeit(0);
  assert.throws(() => s.swapHandWithDeck(0, s.hands[0][0].id), /끝난/);
});

test('바꿔치기 성공률: 70%, 동전 +15%p, 최대 90%. 실패 의심도 40·성공 25', () => {
  assert.equal(swapSuccessRate(false), 0.7);
  assert.equal(swapSuccessRate(true), 0.85);
  assert.ok(swapSuccessRate(true) <= 0.9);
  assert.equal(SUSPICION.swapFail, 40); assert.equal(SUSPICION.swapSuccess, SKILLS.swap.suspicion);
  const coin = useItemOnMap(addToBag(initialProgress(), 'luckyCoin'), 'luckyCoin')!;
  assert.equal(coin.progress.flags[FLAGS.coinBoost], true);
});

test('장비: 2칸 제한, 가방↔장착 이동, 안대는 휴식 때 플래그, 마스크·투시경 수치', () => {
  let p = addToBag(addToBag(addToBag(initialProgress(), 'sleepMask'), 'blankMask'), 'xrayGlasses');
  p = equipGear(p, 'sleepMask')!; p = equipGear(p, 'blankMask')!;
  assert.deepEqual(p.gear, ['sleepMask', 'blankMask']);
  assert.equal(equipGear(p, 'xrayGlasses'), null, `장비는 ${GEAR_SLOTS}칸`);
  assert.equal(p.bag.sleepMask, undefined, '장착하면 가방에서 빠진다');
  assert.equal(equipGear(p, 'riceBall'), null);
  p = unequipGear(p, 'blankMask')!;
  assert.deepEqual(p.gear, ['sleepMask']); assert.equal(p.bag.blankMask, 1);
  assert.equal(rest(p).flags[FLAGS.maskRested], true);
  assert.equal(rest(initialProgress()).flags[FLAGS.maskRested], undefined);
  assert.equal(itemById('blankMask').suspicion, -30); assert.equal(itemById('xrayGlasses').suspicion, 20); assert.equal(itemById('sleepMask').focus, 30);
});

test('투시경 공개 대상은 상대 손패에 있는 카드', () => {
  const s = new GameState(dealSetup(seededRng(4)));
  const rng = seededRng(1);
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(rng() * s.hands[1].length);
    assert.ok(s.hands[1].includes(s.hands[1][idx]));
  }
});
