// 컴퓨터 판단. Phaser와 GameState에 의존하지 않는 순수 함수.
// 입력은 AiView(자기 손패 + 공개 정보)뿐이다. 상대 손패 내용과 더미의 내용·순서는 받지 않는다.
// 판단은 상태를 바꾸지 않으며 같은 AiView에는 항상 같은 답을 낸다(동점은 카드 id 오름차순).
// 실제 턴 실행(계획·연출·적용)은 기존 GameState.planTurn/planBomb/planFlip → applyTurn이 맡는다.
import { CARDS, type Card } from './cards.ts';
import { piValue, scoreCaptured, type Score } from './score.ts';
import type { GameState } from './game.ts';

/** 판단에 쓰는 정보. 상대 손패·더미 내용은 들어 있지 않다. */
export type AiView = {
  me: number;
  /** 내 손패. */
  hand: Card[];
  /** 공개된 바닥패. */
  table: Card[];
  myCaptured: Card[];
  oppCaptured: Card[];
  /** 이 판의 국진 결정(아직 없으면 false = 열끗). */
  gukjinAsPi: boolean;
  myGo: number;
  oppGo: number;
  myFlipChances: number;
  oppFlipChances: number;
  oppHandCount: number;
  deckCount: number;
  /** 바닥의 뻑 묶음(월, 만든 사람). 공개 정보. */
  ppeok: { month: number; owner: number }[];
  /** 내가 이 판에 이미 흔든 월. */
  myShakes: number[];
};

/** 폭탄 가능한 월(손패 정확히 3장 + 바닥 정확히 1장). GameState.bombCandidates와 같은 기준. */
export function bombMonths(v: AiView): number[] {
  return [...monthCounts(v.hand).entries()].filter(([m, n]) => n === 3 && v.table.filter(c => c.month === m).length === 1).map(([m]) => m).sort((a, b) => a - b);
}
/** 자동 흔들기 대상 월(손패 정확히 3장, 바닥 0장, 아직 안 흔듦). GameState.shakeCandidates 중 손패 누르기가 흔드는 월. */
export function shakeMonths(v: AiView): number[] {
  return [...monthCounts(v.hand).entries()].filter(([m, n]) => n === 3 && v.table.every(c => c.month !== m) && !v.myShakes.includes(m)).map(([m]) => m).sort((a, b) => a - b);
}
function monthCounts(cards: readonly Card[]) { const m = new Map<number, number>(); for (const c of cards) m.set(c.month, (m.get(c.month) ?? 0) + 1); return m; }

/** 컴퓨터가 고른 행동. 실행은 GameState의 계획 함수가 한다(bomb은 planBomb, normal은 planTurn, flip은 planFlip). */
export type AiAction =
  | { kind: 'normal'; cardId: number; targetId?: number; reason: string }
  | { kind: 'bomb'; month: number; reason: string }
  | { kind: 'flip'; reason: string };

/** 상대(컴퓨터)의 성향 묶음. 판단 함수는 모두 순수이며 rng는 주입된다(덱 셔플용 난수와 별개). */
export type Opponent = {
  key: string;
  /** 자기 차례의 행동. actionsDone: 이 판에서 지금까지 완료한 자기 행동 수(흔들기 공개 제외). */
  chooseAction(v: AiView, rng: () => number, actionsDone: number): AiAction;
  chooseFloorTarget(v: AiView, card: Card, candidates: readonly Card[]): TargetChoice;
  chooseGukjin(v: AiView): GukjinUse;
  decideGoStop(v: AiView): GoStopDecision;
};

/** GameState에서 공개 정보와 자기 손패만 복사한다. 상대 손패 내용·더미 순서는 복사하지 않는다(장수만). */
export function publicView(s: GameState, me: number): AiView {
  const opp = 1 - me;
  return {
    me,
    hand: [...s.hands[me]],
    table: [...s.table],
    myCaptured: [...s.captured[me]],
    oppCaptured: [...s.captured[opp]],
    gukjinAsPi: s.gukjinDecision === '피',
    myGo: s.goCount[me],
    oppGo: s.goCount[opp],
    myFlipChances: s.flipChances[me],
    oppFlipChances: s.flipChances[opp],
    oppHandCount: s.hands[opp].length,
    deckCount: s.deck.length,
    ppeok: [...s.ppeok.entries()].map(([month, owner]) => ({ month, owner })).sort((a, b) => a.month - b.month),
    myShakes: [...s.shakes[me]],
  };
}

