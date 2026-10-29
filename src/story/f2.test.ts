// F2 검증: 상점 해금·가방·아이템 효과·돈·서린 등급/천장·호감, 도발 상태·공격 정책 전환·태연한 얼굴, 래퍼 정책이 공개 정보만 보는 것, 2·3장 완료 조건.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, type Setup } from '../game.ts';
import { publicView } from '../ai.ts';
import { seededRng } from '../rng.ts';
import { dealSetup } from '../sim.ts';
import { chapterById } from './chapters.ts';
import { FLAGS, ITEMS, isItemUnlocked, shopItems } from './items.ts';
import { PLACES, canSit, isPlaceReady } from './places.ts';
import { AFFINITY, MEAL_MONEY, PITY_LIMIT, REWARD_TIERS, SERIN_EVENTS, applyEvent, eventCandidates, isRareOrBetter, rollTier, visitSerin } from './serin.ts';
import { EASY, PROVOKED_MAX_GO, mixedPolicy, provokedPolicy } from './policies.ts';
import { OPPONENTS, resolveOpponent } from './opponents.ts';
import { afterGoStop, calm, markShown, newTauntState, pickTaunt, shouldTaunt } from './taunt.ts';
import { MA_TAUNTS } from './lines.ts';
import { COUNTERS, addMoney, addToBag, bagCount, bump, buyItem, canChallengeMa, completeChapter, deserialize, initialProgress, rest, serialize, settleStake, skillCostWithBoost, takeFromBag, useItemOnMap, withFocus } from './progress.ts';

const ch2 = () => ({ ...initialProgress(), chapterId: 'ch2' as const, unlockedPlaces: ['barber', 'home', 'store'] as const, skills: ['eye'] as const }) as ReturnType<typeof initialProgress>;

test('상점 해금: 처음엔 삼각김밥만, 2장 대화 뒤 캔커피, 재고 정리 뒤 사탕, 첫 휴식 뒤 안대. 가격 없는 것은 진열되지 않는다', () => {
  const p = initialProgress();
  assert.deepEqual(shopItems(p.flags).map(i => i.id), ['riceBall']);
  const f1 = { ...p.flags, [FLAGS.ch2Talked]: true };
  assert.deepEqual(shopItems(f1).map(i => i.id), ['riceBall', 'canCoffee']);
  const f2 = { ...f1, [FLAGS.serinStock]: true, [FLAGS.homeFirstRest]: true };
  assert.deepEqual(shopItems(f2).map(i => i.id), ['riceBall', 'canCoffee', 'glucoseCandy', 'sleepMask']);
  assert.equal(rest(p).flags[FLAGS.homeFirstRest], true);
  for (const it of ITEMS) if (it.price === null) assert.ok(!shopItems({ ...f2, 'ch4.done': true, 'ch3.done': true }).some(x => x.id === it.id), it.id);
  assert.ok(isItemUnlocked(ITEMS[0], {}));
  assert.deepEqual(ITEMS.filter(i => i.price !== null).map(i => [i.id, i.price]), [['riceBall', 1500], ['canCoffee', 2500], ['glucoseCandy', 1200], ['warmLunch', 6000], ['sleepMask', 15000], ['xrayGlasses', 30000], ['blankMask', 8000], ['luckyCoin', 5000], ['buzzWatch', 12000]]);
});

test('가방 증감과 구매: 돈이 모자라면 못 사고, 0개가 되면 키가 사라진다', () => {
  let p = initialProgress();
  assert.equal(takeFromBag(p, 'riceBall'), null);
  p = addToBag(p, 'riceBall', 2);
  assert.equal(bagCount(p, 'riceBall'), 2);
  p = takeFromBag(p, 'riceBall')!; p = takeFromBag(p, 'riceBall')!;
  assert.equal(bagCount(p, 'riceBall'), 0); assert.ok(!('riceBall' in p.bag));
  const bought = buyItem(p, 'riceBall')!;
  assert.equal(bought.money, p.money - 1500); assert.equal(bagCount(bought, 'riceBall'), 1);
  assert.equal(buyItem({ ...p, money: 1000 }, 'riceBall'), null);
  assert.equal(buyItem(p, 'hotPack'), null, '가격 없는 물건은 살 수 없다');
  const back = deserialize(serialize(bought))!;
  assert.deepEqual(back.bag, { riceBall: 1 });
});

