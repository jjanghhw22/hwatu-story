// 연출 계획용 순수 함수. GameState.place()가 무엇을 가져갈지 상태를 바꾸지 않고 미리 계산한다.
// 규칙은 game.ts가 갖고 있으며, 이 함수는 그 선택 규칙(3장이면 전부, 2장이면 지정한 장 또는 첫 장)을 그대로 따른다.
import { CARDS, type Card } from '../cards.ts';
import type { GameState } from '../game';
import { type Score, type ScoreOptions, judgeBak } from '../score.ts';
import type { Kind } from '../cards';

/**
 * 박 위험 표시용. 상대가 지금 이긴다고 가정해 규칙 계층의 judgeBak(상대 점수, 내 점수, 고 횟수 0)을 호출하고 피박·광박만 걸러 돌려준다.
 * 고박은 세 번째 인자를 0으로 넘겨 제외한다. 규칙을 다시 쓰지 않는다.
 */
export function bakWarnings(state: GameState, player: number): ('피박' | '광박')[] {
  return judgeBak(state.score(1 - player), state.score(player), 0).filter((b): b is '피박' | '광박' => b === '피박' || b === '광박');
}

/** 패 나누기 연출 순서(분배 자체는 GameState 생성자에서 이미 끝났다): 상대 5 → 나 5 → 바닥 4 → 상대 5 → 나 5 → 바닥 4, 각 그룹은 배열 순서대로. */
export type DealStep = { card: Card; to: 'opp' | 'me' | 'floor' };
export function dealOrder(state: GameState): DealStep[] {
  const out: DealStep[] = [];
  const [h0, h1] = state.hands, t = state.table;
  for (let round = 0; round < 2; round++) {
    for (const card of h1.slice(round * 5, round * 5 + 5)) out.push({ card, to: 'opp' });
    for (const card of h0.slice(round * 5, round * 5 + 5)) out.push({ card, to: 'me' });
    for (const card of t.slice(round * 4, round * 4 + 4)) out.push({ card, to: 'floor' });
  }
  return out;
}

/** 점수 계층이 매긴 족보 이름(고도리·홍단·청단·초단·삼광/비삼광·사광·오광). 표시 순서는 광 → 열끗 → 띠. */
export function bonusNames(score: Score): string[] {
  return [...score.광.bonuses, ...score.열끗.bonuses, ...score.띠.bonuses];
}
/** 턴 전후를 비교해 새로 완성된 족보만 돌려준다. 삼광→사광처럼 단계가 바뀌면 새 단계만 나온다. 보유 중인 족보는 반복되지 않는다. */
export function newBonuses(before: Score, after: Score): string[] {
  const prev = new Set(bonusNames(before));
  return bonusNames(after).filter(b => !prev.has(b));
}
/** 족보별 카드(강조용): 광 족보는 광 전부, 고도리는 고도리 열끗, 띠 족보는 그 띠. */
export function bonusCards(score: Score, bonus: string): Card[] {
  if (['삼광', '비삼광', '사광', '오광'].includes(bonus)) return score.광.cards;
  if (bonus === '고도리') return score.열끗.cards.filter(c => c.godori);
  return score.띠.cards.filter(c => c.band === bonus);
}
/**
 * 족보 완성 직전 힌트. 내 획득패·내 손패·공개된 바닥패만 보고 "한 장만 더 있으면 완성되는데 그 한 장이 손패나 바닥에 있다"일 때만 돌려준다.
 * 더미·상대 손패는 보지 않는다. 결과: 예) ['고도리 1장', '홍단 1장', '삼광 1장'].
 */
export function nearBonuses(captured: readonly Card[], hand: readonly Card[], table: readonly Card[], opt: ScoreOptions = {}): string[] {
  const have = new Set(captured.map(c => c.id));
  const reachable = new Set([...hand, ...table].map(c => c.id));
  const out: string[] = [];
  const combos: { name: string; ids: number[] }[] = [
    { name: '고도리', ids: CARDS.filter(c => c.godori).map(c => c.id) },
    ...(['홍단', '청단', '초단'] as const).map(b => ({ name: b, ids: CARDS.filter(c => c.band === b).map(c => c.id) })),
  ];
  for (const combo of combos) {
    const missing = combo.ids.filter(id => !have.has(id));
    if (missing.length === 1 && reachable.has(missing[0])) out.push(`${combo.name} 1장`);
  }
  const gwangHave = captured.filter(c => c.kind === '광').length;
  const gwangReach = [...hand, ...table].some(c => c.kind === '광');
  if (gwangHave === 2 && gwangReach) out.push('삼광 1장');
  void opt;
  return out;
}

/** 카드를 냈을 때 바닥에서 함께 가져갈 카드들. 빈 배열이면 바닥에 놓인다. */
export function plannedCapture(state: GameState, card: Card, targetId?: number): Card[] {
  const matches = state.matches(card);
  if (matches.length === 0) return [];
  if (matches.length === 3) return matches;
  return [matches.find(c => c.id === targetId) ?? matches[0]];
}

/** 획득 패 패널에서 이 카드가 들어갈 칸의 분류. 국진은 선택에 따라 피 칸으로 간다. */
export function captureKind(card: Card, opt: ScoreOptions): Kind {
  return opt.gukjinAsPi && card.gukjin ? '피' : card.kind;
}

/**
 * 손패 카드를 눌렀을 때의 행동(프로젝트 조작 방식).
 * ① 그 월이 폭탄 가능(손패 3장·바닥 1장) → 세 장 폭탄.
 * ② 폭탄 불가이고 흔들기 가능(손패 정확히 3장, 아직 그 월로 흔들지 않음) → 자동 흔들기 공개 뒤 누른 카드 한 장 일반 내기(shakeMonth).
 * ③ 그 외 → 누른 카드 한 장 일반 내기. 같은 월 4장은 흔들기·폭탄 어느 쪽도 아니다. 폭탄이 우선이라 한 클릭에 둘이 겹치지 않는다.
 */
export type TapAction = { kind: 'bomb'; month: number } | { kind: 'normal'; index: number; shakeMonth?: number };
export function actionForTap(state: GameState, player: number, index: number): TapAction {
  const card = state.hands[player][index];
  if (!card) throw new RangeError(`손패 index 범위 밖: ${index}`);
  if (state.canBomb(player, card.month)) return { kind: 'bomb', month: card.month };
  if (state.canShake(player, card.month)) return { kind: 'normal', index, shakeMonth: card.month };
  return { kind: 'normal', index };
}

/**
 * 손패 영역 표시 순서: 일반 손패를 월순(같은 월은 id순)으로 정렬하고, 뒤에 "더미만 뒤집기" 기회 패를 남은 기회 수만큼 붙인다.
 * 기회 패는 화면용이며 카드 데이터·덱·획득패·점수에 들어가지 않는다. 개수는 state.flipChances를 그대로 읽어 불일치가 없다.
 */
export type HandSlot = { kind: 'card'; card: Card; index: number } | { kind: 'chance'; n: number };
export function handDisplay(state: GameState, player: number): HandSlot[] {
  const cards = state.hands[player].map((card, index) => ({ kind: 'card' as const, card, index }));
  cards.sort((a, b) => a.card.month - b.card.month || a.card.id - b.card.id);
  const chances = Array.from({ length: Math.max(0, state.flipChances[player]) }, (_, n) => ({ kind: 'chance' as const, n }));
  return [...cards, ...chances];
}
