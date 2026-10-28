import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, cardById, kindLabel, type Card } from './cards.ts';
import { scoreCaptured, scoreGwang, scoreYeol, scoreTti, scorePi, groupCards, piValue } from './score.ts';

const by = (f: (c: Card) => boolean) => CARDS.filter(f);
const 광 = by(c => c.kind === '광'), 열끗 = by(c => c.kind === '열끗'), 띠 = by(c => c.kind === '띠'), 피 = by(c => c.kind === '피');
const 비광 = CARDS.find(c => c.rainGwang)!, 국진 = CARDS.find(c => c.gukjin)!;
const 일반광 = 광.filter(c => !c.rainGwang);
const 일반피 = 피.filter(c => !c.ssangpi), 쌍피 = 피.filter(c => c.ssangpi);
const 고도리 = 열끗.filter(c => c.godori), 비고도리열끗 = 열끗.filter(c => !c.godori);
const band = (b: string) => 띠.filter(c => c.band === b);

test('카드 구성: id/월/이름, 11월 오동·12월 비', () => {
  assert.equal(CARDS.length, 48);
  CARDS.forEach((c, i) => { assert.equal(c.id, i); assert.equal(c.month, Math.floor(i / 4) + 1); });
  assert.equal(CARDS[40].name, '오동'); assert.equal(CARDS[44].name, '비');
  assert.throws(() => cardById(48), RangeError);
});

test('분류 장수: 광5 열끗9 띠10 피24, 쌍피2, 피 가치 26', () => {
  assert.deepEqual([광.length, 열끗.length, 띠.length, 피.length], [5, 9, 10, 24]);
  assert.deepEqual(광.map(c => c.month), [1, 3, 8, 11, 12]);
  assert.deepEqual(쌍피.map(c => c.month), [11, 12]);
  assert.equal(piValue(피), 26);
});

test('고도리·홍단·청단·초단·비띠 구성', () => {
  assert.deepEqual(고도리.map(c => c.month), [2, 4, 8]);
  assert.deepEqual(band('홍단').map(c => c.month), [1, 2, 3]);
  assert.deepEqual(band('청단').map(c => c.month), [6, 9, 10]);
  assert.deepEqual(band('초단').map(c => c.month), [4, 5, 7]);
  assert.deepEqual(band('비띠').map(c => c.month), [12]);
  assert.ok(띠.every(c => c.band !== null)); assert.ok(CARDS.filter(c => c.kind !== '띠').every(c => c.band === null));
});

test('비광과 국진은 서로 다른 플래그로 구분된다', () => {
  assert.equal(비광.month, 12); assert.equal(비광.kind, '광'); assert.equal(비광.gukjin, false);
  assert.equal(국진.month, 9); assert.equal(국진.kind, '열끗'); assert.equal(국진.rainGwang, false); assert.equal(국진.ssangpi, false);
  assert.equal(CARDS.filter(c => c.rainGwang).length, 1); assert.equal(CARDS.filter(c => c.gukjin).length, 1);
  assert.equal(kindLabel(비광), '비광'); assert.equal(kindLabel(국진), '열끗·국진');
  assert.equal(kindLabel(cardById(41)), '쌍피'); assert.equal(kindLabel(cardById(4)), '고도리'); assert.equal(kindLabel(cardById(1)), '홍단');
});

test('광: 2장 0점, 삼광 3, 비삼광 2, 사광 4(비광 포함도 4), 오광 15', () => {
  assert.equal(scoreGwang([]).points, 0);
  assert.equal(scoreGwang(일반광.slice(0, 2)).points, 0);
  assert.equal(scoreGwang([비광, 일반광[0]]).points, 0);
  assert.deepEqual([scoreGwang(일반광.slice(0, 3)).points, scoreGwang(일반광.slice(0, 3)).bonuses], [3, ['삼광']]);
  assert.deepEqual([scoreGwang([비광, ...일반광.slice(0, 2)]).points, scoreGwang([비광, ...일반광.slice(0, 2)]).bonuses], [2, ['비삼광']]);
  assert.equal(scoreGwang(일반광).points, 4);
  assert.equal(scoreGwang([비광, ...일반광.slice(0, 3)]).points, 4);
  assert.equal(scoreGwang(광).points, 15);
});