test('아이템 효과: 삼각김밥 +20(최대치 상한), 캔커피 전부 회복 + 첫 기술 −10 플래그, 사탕은 지도에서 못 씀', () => {
  let p = addToBag(addToBag(withFocus(initialProgress(), 90), 'riceBall', 2), 'canCoffee');
  const r1 = useItemOnMap(p, 'riceBall')!;
  assert.equal(r1.progress.focus, 100); assert.equal(r1.focusDelta, 10); assert.equal(bagCount(r1.progress, 'riceBall'), 1);
  p = withFocus(r1.progress, 30);
  const r2 = useItemOnMap(p, 'canCoffee')!;
  assert.equal(r2.progress.focus, 100); assert.equal(r2.progress.flags[FLAGS.coffeeBoost], true); assert.equal(bagCount(r2.progress, 'canCoffee'), 0);
  assert.equal(useItemOnMap(addToBag(p, 'glucoseCandy'), 'glucoseCandy'), null);
  assert.equal(useItemOnMap(r2.progress, 'canCoffee'), null, '가방에 없으면 못 쓴다');
  assert.equal(skillCostWithBoost(20, true), 10); assert.equal(skillCostWithBoost(5, true), 0); assert.equal(skillCostWithBoost(20, false), 20);
});

test('돈: 0 아래로 내려가지 않고, 판돈 정산은 최종 점수 × 판돈, 입장은 판돈 × 7', () => {
  const p = initialProgress();
  assert.equal(addMoney(p, -200000).progress.money, 0);
  assert.equal(addMoney(p, -200000).applied, -120000);
  assert.equal(addMoney(p, 5000).progress.money, 125000);
  assert.equal(settleStake(12, PLACES.bath.stakePerPoint, true), 120000);
  assert.equal(settleStake(12, 10000, false), -120000);
  assert.equal(settleStake(12, 0, true), 0);
  assert.ok(canSit(70000, 10000) && !canSit(69999, 10000) && canSit(0, 0));
  assert.deepEqual([PLACES.bath, PLACES.market, PLACES.harbor, PLACES.hotel, PLACES.barber, PLACES.home].map(x => x.stakePerPoint), [10000, 20000, 50000, 200000, 0, 0]);
});

test('서린 답례 등급: 확률 합 100, 고정 시드 재현, 천장(10회 미발생 → 희귀 이상 확정)', () => {
  assert.equal(REWARD_TIERS.reduce((s, t) => s + t.percent, 0), 100);
  const rng = seededRng(7);
  const a = Array.from({ length: 50 }, () => rollTier(rng, 0));
  const rng2 = seededRng(7);
  const b = Array.from({ length: 50 }, () => rollTier(rng2, 0));
  assert.deepEqual(a, b);
  for (let i = 0; i < 200; i++) assert.ok(isRareOrBetter(rollTier(seededRng(i), PITY_LIMIT)));
  // 구간 경계: 0 → 일상, 0.55 → 유용, 0.83 → 희귀, 0.95 → 매우 희귀, 0.99 → 특별
  const fixed = (x: number) => () => x;
  assert.deepEqual([0, 0.549, 0.55, 0.83, 0.95, 0.99].map(x => rollTier(fixed(x), 0)), ['common', 'common', 'useful', 'rare', 'veryRare', 'special']);
});

test('서린 방문: 호감은 하루 1회 +1, 돈으로는 오르지 않는다. 사건은 하루 1회, 반복 불가 사건은 한 번만', () => {
  let p = ch2();
  const r1 = visitSerin(p, seededRng(p.day * 1000 + p.serin.visits));
  assert.equal(r1.firstToday, true); assert.equal(r1.progress.serin.affinity, AFFINITY.visit); assert.ok(r1.event?.implemented);
  const r2 = visitSerin(r1.progress, seededRng(99));
  assert.equal(r2.firstToday, false); assert.equal(r2.progress.serin.affinity, AFFINITY.visit); assert.equal(r2.event, undefined, '같은 날 두 번째 방문은 사건 없음');
  // 돈을 아무리 넣어도 호감은 그대로
  const rich = addMoney(r2.progress, 9_000_000).progress;
  assert.equal(rich.serin.affinity, r2.progress.serin.affinity);
  // 다음 날: 다시 +1, 사건 추첨. 반복 불가 사건을 다 겪으면 식사만 남는다
  p = rest(r2.progress);
  const seenAll = { ...p, serin: { ...p.serin, seen: ['textbook', 'stock'] } };
  assert.deepEqual(eventCandidates(seenAll).map(e => e.id), ['meal']);
  const r3 = visitSerin(seenAll, seededRng(1));
  assert.equal(r3.event?.id, 'meal'); assert.equal(r3.progress.serin.affinity, AFFINITY.visit + 1);
  assert.equal(SERIN_EVENTS.filter(e => e.implemented).length, 9);
  assert.equal(SERIN_EVENTS.length, 11);
});