// ---- 가중치(한곳에서 관리). 규칙이 아니라 판단 성향이며 바꿔도 게임 규칙은 달라지지 않는다. ----
export const AI_WEIGHTS = {
  /** 즉시 오르는 기본 점수 1점의 가치. 다른 항목보다 훨씬 크게 둬 확정 점수를 우선한다. */
  basePoint: 10,
  /** 카드 자체의 가치. 피는 피 가치(쌍피·쌍피 국진 2) 1당. */
  kind: { 광: 3, 열끗: 1.6, 띠: 1.4, 피: 1 } as Record<Card['kind'], number>,
  /** 비광은 삼광에서 2점이라 조금 낮춘다. */
  rainGwang: -0.6,
  /** 미완성 조합(고도리·홍단·청단·초단·삼광)의 진행 가치 = 조합 점수 × 이 계수 × (보유/필요)². 상대가 필요한 패를 가졌으면 0. */
  comboPotential: 1.0,
  /** 상대 조합을 저지하는 가치 = 상대 진행 가치 감소분 × 이 계수. */
  block: 0.8,
  /** 피박 위험 완화(내 피 가치 1~7 구간을 벗어나는 정도 × 상대 피 압박). */
  piBak: 6,
  /** 광박 위험 완화(광 0장 → 1장 이상, 상대 광 압박 비례). */
  gwangBak: 6,
  /** 상대 피 1장 가져오기(뻑 회수 등). */
  steal: 4,
  /** 바닥을 비울 가능성(쓸). 더미 결과에 따라 달라지므로 작게. */
  sseul: 2,
  /** 내려놓는 카드가 나에게 갖는 가치(잃는 것). */
  discardOwn: 0.7,
  /** 내려놓는 카드를 상대가 가져갈 때의 가치(주는 것). */
  discardOpp: 0.9,
  /** 같은 월을 또 들고 있으면 내려놓은 패를 나중에 내가 가져갈 수 있다. */
  pairSetup: 1.5,
};

/** 고/스톱 정책(첫 상대용, 보수적). 규칙이 아니라 조정 가능한 성향이며 상대별로 바꿀 수 있다. */
export const AI_GO_POLICY = {
  /** 이 횟수 이상 고했으면 다음 선택은 스톱. */
  maxGoCount: 1,
  /** 상대 기본 점수가 이 값 이상이면 스톱. */
  oppBaseStop: 5,
  /** 내 남은 행동(손패+기회)이 이 값 미만이면 스톱. */
  minRemainingActions: 2,
};
export type GoPolicy = typeof AI_GO_POLICY;

// ---- 내부 평가 ----
type Combo = { name: string; points: number; ids: number[] };
const COMBOS: Combo[] = [
  { name: '고도리', points: 5, ids: CARDS.filter(c => c.godori).map(c => c.id) },
  ...(['홍단', '청단', '초단'] as const).map(b => ({ name: b, points: 3, ids: CARDS.filter(c => c.band === b).map(c => c.id) })),
];
const GWANG_IDS = new Set(CARDS.filter(c => c.kind === '광').map(c => c.id));
const idSet = (cards: readonly Card[]) => new Set(cards.map(c => c.id));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const fmt = (x: number) => (Math.round(x * 10) / 10).toString();

/** 미완성 조합의 진행 가치. mine이 가진 조합 카드 수로 계산하고 theirs가 필요한 카드를 하나라도 가졌으면 그 조합은 0. */
function potential(mine: Set<number>, theirs: Set<number>, w = AI_WEIGHTS): number {
  let v = 0;
  for (const combo of COMBOS) {
    const held = combo.ids.filter(id => mine.has(id)).length;
    if (held >= combo.ids.length) continue;
    if (combo.ids.some(id => theirs.has(id))) continue;
    v += combo.points * w.comboPotential * (held / combo.ids.length) ** 2;
  }
  let myG = 0, theirG = 0;
  for (const id of GWANG_IDS) { if (mine.has(id)) myG++; else if (theirs.has(id)) theirG++; }
  if (myG < 3 && 5 - theirG >= 3) v += 3 * w.comboPotential * (myG / 3) ** 2;
  return v;
}

