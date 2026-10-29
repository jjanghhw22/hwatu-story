// 요청 11(완주 보정) 테스트: A 입장 ×3·태오 대납·안전망·최악 경로, B 10장 ▶·초대전 잠금·관계 분기 시점, C 밤 경과·호감 계산, D 크레딧.
import assert from 'node:assert/strict';
import test from 'node:test';
import { seededRng } from '../rng.ts';
import { CH6_STAKED_LINE, TAEOH_STAKE_SCENES, chapterWinVariant, nightAfterWin } from './chapters.ts';
import { CREDITS_SCENES, MOVIE_AFFINITY, envelopeOf } from './endings.ts';
import { CHARM_FLAG, canChallengeGate, ch10Pointer, routeStep, setRoute, winGate } from './gates.ts';
import { MIN_STAKE_POINTS, PLACES, canSit } from './places.ts';
import { SAFETY_NET, START_MONEY, TAEOH_STAKED_FLAG, canTaeohStake, initialProgress, rest, setFlag, settleStake, settleStakeStaked } from './progress.ts';
import { MEAL_MONEY, applyEvent, visitSerin } from './serin.ts';

test('A-1 일반 판 입장: 판돈 × 3 (목욕탕 3만, 시장 6만, 항구 15만, 호텔 60만)', () => {
  assert.equal(MIN_STAKE_POINTS, 3);
  assert.ok(canSit(30000, PLACES.bath.stakePerPoint) && !canSit(29999, PLACES.bath.stakePerPoint));
  assert.ok(canSit(60000, PLACES.market.stakePerPoint) && !canSit(59999, PLACES.market.stakePerPoint));
  assert.ok(canSit(150000, PLACES.harbor.stakePerPoint) && !canSit(149999, PLACES.harbor.stakePerPoint));
  assert.ok(canSit(600000, PLACES.hotel.stakePerPoint) && !canSit(599999, PLACES.hotel.stakePerPoint));
  assert.ok(canSit(START_MONEY, PLACES.bath.stakePerPoint), '시작 소지금으로 목욕탕 입장');
});

test('A-2 태오 대납: 5장 항구에서 1회, 지면 손실 0, 이기면 정상 획득, 6장 정산에 한 줄', () => {
  const ch5 = { ...initialProgress(), chapterId: 'ch5' as const, money: 0 };
  assert.ok(canTaeohStake(ch5, 'harbor'));
  assert.ok(!canTaeohStake(setFlag(ch5, TAEOH_STAKED_FLAG), 'harbor'), '한 번만');
  assert.ok(!canTaeohStake({ ...ch5, chapterId: 'ch4' }, 'harbor'), '5장에서만');
  assert.ok(!canTaeohStake(ch5, 'bath'), '항구에서만');
  assert.equal(settleStakeStaked(7, 50000, false, true), 0, '대납 판에서 지면 손실 0');
  assert.equal(settleStakeStaked(7, 50000, true, true), 350000, '이기면 정상 획득');
  assert.equal(settleStakeStaked(7, 50000, false, false), settleStake(7, 50000, false), '대납 아니면 그대로');
  assert.ok(TAEOH_STAKE_SCENES.some(s => s.kind === 'line' && s.speaker === 'taeoh' && s.text === '첫 판은 내가 대지. 친구잖아.'));
  const v = chapterWinVariant('ch6', { staked: true });
  assert.ok(v.prefix.some(s => s.kind === 'line' && s.speaker === 'taeoh' && s.text === CH6_STAKED_LINE), '6장 정산 한 줄');
  assert.deepEqual(chapterWinVariant('ch6', {}).prefix, [], '대납이 없었으면 그대로');
});

test('A-3 안전망: 소지금 10만 미만으로 쉬면 다음 편의점 방문은 식사 확정 +5만, 받으면 해제', () => {
  const poor = rest({ ...initialProgress(), money: 99999 });
  assert.equal(poor.flags[SAFETY_NET.flag], true);
  assert.equal(rest(initialProgress()).flags[SAFETY_NET.flag], undefined, '10만 이상이면 없음');
  // 확정: 어떤 난수여도 식사 사건이 뜬다(다른 사건 후보가 있어도)
  const pinned = { ...poor, chapterId: 'ch3' as const, serin: { ...poor.serin, affinity: 9 } };
  for (const seed of [1, 2, 3, 4, 5]) assert.equal(visitSerin(pinned, seededRng(seed)).event?.id, 'meal', `seed ${seed}`);
  const a = applyEvent(pinned, 'meal');
  assert.equal(a.moneyDelta, SAFETY_NET.mealMoney, '안전망 식사는 +5만');
  assert.equal(a.progress.flags[SAFETY_NET.flag], false, '받으면 해제');
  assert.equal(applyEvent(a.progress, 'meal').moneyDelta, MEAL_MONEY, '그다음 식사는 평소 +2만');
});