test('서린 사건 효과: 식사는 돈 +20,000·집중력 +20, 교재비는 선택(돈 부족이면 못 빌려줌), 재고 정리는 사탕 해금. pity는 희귀 이상에서 0', () => {
  const p = withFocus(ch2(), 50);
  const meal = applyEvent(p, 'meal');
  assert.equal(meal.moneyDelta, MEAL_MONEY); assert.equal(meal.progress.money, p.money + MEAL_MONEY); assert.equal(meal.progress.focus, 70); assert.equal(meal.progress.serin.affinity, AFFINITY.talk);
  const lend = applyEvent(p, 'textbook', 'accept');
  assert.equal(lend.moneyDelta, -50000); assert.equal(lend.progress.flags['serin.textbookOwed'], true); assert.equal(lend.progress.serin.affinity, AFFINITY.talkBig);
  const poor = applyEvent({ ...p, money: 1000 }, 'textbook', 'accept');
  assert.equal(poor.moneyDelta, 0); assert.equal(poor.progress.money, 1000);
  const decline = applyEvent(p, 'textbook', 'decline');
  assert.equal(decline.moneyDelta, 0); assert.equal(decline.progress.serin.affinity, AFFINITY.talk);
  const stock = applyEvent(p, 'stock');
  assert.equal(stock.progress.flags[FLAGS.serinStock], true);
  // 천장: pity 10인 상태의 방문은 희귀 이상 → pity 0 + 고물상 소개 플래그
  const pity = { ...p, serin: { ...p.serin, pity: PITY_LIMIT } };
  const v = visitSerin(pity, seededRng(3));
  assert.ok(v.tier && isRareOrBetter(v.tier)); assert.equal(v.progress.serin.pity, 0); assert.equal(v.progress.flags[FLAGS.serinJunk], true);
});

test('2장·3장 완료 조건과 보정: 1장 끝에 편의점이 열리고, 2장(밤차 승리)은 목욕탕·보상 없음, 3장은 태연한 얼굴·시장(구현 전이라 지도에서는 잠김)', () => {
  const p1 = completeChapter({ ...initialProgress(), chapterId: 'ch1' }, chapterById('ch1'));
  assert.deepEqual(p1.unlockedPlaces, ['barber', 'home', 'store']);
  const c2 = chapterById('ch2');
  assert.equal(c2.opponentId, 'bamcha'); assert.equal(c2.rewardSkill, undefined);
  assert.ok(c2.scenes.before.some(s => s.kind === 'line' && s.text === '저 아저씨 심심해 죽어. 한 판 쳐 줘.'));
  assert.ok(c2.scenes.after.some(s => s.kind === 'line' && s.text === '마 사장? 목욕탕 뒤에서 하는 사람.'));
  const p2 = completeChapter(p1, c2);
  assert.equal(p2.chapterId, 'ch3'); assert.ok(p2.unlockedPlaces.includes('bath')); assert.deepEqual(p2.skills, ['eye'], '2장은 보상 기술 없음');
  assert.ok(isPlaceReady('bath') && isPlaceReady('market'));
  // 3장 입장: 목욕탕 2승 + 3장이 현재
  assert.ok(!canChallengeMa(p2));
  const w2 = bump(bump(p2, COUNTERS.bathWins), COUNTERS.bathWins);
  assert.ok(canChallengeMa(w2));
  assert.ok(!canChallengeMa({ ...w2, chapterId: 'ch2' }));
  const p3 = completeChapter(w2, chapterById('ch3'));
  assert.deepEqual(p3.skills, ['eye', 'calmFace']); assert.ok(p3.unlockedPlaces.includes('market')); assert.equal(p3.chapterId, 'ch4');
  assert.ok(p3.flags['ch3.done'] && isItemUnlocked(ITEMS.find(i => i.id === 'blankMask')!, p3.flags));
  // 예전 저장(2장인데 편의점이 안 열림)은 불러올 때 무대가 열린다
  const old = deserialize(JSON.stringify({ ...initialProgress(), chapterId: 'ch2', unlockedPlaces: ['barber', 'home'] }))!;
  assert.ok(old.unlockedPlaces.includes('store'));
  assert.deepEqual(old.serin, initialProgress().serin); assert.deepEqual(old.bag, {});
});