/** 카드 한 장의 자체 가치. */
function intrinsic(c: Card, gukjinAsPi: boolean, w = AI_WEIGHTS): number {
  if (c.kind === '피' || (gukjinAsPi && c.gukjin)) return piValue([c]) * w.kind.피;
  return w.kind[c.kind] + (c.rainGwang ? w.rainGwang : 0);
}

/** 피박 위험(패자 피 가치 1~7). 0장은 규칙상 면제지만 첫 피를 꺼리지 않도록 1장과 같게 본다. 8 이상은 0. */
function piRisk(value: number): number {
  return value <= 7 ? (8 - Math.max(value, 1)) / 7 : 0;
}

export type Evaluation = { value: number; reasons: string[] };

/** 카드 묶음 gained를 내 획득패에 더할 때의 가치(기본 점수 상승, 카드 가치, 조합 진행, 상대 저지, 박 위험 완화). */
export function captureValue(v: AiView, gained: readonly Card[], w = AI_WEIGHTS): Evaluation {
  const opt = { gukjinAsPi: v.gukjinAsPi };
  const before: Score = scoreCaptured(v.myCaptured, opt);
  const afterCards = [...v.myCaptured, ...gained];
  const after: Score = scoreCaptured(afterCards, opt);
  const opp: Score = scoreCaptured(v.oppCaptured, opt);
  const mine = idSet(v.myCaptured), mineAfter = idSet(afterCards), theirs = idSet(v.oppCaptured);
  const reasons: string[] = [];
  let value = 0;
  const baseDelta = after.total - before.total;
  if (baseDelta !== 0) { value += baseDelta * w.basePoint; reasons.push(`기본 ${baseDelta > 0 ? '+' : ''}${baseDelta}점`); }
  const intr = gained.reduce((s, c) => s + intrinsic(c, v.gukjinAsPi, w), 0);
  if (intr !== 0) { value += intr; reasons.push(`카드 가치 ${fmt(intr)}`); }
  const combo = potential(mineAfter, theirs, w) - potential(mine, theirs, w);
  if (Math.abs(combo) > 1e-9) { value += combo; reasons.push(`조합 진행 ${combo > 0 ? '+' : ''}${fmt(combo)}`); }
  const block = (potential(theirs, mine, w) - potential(theirs, mineAfter, w)) * w.block;
  if (block > 1e-9) { value += block; reasons.push(`상대 저지 +${fmt(block)}`); }
  const piRelief = (piRisk(before.피.value) - piRisk(after.피.value)) * w.piBak * clamp(opp.피.value / 10, 0.25, 1);
  if (piRelief > 1e-9) { value += piRelief; reasons.push(`피박 완화 +${fmt(piRelief)}`); }
  if (before.광.cards.length === 0 && after.광.cards.length > 0) {
    const g = w.gwangBak * clamp(opp.광.cards.length / 3, 0.25, 1);
    value += g; reasons.push(`광박 완화 +${fmt(g)}`);
  }
  return { value, reasons };
}

/** 손패 한 장을 바닥에 그냥 내려놓을 때의 손실(음수 가치). 내가 잃는 가치와 상대가 가져갈 때의 가치를 더한다. */
export function discardValue(v: AiView, card: Card, w = AI_WEIGHTS): Evaluation {
  const mine = idSet(v.myCaptured), theirs = idSet(v.oppCaptured);
  const own = intrinsic(card, v.gukjinAsPi, w) + potential(new Set([...mine, card.id]), theirs, w) - potential(mine, theirs, w);
  const oppWant = intrinsic(card, v.gukjinAsPi, w) + potential(new Set([...theirs, card.id]), mine, w) - potential(theirs, mine, w);
  let cost = own * w.discardOwn + oppWant * w.discardOpp;
  const reasons = [`내려놓기: 내 가치 ${fmt(own)}, 상대 가치 ${fmt(oppWant)}`];
  if (v.hand.some(c => c.id !== card.id && c.month === card.month)) { cost = cost * 0.5 - w.pairSetup; reasons.push('같은 월을 더 들고 있어 되찾을 수 있음'); }
  return { value: -cost, reasons };
}

// ---- 손패 선택 ----
export type HandChoice = {
  cardId: number;
  /** 같은 월 바닥패가 2장일 때 가져갈 바닥패 id. */
  targetId?: number;
  /** 'capture': 바닥패 획득, 'discard': 그냥 내려놓음. */
  mode: 'capture' | 'discard';
  value: number;
  reasons: string[];
  reason: string;
};