test('A-4 최악 경로: 0원까지 떨어져도 휴식+식사로 재입장, 5장 첫 항구 판은 대납', () => {
  // 1·2장 판돈 0 → 3장 도착 최소 소지금 = 시작 12만 ≥ 목욕탕 입장 3만
  assert.ok(START_MONEY >= PLACES.bath.stakePerPoint * MIN_STAKE_POINTS);
  // 0원에서 하루 쉬고 식사를 받는 반복으로 입장 금액까지 며칠 걸리나
  const daysTo = (target: number) => {
    let q = { ...initialProgress(), money: 0, serin: { ...initialProgress().serin, seen: ['textbook', 'stock'] } };
    let d = 0;
    while (q.money < target) { q = rest(q); q = applyEvent({ ...q, serin: { ...q.serin, lastVisitDay: q.day, lastEventDay: q.day } }, 'meal').progress; d++; assert.ok(d < 30); }
    return d;
  };
  assert.equal(daysTo(PLACES.bath.stakePerPoint * MIN_STAKE_POINTS), 1, '목욕탕(3만): 하루');
  assert.equal(daysTo(PLACES.market.stakePerPoint * MIN_STAKE_POINTS), 2, '시장(6만): 이틀');
  assert.ok(daysTo(PLACES.harbor.stakePerPoint * MIN_STAKE_POINTS) <= 5, '항구(15만): 최대 닷새');
  // 5장 첫 항구 판은 0원이어도 태오 대납으로 바로 입장(지면 손실 0 → settleStakeStaked)
  assert.ok(canTaeohStake({ ...initialProgress(), chapterId: 'ch5', money: 0 }, 'harbor'));
  // 6장은 돈이 움직이지 않고(noPayout), 7~11장 장 대결은 판돈 0 → 돈 관문 없음
});

test('B 10장 안내: 부적 전에는 ▶ 편의점·초대전 잠김, 관계 분기는 초대전 2·3 사이 편의점', () => {
  let p = { ...initialProgress(), chapterId: 'ch10' as const };
  assert.equal(ch10Pointer(p), 'store', '부적 전 ▶는 편의점');
  assert.ok(!canChallengeGate(p, 1), '부적 전 초대전 1 잠김');
  p = setFlag(p, CHARM_FLAG);
  assert.ok(canChallengeGate(p, 1), '부적 뒤 초대전 1 열림');
  assert.equal(ch10Pointer(p), null, '부적 뒤 ▶는 무대(호텔)');
  assert.equal(routeStep({ ...p, serin: { ...p.serin, affinity: 9 } }), 'none', '초대전 2 전에는 분기 없음');
  p = winGate(winGate(p, 1), 2);
  assert.equal(ch10Pointer(p), 'store', '초대전 2·3 사이 ▶는 편의점');
  assert.equal(routeStep({ ...p, serin: { ...p.serin, affinity: 8 } }), 'ask');
  assert.equal(routeStep({ ...p, serin: { ...p.serin, affinity: 7 } }), 'default');
  assert.ok(canChallengeGate(p, 3), '초대전 3은 분기와 무관하게 열려 있다');
  const asked = setRoute(p, 'slow');
  assert.equal(ch10Pointer(asked), null, '분기 뒤 ▶는 호텔');
  assert.equal(ch10Pointer({ ...asked, chapterId: 'ch11' }), null, '10장에서만');
});

test('C 밤 경과: 장 대결 승리 뒤 하루가 지난다(6장·10·11장 제외), 매일 들르면 영화표 조건(10)에 닿는다', () => {
  for (const id of ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch7', 'ch8', 'ch9'] as const) assert.ok(nightAfterWin(id), id);
  for (const id of ['prologue', 'ch6', 'ch10', 'ch11', 'epilogue'] as const) assert.ok(!nightAfterWin(id), id);
  const r = rest({ ...initialProgress(), focus: 3 });
  assert.equal(r.day, 2); assert.equal(r.focus, r.focusMax);
  // 호감 계산: 2~9장 승리로 최소 8밤이 흐른다. 매일 들르면 방문 +1 + 사건(최소 식사 +1) ⇒ 하루 약 +2
  let p = { ...initialProgress(), chapterId: 'ch3' as const, day: 2 };
  for (let d = 0; d < 8; d++) {
    const v = visitSerin(p, seededRng(d * 17 + 1));
    p = v.event ? applyEvent(v.progress, v.event.id, v.event.choice ? 'decline' : 'none').progress : v.progress;
    p = rest(p);
  }
  assert.ok(p.serin.affinity >= MOVIE_AFFINITY, `매일 방문 8일 호감 ${p.serin.affinity} ≥ ${MOVIE_AFFINITY}`);
  assert.equal(MOVIE_AFFINITY, 10, '요청 11-C: 12 → 10');
  assert.equal(envelopeOf('slow', 10), 'movie');
  assert.equal(envelopeOf('slow', 9), 'letter');
  assert.equal(envelopeOf('distance', 99), 'farewell');
});

test('D 크레딧: 기획·이야기·제작 한 줄, 구현 도구 줄 없음, 도안·글꼴·엔진 출처 유지', () => {
  const texts = CREDITS_SCENES.map(s => s.text).join('\n');
  assert.ok(texts.includes('기획·이야기·제작: jjanghhw22'));
  assert.ok(!texts.includes('Claude'), '구현 도구 줄 제거');
  assert.ok(texts.includes('Marcus Richert') && texts.includes('나눔고딕') && texts.includes('Phaser 3'), '라이선스 출처 유지');
});
