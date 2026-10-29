// 8장 태오(학습형)와 9장 아버지(조급 유도·손패 읽기·접기 가르치기), 회중시계. 순수 함수.
import { AI_WEIGHTS, type Opponent, chooseHandCard } from '../ai.ts';
import type { Card } from '../cards.ts';
import type { GameState } from '../game.ts';
import { type Rng, pickIndex } from '../rng.ts';
import { SKILLS, type SkillId } from './skills.ts';

// ---- 학습형(태오) ----
/** 같은 기술을 이만큼 쓰면 그 판에서 잠긴다("읽혔다"). */
export const LEARN_LOCK_AFTER = 2;
export function isSkillRead(uses: Partial<Record<SkillId, number>>, id: SkillId): boolean { return (uses[id] ?? 0) >= LEARN_LOCK_AFTER; }
/** 방금 쓴 사용으로 잠기게 됐는가(말풍선 "그거 또 쓸 줄 알았어." 시점). */
export function justRead(usesAfter: Partial<Record<SkillId, number>>, id: SkillId): boolean { return (usesAfter[id] ?? 0) === LEARN_LOCK_AFTER; }
export type CaptureKind = '광' | '열끗' | '띠' | '피';
/** 내 차례마다 먹은 분류 집합의 기록에서, 최근 3턴 연속 들어 있는 분류(없으면 null). */
export function captureStreak(history: readonly (readonly CaptureKind[])[], n = 3): CaptureKind | null {
  if (history.length < n) return null;
  const last = history.slice(-n);
  for (const k of ['광', '열끗', '띠', '피'] as const) if (last.every(turn => turn.includes(k))) return k;
  return null;
}
/** 저지 강화 가중치: 상대 조합 저지 ×1.5(공개 정보만으로 평가). */
export const LEARNER_WEIGHTS = { ...AI_WEIGHTS, block: AI_WEIGHTS.block * 1.5 };
/** 학습형 래퍼: active()면 손패 선택을 저지 강화 가중치로, 아니면 원래 정책. 폭탄·기회 패는 원래 정책. */
export function learnerPolicy(base: Opponent, active: () => boolean): Opponent {
  return {
    ...base,
    key: `${base.key}+학습`,
    chooseAction(v, rng, done) {
      const a = base.chooseAction(v, rng, done);
      if (!active() || a.kind !== 'normal') return a;
      const d = chooseHandCard(v, LEARNER_WEIGHTS);
      return { kind: 'normal', cardId: d.cardId, targetId: d.targetId, reason: `학습형(저지 ×1.5): ${d.reason}` };
    },
  };
}

// ---- 아버지 ----
/** 조급 유도: 7점이면 거의 항상 고, 최대 3고. */
export const FATHER_MAX_GO = 3;
/** 손패 읽기 말풍선은 아버지의 n번째 차례에. */
export const FATHER_READ_TURN = 3;
/** 손패 읽기(이야기 장면이라 비공개 정보 사용을 허용, 이 상대만): 내 실제 손패의 월 하나를 템플릿 {m}에 넣는다. 손패가 비면 null. */
export function fatherRead(myHand: readonly Card[], rng: Rng, templates: readonly string[]): { text: string; month: number } | null {
  if (!myHand.length) return null;
  const month = myHand[pickIndex(rng, myHand.length)].month;
  return { text: templates[pickIndex(rng, templates.length)].replace('{m}', String(month)), month };
}
/**
 * 접기 가르치기: 아직 접기를 안 배웠고, 아버지 기본 점수 5~6이고 아버지가 아직 고를 부르지 않았으며(접기는 상대가 고 중이면 못 쓴다) 내 점수가 더 낮은 첫 순간.
 * 아버지는 7점에서 바로 고를 부르므로 7점 이상은 제외한다.
 */
export const TEACH_FOLD = { minBase: 5, maxBase: 6, holdTurns: 1 } as const;
export function shouldTeachFold(learned: boolean, fatherBase: number, myBase: number, shown: boolean, fatherGo = 0): boolean {
  return !learned && !shown && fatherGo === 0 && fatherBase >= TEACH_FOLD.minBase && fatherBase <= TEACH_FOLD.maxBase && myBase < fatherBase;
}
/** 접기 사용 조건: 판 진행 중, 내 차례, 상대가 고를 선언하지 않았을 때. */
export function canFold(s: GameState): boolean { return !s.over && s.currentPlayer === 0 && s.goCount[1] === 0; }

// ---- 회중시계 ----
/** 되돌릴 수 있는 기술: 정직하고 희귀가 아닌 것. */
export function watchRefundable(id: SkillId): boolean { return SKILLS[id].kind === 'honest' && !SKILLS[id].rare; }
/** 이번 판에서 쓴 기술(쓴 순서) 중 가장 최근의 되돌릴 수 있는 것. 남은 횟수가 이미 최대면 건너뛴다. 없으면 null. */
export function pickWatchTarget(usedOrder: readonly SkillId[], uses: readonly { id: SkillId; uses: number }[]): SkillId | null {
  for (let i = usedOrder.length - 1; i >= 0; i--) {
    const id = usedOrder[i], sk = uses.find(x => x.id === id);
    if (sk && watchRefundable(id) && sk.uses < SKILLS[id].usesPerMatch) return id;
  }
  return null;
}
