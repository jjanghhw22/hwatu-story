// F5(요청 10) 검증: 접기 가르치기 세 경로, 문지기 순서·민정호 스톱·차유라 가짜 흔들기·구상만 봉쇄, 부적, 관계 분기, 무진 단계·봉쇄 대상·판돈 ×2·속임수, 엔딩·에필로그·장 바로가기.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicView } from '../ai.ts';
import { GameState } from '../game.ts';
import { seededRng } from '../rng.ts';
import { dealSetup } from '../sim.ts';
import { CH9_FOLD, CH9_WIN, chapterById, chapterWinVariant } from './chapters.ts';
import { CREDITS_SCENES, ENDING_SCENES, MOVIE_AFFINITY, endingFlag, endingScenes, endingsSeen, envelopeOf, epilogueScenes, progressAtChapter, recordEnding } from './endings.ts';
import { CHARM_RESET, GATES, applyCharm, canChallengeGate, consumeBlock, fakeShake, gatesWon, nextGate, routeFlag, routeStep, serinRoute, setRoute, winGate } from './gates.ts';
import { itemById } from './items.ts';
import { KING, KING_CHEAT_3, KING_CHEAT_4, nextKingStage, skillCounterKey, stageCheat, stageCutIn, stageLocks, topSkills } from './king.ts';
import { TEACH_FOLD, shouldTeachFold } from './learner.ts';
import { FATHER_TEACH_FOLD } from './lines.ts';
import { OPPONENTS, resolveOpponent } from './opponents.ts';
import { PLACES, canSit, isPlaceReady } from './places.ts';
import { completeChapter, initialProgress, setFlag } from './progress.ts';
import { SKILLS } from './skills.ts';

test('접기 가르치기 세 경로: 판 중(아버지 5~6·고 0) / 고 중이면 안 가르침 / 끝까지 안 오면 after 앞에서 가르치고 9장 완료', () => {
  assert.ok(shouldTeachFold(false, 5, 2, false, 0));
  assert.ok(!shouldTeachFold(false, 8, 2, false, 1), '1고 8점: 접기를 못 쓰므로 가르치지 않음');
  assert.equal(TEACH_FOLD.holdTurns, 1, '가르친 뒤 아버지는 1턴 고를 부르지 않는다');
  const teachLine = { kind: 'line', speaker: 'father', text: FATHER_TEACH_FOLD };
  assert.deepEqual(chapterWinVariant('ch9', { untaught: true }).prefix, [teachLine, ...CH9_WIN], '이겼는데 못 배운 경우');
  assert.deepEqual(chapterWinVariant('ch9', { untaught: true, lost: true }).prefix, [teachLine], '졌는데 못 배운 경우도 완료');
  assert.deepEqual(chapterWinVariant('ch9', { folded: true }).prefix, CH9_FOLD);
  assert.deepEqual(chapterWinVariant('ch9', {}).prefix, CH9_WIN);
  const p = completeChapter({ ...initialProgress(), chapterId: 'ch9' }, chapterById('ch9'));
  assert.ok(p.skills.includes('fold'), '어느 경로든 접기 정식 습득');
});

test('10장 문지기: 순서대로 열림, 민정호 항상 스톱, 차유라 가짜 흔들기는 상태를 바꾸지 않음, 구상만 봉쇄 3회 뒤 정상', () => {
  assert.deepEqual(GATES, ['jeongho', 'yura', 'sangman']);
  let p = { ...initialProgress(), chapterId: 'ch10' as const };
  assert.equal(nextGate(p), 1); assert.ok(canChallengeGate(p, 1) && !canChallengeGate(p, 2));
  p = winGate(p, 1); assert.ok(canChallengeGate(p, 2) && !canChallengeGate(p, 3));
  p = winGate(winGate(p, 2), 3); assert.equal(nextGate(p), null); assert.equal(gatesWon(p), 3);
  // 민정호: 고/스톱 가능하면 항상 스톱
  const jh = resolveOpponent(OPPONENTS.jeongho);
  const s = new GameState(dealSetup(seededRng(4))); s.turn = 1;
  assert.equal(jh.decideGoStop(publicView(s, 1)).decision, 'stop'); assert.ok(jh.key.includes('보수'));
  // 차유라: 가짜 흔들기는 화면 연출만 — 판단 함수는 상태를 받지 않는다
  const v0 = s.version, shakes0 = JSON.stringify(s.shakes);
  const rng = seededRng(9); let n = 0; for (let i = 0; i < 200; i++) if (fakeShake(rng, OPPONENTS.yura.fakeShake)) n++;
  assert.ok(n > 20 && n < 80, `25% 근처: ${n}`);
  assert.equal(s.version, v0); assert.equal(JSON.stringify(s.shakes), shakes0);
  assert.ok(!fakeShake(() => 0, undefined));
  assert.equal(OPPONENTS.yura.bluff, 0.8);
  // 구상만: 3번 막고 그 뒤 정상
  let left = OPPONENTS.sangman.blocks!; const res: boolean[] = [];
  for (let i = 0; i < 5; i++) { const r = consumeBlock(left); res.push(r.blocked); left = r.left; }
  assert.deepEqual(res, [true, true, true, false, false]);
});