const byValue = (a: HandChoice, b: HandChoice) => b.value - a.value || a.cardId - b.cardId || (a.targetId ?? -1) - (b.targetId ?? -1);
const describe = (c: Card) => `${c.month}월 ${c.title}`;

/** 합법적인 모든 손패 행동(같은 월 2장이면 바닥패별로)을 평가해 가치 내림차순(동점은 카드 id·바닥패 id 오름차순)으로 돌려준다. 더미는 보지 않는다. */
export function rankHandCards(v: AiView, w = AI_WEIGHTS): HandChoice[] {
  const out: HandChoice[] = [];
  const push = (cardId: number, mode: HandChoice['mode'], ev: Evaluation, head: string, targetId?: number) =>
    out.push({ cardId, targetId, mode, value: ev.value, reasons: ev.reasons, reason: `${head} → ${fmt(ev.value)} (${ev.reasons.join(', ')})` });
  for (const h of v.hand) {
    const M = v.table.filter(c => c.month === h.month);
    if (M.length === 0) { push(h.id, 'discard', discardValue(v, h, w), `${describe(h)} 내려놓기`); continue; }
    const options = M.length === 2 ? M.map(t => [t]) : [M];
    for (const taken of options) {
      const ev = captureValue(v, [h, ...taken], w);
      const reasons = [...ev.reasons];
      let value = ev.value;
      if (taken.length === 3) {
        const owner = v.ppeok.find(p => p.month === h.month)?.owner;
        if (owner !== undefined) {
          const n = owner === v.me ? 2 : 1;
          const s = w.steal * n * (v.oppCaptured.some(c => c.kind === '피') ? 1 : 0.3);
          value += s; reasons.push(`${owner === v.me ? '자뻑' : '뻑'} 회수 +${fmt(s)}`);
        }
      }
      if (v.table.length - taken.length === 0) { value += w.sseul; reasons.push(`바닥 비울 가능성 +${fmt(w.sseul)}(더미 결과에 따라 다름)`); }
      push(h.id, 'capture', { value, reasons }, `${describe(h)}로 ${taken.map(describe).join('·')} 획득`, taken.length === 1 && M.length === 2 ? taken[0].id : undefined);
    }
  }
  return out.sort(byValue);
}

/** 가장 유리한 손패 행동. 손패가 없으면 오류. */
export function chooseHandCard(v: AiView, w = AI_WEIGHTS): HandChoice {
  const ranked = rankHandCards(v, w);
  if (ranked.length === 0) throw new Error('손패가 없어 고를 수 없습니다.');
  return ranked[0];
}

// ---- 바닥패 선택(같은 월 2장) ----
export type TargetChoice = { targetId: number; value: number; reason: string };

/** card(손패 또는 공개된 더미 패)와 함께 가져갈 바닥패를 candidates 중에서 고른다. 동점은 id 오름차순. */
export function chooseFloorTarget(v: AiView, card: Card, candidates: readonly Card[], w = AI_WEIGHTS): TargetChoice {
  if (candidates.length === 0) throw new Error('선택할 바닥패가 없습니다.');
  const scored = candidates.map(t => { const ev = captureValue(v, [card, t], w); return { targetId: t.id, value: ev.value, reason: `${describe(t)} → ${fmt(ev.value)} (${ev.reasons.join(', ')})` }; })
    .sort((a, b) => b.value - a.value || a.targetId - b.targetId);
  return scored[0];
}

// ---- 국진 ----
export type GukjinUse = { choice: '열끗' | '피'; reason: string };

