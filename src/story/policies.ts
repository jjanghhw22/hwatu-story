// 상대 정책 래퍼. ai.ts·beginner.ts는 고치지 않고 기존 Opponent 둘을 감싸 성격을 만든다. 모두 공개 정보(AiView)만 보고, 난수는 주입받는다.
import { AI_WEIGHTS, type AiView, type Opponent, STRATEGIC, chooseHandCard } from '../ai.ts';
import { BEGINNER } from '../beginner.ts';
import { scoreCaptured } from '../score.ts';

/** 두 정책을 턴마다 ratio:1−ratio로 섞는다(손패 선택만). 바닥패·국진·고/스톱은 b(전략)의 것을 쓴다. */
export function mixedPolicy(a: Opponent, b: Opponent, ratio = 0.5, key = 'mixed'): Opponent {
  return {
    key,
    chooseAction(v, rng, done) {
      const pickA = rng() < ratio;
      const act = pickA ? a.chooseAction(v, rng, done) : b.chooseAction(v, rng, done);
      return { ...act, reason: `${pickA ? a.key : b.key} 쪽(${Math.round(ratio * 100)}:${Math.round((1 - ratio) * 100)}): ${act.reason}` };
    },
    chooseFloorTarget: b.chooseFloorTarget,
    chooseGukjin: b.chooseGukjin,
    decideGoStop: b.decideGoStop,
  };
}
/** 보수형(10장 민정호): 상대 조합 저지 ×1.3, 피박·광박 완화 ×2(공개 정보만). */
export const CONSERVATIVE_WEIGHTS = { ...AI_WEIGHTS, block: AI_WEIGHTS.block * 1.3, piBak: AI_WEIGHTS.piBak * 2, gwangBak: AI_WEIGHTS.gwangBak * 2 };
/** 보수형 래퍼: 손패는 보수 가중치로, 고/스톱은 가능하면 항상 스톱. 폭탄·기회 패는 원래 정책. */
export function conservativePolicy(base: Opponent): Opponent {
  return {
    ...base,
    key: `${base.key}+보수`,
    chooseAction(v, rng, done) {
      const a = base.chooseAction(v, rng, done);
      if (a.kind !== 'normal') return a;
      const d = chooseHandCard(v, CONSERVATIVE_WEIGHTS);
      return { kind: 'normal', cardId: d.cardId, targetId: d.targetId, reason: `보수형(저지 ×1.3·박 완화 ×2): ${d.reason}` };
    },
    decideGoStop: () => ({ decision: 'stop', reason: '보수형: 고/스톱 가능하면 항상 스톱' }),
  };
}
/** 쉬운 일반 상대(목욕탕 등): 초보와 전략을 50:50. */
export const EASY: Opponent = mixedPolicy(BEGINNER, STRATEGIC, 0.5, 'easy');

/** 도발에 응한 뒤(플레이어가 고) 상대가 허용하는 최대 고 횟수. */
export const PROVOKED_MAX_GO = 2;
/**
 * 도발형 래퍼: provoked()가 true면 자기 기본 점수 7점 이상일 때 PROVOKED_MAX_GO까지 고(공격적), 아니면 원래 정책.
 * 규칙 함수(canDecide/canGo)가 허용한 뒤에만 불리므로 규칙은 그대로다.
 */
export function provokedPolicy(base: Opponent, provoked: () => boolean, maxGo: number = PROVOKED_MAX_GO): Opponent {
  return {
    ...base,
    key: `${base.key}+도발`,
    decideGoStop(v: AiView) {
      if (provoked()) {
        const myRemaining = v.hand.length + v.myFlipChances;
        const myBase = scoreCaptured(v.myCaptured, { gukjinAsPi: v.gukjinAsPi }).total;
        if (myRemaining > 0 && myBase >= 7 && v.myGo < maxGo) return { decision: 'go', reason: `공격적 정책으로 ${v.myGo + 1}고(최대 ${maxGo}고)` };
      }
      return base.decideGoStop(v);
    },
  };
}