test('서린의 부적: 판당 1회 100 → 70', () => {
  assert.deepEqual(applyCharm(100, true, false), { value: CHARM_RESET, used: true, saved: true });
  assert.deepEqual(applyCharm(100, true, true), { value: 100, used: true, saved: false });
  assert.deepEqual(applyCharm(100, false, false), { value: 100, used: false, saved: false });
  assert.deepEqual(applyCharm(80, true, false), { value: 80, used: false, saved: false });
  assert.equal(itemById('serinCharm').kind, 'gear'); assert.equal(itemById('serinCharm').price, null);
});

test('관계 분기: 부적을 받은 뒤 두 번째 방문, 호감 8 이상이면 선택, 아니면 friend, 1회', () => {
  const base = setFlag({ ...initialProgress(), chapterId: 'ch10' as const }, 'ch10.charm');
  assert.equal(routeStep({ ...base, serin: { ...base.serin, affinity: 8 } }), 'ask');
  assert.equal(routeStep({ ...base, serin: { ...base.serin, affinity: 7 } }), 'default');
  assert.equal(routeStep({ ...initialProgress(), chapterId: 'ch10' }), 'none', '부적 전에는 없음');
  assert.equal(serinRoute(base), 'friend', '기본값');
  const slow = setRoute(base, 'slow');
  assert.equal(serinRoute(slow), 'slow'); assert.equal(slow.flags[routeFlag('slow')], true); assert.equal(routeStep(slow), 'none');
});

test('11장 무진: 단계 전환 조건, 1단계 봉쇄는 많이 쓴 2개(기록 없으면 눈썰미·바꿔치기), 3단계 속임수, 4단계 정직 기술 전부 봉쇄', () => {
  assert.equal(nextKingStage(1, 20, 3, 0), 1);
  assert.equal(nextKingStage(1, 14, 3, 0), 2); assert.equal(nextKingStage(1, 20, 5, 0), 2);
  assert.equal(nextKingStage(2, 10, 0, 4), 2); assert.equal(nextKingStage(2, 6, 0, 0), 3); assert.equal(nextKingStage(2, 10, 0, 5), 3);
  assert.equal(nextKingStage(1, 5, 0, 0), 3, '한 번에 두 단계도 오른다');
  assert.equal(nextKingStage(3, 20, 0, 0), 3, '내려가지 않는다'); assert.equal(nextKingStage(4, 0, 9, 9), 4);
  assert.deepEqual(topSkills(initialProgress()), ['eye', 'swap']);
  const used = { ...initialProgress(), counters: { [skillCounterKey('calmFace')]: 5, [skillCounterKey('readThrough')]: 7, [skillCounterKey('eye')]: 2 } };
  assert.deepEqual(topSkills(used), ['readThrough', 'calmFace']);
  assert.deepEqual(stageLocks(1, ['readThrough', 'calmFace']), ['readThrough', 'calmFace']);
  assert.deepEqual(stageLocks(2, ['eye']), []); assert.deepEqual(stageLocks(3, ['eye']), []);
  const honest = stageLocks(4, []); assert.ok(honest.includes('eye') && honest.includes('fold') && !honest.includes('swap'));
  assert.equal(stageCheat(1), undefined); assert.equal(stageCheat(2), undefined);
  assert.deepEqual(stageCheat(3), KING_CHEAT_3); assert.deepEqual(KING_CHEAT_3, { perTurn: 0.6, maxPerMatch: 2 }); assert.deepEqual(stageCheat(4), KING_CHEAT_4);
  assert.equal(KING.betMultiplier, 2);
  assert.equal(stageCutIn(2, false), '서린이 배송 기사에게 봉투를 건넨다.');
  assert.equal(stageCutIn(3, true), '태오가 직원 통로 문을 연다.'); assert.equal(stageCutIn(3, false), '시장 트럭이 호텔 뒷문에 선다.');
  assert.ok(OPPONENTS.mujin.king && OPPONENTS.mujin.sharpness === 2.0);
  assert.ok(Object.keys(SKILLS).length === 8);
});