test('열끗: 4장 0점, 5장 1점, 9장 5점, 고도리 +5', () => {
  assert.equal(scoreYeol(비고도리열끗.slice(0, 4)).points, 0);
  assert.equal(scoreYeol(비고도리열끗.slice(0, 5)).points, 1);
  assert.equal(scoreYeol(비고도리열끗).points, 2); // 6장
  assert.deepEqual([scoreYeol(고도리).points, scoreYeol(고도리).bonuses], [5, ['고도리']]);
  assert.equal(scoreYeol(고도리.slice(0, 2)).points, 0);
  assert.equal(scoreYeol([...고도리, ...비고도리열끗.slice(0, 2)]).points, 6); // 5장 1 + 고도리 5
  assert.equal(scoreYeol(열끗).points, 5 + 5); // 9장
});

test('띠: 4장 0점, 5장 1점, 홍단/청단/초단 각 +3, 비띠는 단에 포함되지 않음', () => {
  const 홍 = band('홍단'), 청 = band('청단'), 초 = band('초단'), 비 = band('비띠');
  assert.equal(scoreTti([...홍.slice(0, 2), ...청.slice(0, 2)]).points, 0);
  assert.equal(scoreTti([...홍.slice(0, 2), ...청.slice(0, 2), ...비]).points, 1);
  assert.deepEqual([scoreTti(홍).points, scoreTti(홍).bonuses], [3, ['홍단']]);
  assert.equal(scoreTti([...홍, ...청]).points, 3 + 3 + 2); // 6장
  assert.equal(scoreTti([...홍, ...청, ...초]).points, 9 + 5); // 9장
  assert.equal(scoreTti(띠).points, 9 + 6); // 10장
  assert.equal(scoreTti([...홍.slice(0, 2), ...비]).bonuses.length, 0);
});

test('피: 가치 9 → 0점, 10 → 1점, 쌍피는 2장 가치, 전부 26 → 17점', () => {
  assert.equal(scorePi(일반피.slice(0, 9)).points, 0);
  assert.equal(scorePi(일반피.slice(0, 10)).points, 1);
  assert.equal(scorePi(일반피.slice(0, 11)).points, 2);
  const s = scorePi([...일반피.slice(0, 8), 쌍피[0]]);
  assert.deepEqual([s.cards.length, s.value, s.points], [9, 10, 1]);
  assert.equal(scorePi([...일반피.slice(0, 7), 쌍피[0]]).points, 0); // 가치 9
  assert.deepEqual([scorePi(피).value, scorePi(피).points], [26, 17]);
});

test('국진: 기본은 열끗, 옵션 시 쌍피(가치 2)로 이동', () => {
  const hand = [국진, ...비고도리열끗.filter(c => !c.gukjin).slice(0, 4), ...일반피.slice(0, 8)];
  const d = scoreCaptured(hand);
  assert.deepEqual([d.열끗.cards.length, d.열끗.points, d.피.value, d.피.points, d.total], [5, 1, 8, 0, 1]);
  const p = scoreCaptured(hand, { gukjinAsPi: true });
  assert.deepEqual([p.열끗.cards.length, p.열끗.points, p.피.cards.length, p.피.value, p.피.points, p.total], [4, 0, 9, 10, 1, 1]);
  assert.ok(p.피.cards.includes(국진)); assert.ok(!p.열끗.cards.includes(국진));
  assert.equal(groupCards([비광], { gukjinAsPi: true }).광.length, 1); // 비광은 옵션과 무관
});

test('합계와 불변성', () => {
  assert.equal(scoreCaptured([]).total, 0);
  const all = [...CARDS];
  const s = scoreCaptured(all);
  assert.deepEqual([s.광.points, s.열끗.points, s.띠.points, s.피.points, s.total], [15, 10, 15, 17, 57]);
  assert.equal(all.length, 48);
  const input = [비광, 국진];
  scoreCaptured(input, { gukjinAsPi: true });
  assert.deepEqual(input.map(c => c.id), [비광.id, 국진.id]);
  assert.ok(Object.isFrozen(CARDS[0]));
});

