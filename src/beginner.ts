// 첫 상대 '이발소 주인'용 초보 정책. 전략 AI(src/ai.ts)는 그대로 두고 그 위에 '봐주기'를 얹는다.
// 순수 함수이며 난수는 주입받는다(덱 셔플 난수와 별개). 상대 손패·더미 내용은 AiView에 없으므로 참조할 수 없다.
// 패 배분·더미 순서는 건드리지 않고 플레이어 승리를 강제하지 않는다. 규칙(폭탄·자동 흔들기)은 그대로 실행된다.
import { type AiAction, type AiView, type Opponent, STRATEGIC, bombMonths, captureValue, shakeMonths } from './ai.ts';
import type { Card } from './cards.ts';
import { type Rng, pickIndex } from './rng.ts';

/** 초보 설정(한곳에서 관리). 확률은 0~1. */
export const BEGINNER_CONFIG = {
  /** 초반 = 매 판 자기 행동(일반 내기·폭탄·기회 패 완료 기준) 처음 N회. 흔들기 공개는 세지 않는다. */
  earlyActions: 3,
  /** 초반에 '바닥에서 먹을 수 없는 손패'를 고를 확률(먹을 수 있는 패는 보유). 나머지는 먹을 수 있는 패 중 무작위. */
  earlyHoldProbability: 0.7,
  /** 초반 이후 전략 AI의 최선 행동을 고를 확률. 나머지는 합법적인 손패 중 무작위. */
  lateBestProbability: 0.3,
};
export type BeginnerConfig = typeof BEGINNER_CONFIG;

const canCapture = (v: AiView, c: Card) => v.table.some(t => t.month === c.month);
const randomOf = <T>(rng: Rng, list: readonly T[]) => list[pickIndex(rng, list.length)];

/** 고른 카드를 규칙대로 행동으로 바꾼다: 폭탄 월이면 폭탄(세 장), 아니면 한 장 내기(흔들기 월이면 실행기가 공개 뒤 낸다). */
function actionFor(v: AiView, card: Card, reason: string): AiAction {
  if (bombMonths(v).includes(card.month)) return { kind: 'bomb', month: card.month, reason: `${reason} → ${card.month}월은 폭탄 조건이라 세 장 폭탄` };
  const M = v.table.filter(t => t.month === card.month);
  const targetId = M.length === 2 ? STRATEGIC.chooseFloorTarget(v, card, M).targetId : undefined;
  return { kind: 'normal', cardId: card.id, targetId, reason };
}

/** 초반 선택. 다른 월의 합법 손패가 있으면 폭탄·흔들기 대상 월은 후보에서 빼서 보유한다. */
export function chooseEarly(v: AiView, rng: Rng, cfg: BeginnerConfig = BEGINNER_CONFIG): AiAction {
  const special = new Set([...bombMonths(v), ...shakeMonths(v)]);
  const others = v.hand.filter(c => !special.has(c.month));
  const pool = others.length > 0 ? others : v.hand;
  const held = others.length > 0 && others.length < v.hand.length ? ' (폭탄·흔들기 월 보유)' : '';
  const holdable = pool.filter(c => !canCapture(v, c)), capturable = pool.filter(c => canCapture(v, c));
  const r = rng();
  if (r < cfg.earlyHoldProbability) {
    if (holdable.length > 0) return actionFor(v, randomOf(rng, holdable), `초반 보유: 먹을 수 없는 패 중 무작위${held}`);
    // 전부 먹을 수 있으면 즉시 획득 이득이 가장 작은 패(동점은 id 오름차순)
    const least = [...capturable].map(c => ({ c, value: captureValue(v, [c, ...v.table.filter(t => t.month === c.month)]).value }))
      .sort((a, b) => a.value - b.value || a.c.id - b.c.id)[0];
    return actionFor(v, least.c, `초반: 전부 먹을 수 있어 이득이 가장 작은 패${held}`);
  }
  if (capturable.length > 0) return actionFor(v, randomOf(rng, capturable), `초반: 먹을 수 있는 패 중 무작위${held}`);
  return actionFor(v, randomOf(rng, holdable), `초반: 전부 먹을 수 없어 무작위${held}`);
}

/** 초반 이후 선택. 확률적으로 전략 AI의 최선, 아니면 합법 손패 중 무작위(폭탄 월이면 규칙대로 폭탄). */
export function chooseLate(v: AiView, rng: Rng, cfg: BeginnerConfig = BEGINNER_CONFIG): AiAction {
  if (rng() < cfg.lateBestProbability) { const a = STRATEGIC.chooseAction(v, rng, 0); return { ...a, reason: `초반 이후 최선: ${a.reason}` }; }
  return actionFor(v, randomOf(rng, v.hand), '초반 이후 무작위');
}

export function makeBeginner(cfg: BeginnerConfig = BEGINNER_CONFIG): Opponent {
  return {
    key: 'beginner',
    chooseAction(v, rng, actionsDone) {
      if (v.hand.length === 0) return { kind: 'flip', reason: '손패 없음, 기회 패 사용' };
      return actionsDone < cfg.earlyActions ? chooseEarly(v, rng, cfg) : chooseLate(v, rng, cfg);
    },
    chooseFloorTarget: STRATEGIC.chooseFloorTarget,
    chooseGukjin: STRATEGIC.chooseGukjin,
    /** 첫 상대는 선택 가능하면 항상 스톱. */
    decideGoStop: () => ({ decision: 'stop', reason: '첫 상대 정책: 항상 스톱' }),
  };
}
export const BEGINNER: Opponent = makeBeginner();