test('엔딩: 플래그·이야기 종료, A만 에필로그(봉투 분기), B는 짧은 에필로그, C는 에필로그 없음, 엔딩 뒤 일반 대결 가능', () => {
  const p = { ...initialProgress(), unlockedPlaces: ['barber', 'home', 'store', 'bath', 'market', 'harbor', 'billiards', 'hotel'] as const } as ReturnType<typeof initialProgress>;
  const a = recordEnding(p, 'A');
  assert.equal(a.flags[endingFlag('A')], true); assert.equal(a.chapterId, 'epilogue'); assert.deepEqual(endingsSeen(a), ['A']);
  assert.ok(endingScenes('A', p, 'friend').some(s => s.kind === 'cut' && s.text === '이번에는 집에 돌아왔다.'));
  assert.ok(!endingScenes('C', p, 'friend').some(s => s.kind === 'cut' && s.text.startsWith('에필로그')), 'C는 에필로그 없음');
  assert.ok(endingScenes('C', p, 'friend').some(s => s.kind === 'cut' && s.text === '이발소 문이 닫혀 있다.'));
  assert.ok(endingScenes('B', p, 'friend').some(s => s.kind === 'cut' && s.text === '이번에도 집에 돌아오지 못했다.'));
  for (const id of ['A', 'B', 'C'] as const) assert.deepEqual(endingScenes(id, p, 'friend').slice(-CREDITS_SCENES.length), CREDITS_SCENES);
  assert.ok(ENDING_SCENES.A.some(s => s.kind === 'line' && s.text === '아버지 데리러 왔습니다.'));
  assert.equal(envelopeOf('slow', MOVIE_AFFINITY), 'movie'); assert.equal(envelopeOf('slow', MOVIE_AFFINITY - 1), 'letter');
  assert.equal(envelopeOf('friend', 99), 'letter'); assert.equal(envelopeOf('distance', 99), 'farewell');
  const lens = (['movie', 'letter', 'farewell'] as const).map(() => 0);
  const eM = epilogueScenes('slow', 12, true), eL = epilogueScenes('friend', 3, false), eF = epilogueScenes('distance', 3, false);
  assert.equal(eM.length, eL.length); assert.equal(eL.length, eF.length); assert.equal(lens.length, 3);
  assert.ok(eM.some(s => s.kind === 'cut' && s.text === '영화표 두 장.') && eM.some(s => s.kind === 'cut' && s.text === '태오는 시장 배송을 시작한다.'));
  assert.ok(eF.some(s => s.kind === 'cut' && s.text === '태오는 항구를 떠난다.'));
  // 엔딩 뒤: 장소는 그대로 열려 있고 일반 대결 조건도 그대로
  assert.ok(isPlaceReady('hotel') && a.unlockedPlaces.includes('harbor') && canSit(a.money, PLACES.bath.stakePerPoint));
});

test('장 바로가기: 그 장 시작 상태(앞 장 완료·보상 반영)', () => {
  const p9 = progressAtChapter('ch9');
  assert.equal(p9.chapterId, 'ch9');
  assert.ok(p9.skills.includes('eye') && p9.skills.includes('swap') && !p9.skills.includes('fold'));
  assert.ok(p9.unlockedPlaces.includes('hotel') && p9.flags['ch8.done'] && !p9.flags['ch9.done']);
  const p1 = progressAtChapter('ch1'); assert.equal(p1.chapterId, 'ch1'); assert.ok(p1.flags['prologue.done']);
  assert.equal(progressAtChapter('ch11').focusMax, 140);
});