import { settlementPoints } from './score.ts';
test('고 횟수별 정산 공식: 0고 기본, 1고 +1, 2고 +2, 3고 이상 (기본+2)×2^(고-2)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(n => settlementPoints(10, n)), [10, 11, 12, 24, 48]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(n => settlementPoints(7, n)), [7, 8, 9, 18, 36, 72]);
  assert.throws(() => settlementPoints(7, -1), RangeError);
  assert.throws(() => settlementPoints(7, 1.5), RangeError);
});

import { judgeBak, settle } from './score.ts';
test('judgeBak: 피박(피 가치 1~7)·광박(광 0장)·고박(고 1회 이상)', () => {
  const win = scoreCaptured([...일반광.slice(0, 3), ...일반피.slice(0, 13)]); // 광 3점, 피 4점
  assert.deepEqual(judgeBak(win, scoreCaptured([]), 0), ['광박']);                       // 피 0 면제
  assert.deepEqual(judgeBak(win, scoreCaptured(일반피.slice(13, 14)), 0), ['피박', '광박']);
  assert.deepEqual(judgeBak(win, scoreCaptured(일반피.slice(13, 20)), 0), ['피박', '광박']); // 7
  assert.deepEqual(judgeBak(win, scoreCaptured(일반피.slice(13, 21)), 0), ['광박']);         // 8
  assert.deepEqual(judgeBak(win, scoreCaptured([비광]), 0), []);                             // 비광도 광 보유
  assert.deepEqual(judgeBak(win, scoreCaptured([비광]), 2), ['고박']);
  assert.deepEqual(judgeBak(scoreCaptured(일반광.slice(0, 3)), scoreCaptured(일반피.slice(0, 3)), 1), ['광박', '고박']); // 승자 피 0점 → 피박 없음
  // 국진 쌍피 선택: 피 6 + 국진(2) = 8 → 피박 아님, 열끗이면 6 → 피박
  assert.ok(!judgeBak(win, scoreCaptured([...일반피.slice(13, 19), 국진], { gukjinAsPi: true }), 0).includes('피박'));
  assert.ok(judgeBak(win, scoreCaptured([...일반피.slice(13, 19), 국진]), 0).includes('피박'));
});
test('settle: 고 공식 결과에 박마다 ×2', () => {
  assert.deepEqual(settle(10, 2, ['피박', '광박']), { base: 10, goCount: 2, goPoints: 12, baks: ['피박', '광박'], multiplier: 4, declared: [], declMultiplier: 1, final: 48 });
  assert.deepEqual(settle(7, 0, []), { base: 7, goCount: 0, goPoints: 7, baks: [], multiplier: 1, declared: [], declMultiplier: 1, final: 7 });
  // 선언 배수: 고 → 박 → 선언(중복 없는 월 수) 순. 예) 기본 10, 2고, 피박, 1월 흔들기 후 1월 폭탄 = 12×2×2 = 48
  const sb = settle(10, 2, ['피박'], [{ month: 1, kinds: ['흔들기', '폭탄'] }]);
  assert.deepEqual([sb.goPoints, sb.multiplier, sb.declMultiplier, sb.final], [12, 2, 2, 48]);
  assert.equal(settle(10, 2, ['피박'], [{ month: 1, kinds: ['흔들기', '폭탄'] }, { month: 3, kinds: ['폭탄'] }]).final, 96); // 다른 월 폭탄 추가
  assert.equal(settle(10, 2, ['피박', '광박'], [{ month: 1, kinds: ['흔들기'] }, { month: 2, kinds: ['흔들기'] }]).final, 192); // 12×4×4
  assert.equal(settle(7, 0, [], [{ month: 1, kinds: ['흔들기'] }, { month: 2, kinds: ['폭탄'] }, { month: 3, kinds: ['흔들기'] }]).final, 56);
  assert.throws(() => settle(7, 0, [], [{ month: 1, kinds: ['흔들기'] }, { month: 1, kinds: ['폭탄'] }]), RangeError); // 중복 월은 거부
  assert.equal(settle(10, 3, ['고박']).final, 48); // 24 × 2
  assert.equal(settle(10, 2, ['피박', '광박', '고박']).final, 96);
});
