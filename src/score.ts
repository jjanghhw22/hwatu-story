// 기본 점수 계산. 화면 코드와 분리된 순수 함수.
// 확정 규칙(광/열끗/띠/피/고도리/홍단·청단·초단/비삼광/쌍피)만 계산하고
// 고/스톱, 박, 흔들기, 배수 등은 다루지 않는다.
import type { Card, Kind } from './cards.ts';

export const KINDS: readonly Kind[] = ['광', '열끗', '띠', '피'];

export type ScoreOptions = {
  /** 미확정 규칙. 9월 국진을 열끗 대신 쌍피로 계산할지. 기본값 false(열끗). 선택 시점·방식은 서비스 확정 후 결정. */
  gukjinAsPi?: boolean;
};

export type GroupScore = { cards: Card[]; points: number; bonuses: string[] };
export type PiScore = GroupScore & { value: number }; // value: 쌍피를 2장으로 센 피 가치
export type Score = { 광: GroupScore; 열끗: GroupScore; 띠: GroupScore; 피: PiScore; total: number };

/** 획득 패를 광/열끗/띠/피로 나눈다. 옵션에 따라 국진은 피로 이동한다. */
export function groupCards(cards: readonly Card[], opt: ScoreOptions = {}): Record<Kind, Card[]> {
  const g: Record<Kind, Card[]> = { 광: [], 열끗: [], 띠: [], 피: [] };
  for (const c of cards) g[opt.gukjinAsPi && c.gukjin ? '피' : c.kind].push(c);
  return g;
}

/** 피 가치: 쌍피 2, 쌍피로 쓰는 국진 2, 그 외 1. */
export function piValue(piCards: readonly Card[]): number {
  return piCards.reduce((s, c) => s + (c.ssangpi || c.gukjin ? 2 : 1), 0);
}

export function scoreGwang(cards: readonly Card[]): GroupScore {
  const n = cards.length;
  const rain = cards.some(c => c.rainGwang);
  let points = 0; const bonuses: string[] = [];
  if (n >= 5) { points = 15; bonuses.push('오광'); }
  else if (n === 4) { points = 4; bonuses.push('사광'); }
  else if (n === 3) { points = rain ? 2 : 3; bonuses.push(rain ? '비삼광' : '삼광'); }
  return { cards: [...cards], points, bonuses };
}

export function scoreYeol(cards: readonly Card[]): GroupScore {
  const n = cards.length;
  let points = n >= 5 ? n - 4 : 0; const bonuses: string[] = [];
  if (cards.filter(c => c.godori).length === 3) { points += 5; bonuses.push('고도리'); }
  return { cards: [...cards], points, bonuses };
}

export function scoreTti(cards: readonly Card[]): GroupScore {
  const n = cards.length;
  let points = n >= 5 ? n - 4 : 0; const bonuses: string[] = [];
  for (const band of ['홍단', '청단', '초단'] as const) {
    if (cards.filter(c => c.band === band).length === 3) { points += 3; bonuses.push(band); }
  }
  return { cards: [...cards], points, bonuses };
}

export function scorePi(cards: readonly Card[]): PiScore {
  const value = piValue(cards);
  return { cards: [...cards], value, points: value >= 10 ? value - 9 : 0, bonuses: [] };
}

/** 획득 패 전체의 기본 점수. 입력 배열은 변경하지 않는다. */
export function scoreCaptured(cards: readonly Card[], opt: ScoreOptions = {}): Score {
  const g = groupCards(cards, opt);
  const 광 = scoreGwang(g.광), 열끗 = scoreYeol(g.열끗), 띠 = scoreTti(g.띠), 피 = scorePi(g.피);
  return { 광, 열끗, 띠, 피, total: 광.points + 열끗.points + 띠.points + 피.points };
}

/**
 * 고 횟수별 정산 점수(확정 규칙). 화면과 분리된 순수 함수.
 * 0고: 기본 / 1고: 기본+1 / 2고: 기본+2 / 3고 이상: (기본+2) × 2^(고 횟수-2).
 * 예) 기본 10점 → 10 / 11 / 12 / 24 / 48.
 */
export function settlementPoints(base: number, goCount: number): number {
  if (!Number.isInteger(goCount) || goCount < 0) throw new RangeError(`고 횟수가 올바르지 않습니다: ${goCount}`);
  if (goCount === 0) return base;
  if (goCount <= 2) return base + goCount;
  return (base + 2) * 2 ** (goCount - 2);
}

// ---- 박 판정과 정산 내역(확정 규칙). 화면과 분리된 순수 함수. ----
export type BakKind = '피박' | '광박' | '고박';
/** 정산 내역. 판 종료 시 한 번 계산해 결과에 보관한다. */
export type Settlement = {
  base: number;        // 기본 점수
  goCount: number;     // 승자의 고 횟수
  goPoints: number;    // 고 가산·배수를 반영한 점수 = settlementPoints(base, goCount)
  baks: BakKind[];     // 적용된 박
  multiplier: number;  // 박 배수 = 2^(박 수)
  declared: Declared[]; // 승자가 흔들기 또는 폭탄을 선언한 중복 없는 월(종류 기록)
  declMultiplier: number; // 선언 배수 = 2^(선언 월 수)
  final: number;       // 최종 점수 = goPoints × multiplier × declMultiplier
};
/** 흔들기/폭탄 선언 기록. 같은 월에 둘 다 있어도 배수는 한 번만. */
export type DeclKind = '흔들기' | '폭탄';
export type Declared = { month: number; kinds: DeclKind[] };

/**
 * 박 판정.
 * 피박: 승자의 피 점수 1점 이상이고 패자의 피 가치(쌍피·국진 선택 반영)가 1~7. 0은 면제, 8 이상 미적용.
 * 광박: 승자의 광 점수 1점 이상이고 패자의 광 보유 0장(비광도 보유에 포함).
 * 고박: 패자가 이번 판에서 고를 1회 이상 선언. 횟수와 무관하게 한 번만.
 */
export function judgeBak(winner: Score, loser: Score, loserGoCount: number): BakKind[] {
  const baks: BakKind[] = [];
  if (winner.피.points >= 1 && loser.피.value >= 1 && loser.피.value <= 7) baks.push('피박');
  if (winner.광.points >= 1 && loser.광.cards.length === 0) baks.push('광박');
  if (loserGoCount >= 1) baks.push('고박');
  return baks;
}

/**
 * 정산 내역: 고 공식(settlementPoints) → 박 배수(박마다 ×2) → 승자 선언 배수(흔들기 또는 폭탄을 선언한 중복 없는 월마다 ×2) 순으로 곱한다.
 * 예) 기본 10, 2고, 피박·광박 → (10+2)×2×2 = 48. 기본 10, 2고, 피박, 1월 흔들기 후 1월 폭탄 → 12×2×2 = 48(같은 월은 한 번). 다른 월 폭탄이 더해지면 96.
 * 패자의 선언은 반영하지 않는다.
 */
export function settle(base: number, goCount: number, baks: readonly BakKind[], declared: readonly Declared[] = []): Settlement {
  const months = new Set(declared.map(d => d.month));
  if (months.size !== declared.length) throw new RangeError('선언 월이 중복되었습니다.');
  const goPoints = settlementPoints(base, goCount);
  const multiplier = 2 ** baks.length;
  const declMultiplier = 2 ** months.size;
  return { base, goCount, goPoints, baks: [...baks], multiplier, declared: declared.map(d => ({ month: d.month, kinds: [...d.kinds] })), declMultiplier, final: goPoints * multiplier * declMultiplier };
}
