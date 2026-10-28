// 도발(3장 마 사장)의 순수 상태. 화면은 고/스톱 창 직전에 shouldTaunt를 묻고, 선택 뒤 afterGoStop으로 갱신한다. 규칙 엔진은 모른다.
import { type Rng, pickIndex } from '../rng.ts';

export type TauntState = {
  /** 이 판에서 도발을 이미 띄웠는지(판당 1회). */
  shown: boolean;
  /** 도발 뒤 플레이어가 고를 외쳤는지 → 상대 고/스톱 정책이 공격적으로 바뀐다. */
  provoked: boolean;
  /** 태연한 얼굴을 써서 남은 도발이 뜨지 않는지. */
  calmed: boolean;
};
export const newTauntState = (): TauntState => ({ shown: false, provoked: false, calmed: false });

/** 고/스톱 창이 뜨기 직전: 도발형 상대이고 아직 안 띄웠고 태연한 얼굴로 막지 않았으면 도발. */
export function shouldTaunt(profile: { taunt?: boolean }, st: TauntState): boolean { return !!profile.taunt && !st.shown && !st.calmed; }
export function markShown(st: TauntState): TauntState { return { ...st, shown: true }; }
/** 선택 뒤: 도발이 떠 있던 상태에서 고를 외치면 provoked. 스톱이면 변화 없음. */
export function afterGoStop(st: TauntState, decision: 'go' | 'stop', tauntedNow: boolean): TauntState {
  return tauntedNow && decision === 'go' ? { ...st, provoked: true } : st;
}
/** 태연한 얼굴: 이번 판 남은 도발이 뜨지 않고 "(도발)" 표시도 없다. 이미 provoked면 되돌리지 않는다. */
export function calm(st: TauntState): TauntState { return { ...st, calmed: true }; }
export function pickTaunt(lines: readonly string[], rng: Rng): string { return lines[pickIndex(rng, lines.length)]; }