/** 국진을 열끗/쌍피로 쓸 때의 기본 점수·조합·박 영향을 비교한다. 같으면 열끗. 이미 결정된 판에서는 호출하지 않는다(GameState.pendingGukjin이 막는다). */
export function chooseGukjinUse(v: AiView, w = AI_WEIGHTS): GukjinUse {
  if (!v.myCaptured.some(c => c.gukjin)) throw new Error('국진을 획득하지 않았습니다.');
  const mine = idSet(v.myCaptured), theirs = idSet(v.oppCaptured);
  const evaluate = (asPi: boolean) => {
    const sc = scoreCaptured(v.myCaptured, { gukjinAsPi: asPi });
    const opp = scoreCaptured(v.oppCaptured, { gukjinAsPi: asPi });
    let x = sc.total * w.basePoint + v.myCaptured.reduce((s, c) => s + intrinsic(c, asPi, w), 0) + potential(mine, theirs, w);
    x -= piRisk(sc.피.value) * w.piBak * clamp(opp.피.value / 10, 0.25, 1);
    return { x, total: sc.total, pi: sc.피.value, yeol: sc.열끗.cards.length };
  };
  const y = evaluate(false), p = evaluate(true);
  const choice = p.x > y.x ? '피' : '열끗';
  return { choice, reason: `열끗 ${fmt(y.x)}(합계 ${y.total}점, 열끗 ${y.yeol}장) / 쌍피 ${fmt(p.x)}(합계 ${p.total}점, 피 가치 ${p.pi}) → ${choice}` };
}

// ---- 고/스톱 ----
export type GoStopDecision = { decision: 'go' | 'stop'; reason: string };

/**
 * 고/스톱 정책. 규칙 함수(GameState.canDecide/canGo)가 선택 가능하다고 한 뒤에만 부른다.
 * 더미 운에만 기대는 상황은 스톱, 손패와 현재 바닥패 조합으로 다음 행동에서 기본 점수를 올릴 가능성이 있을 때만 1회 고.
 * '가능성'이다: 더미 결과(뻑·따닥 등)에 따라 실제 획득은 달라질 수 있다.
 */
export function decideGoStop(v: AiView, policy: GoPolicy = AI_GO_POLICY): GoStopDecision {
  const stop = (reason: string): GoStopDecision => ({ decision: 'stop', reason });
  const myRemaining = v.hand.length + v.myFlipChances;
  if (myRemaining === 0) return stop('마지막 행동이라 고를 할 수 없음');
  if (v.myGo >= policy.maxGoCount) return stop(`이미 ${v.myGo}고를 했음(정책 최대 ${policy.maxGoCount}회)`);
  const opt = { gukjinAsPi: v.gukjinAsPi };
  const oppBase = scoreCaptured(v.oppCaptured, opt).total;
  if (oppBase >= policy.oppBaseStop) return stop(`상대 기본 점수 ${oppBase}점(정책 기준 ${policy.oppBaseStop}점 이상)`);
  if (myRemaining < policy.minRemainingActions) return stop(`내 남은 행동 ${myRemaining}회(정책 기준 ${policy.minRemainingActions}회 미만)`);
  const myBase = scoreCaptured(v.myCaptured, opt).total;
  const ups: string[] = [];
  for (const h of v.hand) {
    const M = v.table.filter(c => c.month === h.month);
    if (M.length === 0) continue;
    const options = M.length === 2 ? M.map(t => [t]) : [M];
    for (const taken of options) {
      const total = scoreCaptured([...v.myCaptured, h, ...taken], opt).total;
      if (total > myBase) { ups.push(`${describe(h)}+${taken.map(describe).join('·')} → ${total}점`); break; }
    }
  }
  if (ups.length === 0) return stop('손패와 바닥패 조합으로 점수를 올릴 길이 없어 더미 운에만 기대야 함');
  return { decision: 'go', reason: `다음 손패로 기본 점수를 올릴 가능성: ${ups.join(', ')} (더미 결과에 따라 뻑 등으로 달라질 수 있음)` };
}

// ---- 전략 상대(이후 상대용). 폭탄 우선, 손패는 평가 최선, 손패 없으면 기회 패. ----
export const STRATEGIC: Opponent = {
  key: 'strategic',
  chooseAction(v) {
    const bomb = bombMonths(v)[0];
    if (bomb !== undefined) return { kind: 'bomb', month: bomb, reason: `${bomb}월 폭탄(손패 3장 + 바닥 1장)` };
    if (v.hand.length === 0) return { kind: 'flip', reason: '손패 없음, 기회 패 사용' };
    const d = chooseHandCard(v);
    return { kind: 'normal', cardId: d.cardId, targetId: d.targetId, reason: d.reason };
  },
  chooseFloorTarget: (v, card, cands) => chooseFloorTarget(v, card, cands),
  chooseGukjin: v => chooseGukjinUse(v),
  decideGoStop: v => decideGoStop(v),
};
