// 속공형 상대(5장 강봉구)의 생각 시간 제한과 태오 도움(5장). 순수 함수: 상태를 바꾸지 않고 "무엇을 자동으로 할지"만 정한다.
import { STRATEGIC, publicView } from '../ai.ts';
import type { GameState } from '../game.ts';
import type { Rng } from '../rng.ts';
import { actionForTap, handDisplay } from '../ui/turnPlan.ts';
import type { OpponentProfile } from './opponents.ts';

/** 화면이 실행하는 행동(TableScene.Action과 같은 모양). */
export type AutoAction = { kind: 'normal'; index: number; shakeMonth?: number; target?: number } | { kind: 'bomb'; month: number } | { kind: 'flip' };

/** 마지막 3초는 붉게 + 1초마다 틱. */
export const TIMER_WARN_MS = 3000;
export function turnLimitMs(profile: Pick<OpponentProfile, 'turnLimitMs'>): number | undefined { return profile.turnLimitMs && profile.turnLimitMs > 0 ? profile.turnLimitMs : undefined; }
/** 시간 초과: 화면 순서(월순)로 가장 왼쪽 손패를 actionForTap 기준으로 낸다. 손패가 없고 기회가 있으면 더미만 뒤집기. 할 것이 없으면 null. */
export function autoAction(state: GameState): AutoAction | null {
  const first = handDisplay(state, 0).find(sl => sl.kind === 'card');
  if (first && first.kind === 'card') return actionForTap(state, 0, first.index);
  return state.canFlipOnly(0) ? { kind: 'flip' } : null;
}
/** 선택창 시간 초과: 첫 후보. */
export function autoChoice<T>(cands: readonly T[]): T { return cands[0]; }

/**
 * 태오 도움(5장, 판당 1회, 집중력 0): 이번 내 차례 행동을 전략 정책이 대신 고른다. 공개 정보(publicView)만 본다.
 * 전략 정책의 답을 화면 행동으로 바꾼다(폭탄·기회 패·일반, 바닥 2장 선택은 target으로). 손패에 없는 카드를 고르면 null.
 */
export function assistAction(state: GameState, rng: Rng): AutoAction | null {
  const a = STRATEGIC.chooseAction(publicView(state, 0), rng, 0);
  if (a.kind === 'bomb') return state.canBomb(0, a.month) ? { kind: 'bomb', month: a.month } : null;
  if (a.kind === 'flip') return state.canFlipOnly(0) ? { kind: 'flip' } : null;
  const index = state.hands[0].findIndex(c => c.id === a.cardId);
  if (index < 0) return null;
  const base = actionForTap(state, 0, index);
  return base.kind === 'normal' ? { ...base, target: a.targetId } : base;
}

/** 태오 도움 버튼: 5장 동안, 또는 8장에서 받아들인 뒤 9장부터. */
export function taeohAvailable(chapterId: string, flags: Record<string, boolean>): boolean {
  const order = ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9', 'ch10', 'ch11', 'epilogue'];
  return chapterId === 'ch5' || (flags['taeoh.accepted'] === true && order.indexOf(chapterId) >= order.indexOf('ch9'));
}
