// 상대 속임수(7장 뱀눈, 11장 백무진에서 재사용)와 간파·진동 손목시계. 순수 함수.
// 속임수 = 상대 차례 시작 때 rng로 정하고, 상대 손패 중 바닥과 맞지 않는 패 1장을 더미 윗장과 바꾼다(GameState.swapHandWithDeck). 고를 패는 공개 정보(AiView)만 본다.
import { type AiView, discardValue } from '../ai.ts';
import type { Card } from '../cards.ts';
import type { Rng } from '../rng.ts';

export type CheatSpec = { perTurn: number; maxPerMatch: number };
/** 잡기 창이 떠 있는 시간(시간 초과 = 모른 척). */
export const CATCH_WINDOW_MS = 2500;

/** 이번 상대 차례에 속임수를 쓰는가: 판당 최대 횟수 안에서 perTurn 확률. */
export function decideCheat(rng: Rng, spec: CheatSpec | undefined, usedThisMatch: number): boolean {
  return !!spec && usedThisMatch < spec.maxPerMatch && rng() < spec.perTurn;
}
/** 바꿔 버릴 패: 바닥과 맞지 않는 손패 중 버려도 덜 아까운 것(discardValue 최소, 동점은 id). 맞지 않는 패가 없으면 null(속임수 안 함). */
export function pickCheatCard(v: AiView): Card | null {
  const cands = v.hand.filter(c => !v.table.some(t => t.month === c.month));
  if (!cands.length) return null;
  return cands.map(c => ({ c, v: discardValue(v, c).value })).sort((a, b) => a.v - b.v || a.c.id - b.c.id)[0].c;
}
/** 속임수가 일어난 순간 무엇을 보여줄지: 간파로 지켜보는 중이면 잡기 창, 아니면 진동 손목시계 경고(판당 1회), 둘 다 아니면 아무것도. */
export function cheatReaction(cheated: boolean, watching: boolean, hasBuzz: boolean, buzzUsed: boolean): 'catch' | 'buzz' | 'none' {
  if (!cheated) return 'none';
  if (watching) return 'catch';
  return hasBuzz && !buzzUsed ? 'buzz' : 'none';
}