test('도발: 도발형 상대만, 판당 1회, 고를 외치면 provoked, 스톱이면 그대로, 태연한 얼굴로 차단', () => {
  const ma = OPPONENTS.ma, barber = OPPONENTS.barber;
  let st = newTauntState();
  assert.ok(shouldTaunt(ma, st) && !shouldTaunt(barber, st));
  st = markShown(st);
  assert.ok(!shouldTaunt(ma, st), '판당 1회');
  assert.equal(afterGoStop(st, 'stop', true).provoked, false);
  assert.equal(afterGoStop(st, 'go', false).provoked, false, '도발이 없던 고는 반응이 아니다');
  const provoked = afterGoStop(st, 'go', true);
  assert.equal(provoked.provoked, true);
  const calmed = calm(newTauntState());
  assert.ok(!shouldTaunt(ma, calmed));
  assert.ok(MA_TAUNTS.length === 4 && MA_TAUNTS.includes('한기석 아들이 이렇게 겁이 많았나?'));
  assert.ok(MA_TAUNTS.includes(pickTaunt(MA_TAUNTS, seededRng(2))));
  assert.equal(ma.taunts, MA_TAUNTS);
});

test('고 후 정책 전환: provoked면 기본 7점 이상에서 2고까지 고, 아니면 원래 정책(최대 1고)', () => {
  let flag = false;
  const base = resolveOpponent(OPPONENTS.ma);
  const opp = provokedPolicy(base, () => flag);
  const s = new GameState(dealSetup(seededRng(21))); s.turn = 1;
  // 상대(1)에게 기본 7점을 준다: 삼광(비광 제외) 3점 + 띠 5장(홍단 3 포함) 1점 + 홍단 3점 = 7점. 더미·손패 어디서든 가져와 획득패에 넣는다
  const take = (pred: (c: { kind: string; band: string | null; rainGwang: boolean }) => boolean, n: number) => {
    const piles = [s.deck, s.hands[0], s.hands[1], s.table];
    const picked = piles.flat().filter(c => pred(c)).slice(0, n);
    for (const c of picked) { for (const pile of piles) { const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1); } s.captured[1].push(c); }
  };
  take(c => c.kind === '광' && !c.rainGwang, 3); take(c => c.kind === '띠' && c.band === '홍단', 3); take(c => c.kind === '띠' && c.band !== '홍단', 2);
  assert.ok(s.baseScore(1) >= 7, `기본 점수 ${s.baseScore(1)}`);
  const v = publicView(s, 1);
  assert.equal(opp.decideGoStop(v).decision, base.decideGoStop(v).decision, '도발 전에는 원래 정책');
  flag = true;
  assert.equal(opp.decideGoStop(v).decision, 'go');
  assert.equal(opp.decideGoStop({ ...v, myGo: 1 }).decision, 'go', '2고까지');
  assert.equal(opp.decideGoStop({ ...v, myGo: PROVOKED_MAX_GO }).decision, base.decideGoStop({ ...v, myGo: PROVOKED_MAX_GO }).decision, '2고 뒤에는 원래 정책');
  assert.equal(opp.decideGoStop({ ...v, hand: [], myFlipChances: 0 }).decision, 'stop', '마지막 행동이면 고 없음');
  assert.ok(opp.key.includes('도발'));
});

test('래퍼 정책(쉬움·도발)은 공개 정보만 본다: 공개 정보가 같고 사용자 손패·더미만 다르면 같은 판단', () => {
  const a = dealSetup(seededRng(11));
  const b: Setup = { hands: [[...a.deck.slice(0, 10)], [...a.hands[1]]], table: [...a.table], deck: [...a.hands[0], ...a.deck.slice(10)].reverse() };
  const sa = new GameState(a), sb = new GameState(b); sa.turn = sb.turn = 1;
  const va = publicView(sa, 1), vb = publicView(sb, 1);
  assert.deepEqual(va, vb);
  for (const seed of [1, 2, 3, 4, 5]) assert.deepEqual(EASY.chooseAction(va, seededRng(seed), 0), EASY.chooseAction(vb, seededRng(seed), 0));
  const prov = provokedPolicy(resolveOpponent(OPPONENTS.ma), () => true);
  assert.deepEqual(prov.decideGoStop(va), prov.decideGoStop(vb));
  assert.deepEqual(prov.chooseAction(va, seededRng(9), 0), prov.chooseAction(vb, seededRng(9), 0));
  // 50:50 섞기: 고정 시드 20턴에서 양쪽 정책이 모두 쓰인다
  const mixed = mixedPolicy({ ...EASY, key: 'A', chooseAction: () => ({ kind: 'flip', reason: 'A' }) }, { ...EASY, key: 'B', chooseAction: () => ({ kind: 'flip', reason: 'B' }) }, 0.5);
  const rng = seededRng(4);
  const reasons = Array.from({ length: 20 }, () => mixed.chooseAction(va, rng, 0).reason);
  assert.ok(reasons.some(r => r.startsWith('A')) && reasons.some(r => r.startsWith('B')));
  assert.equal(resolveOpponent(OPPONENTS.stranger), EASY);
});
