// 브라우저 없는 순수 로직 진행기. 화면(main.ts)의 턴 순서(판단 → 계획 → 적용 → 국진 → 피 이동 → 고/스톱 → 종료 판정)를 그대로 따른다.
// 테스트와 AI 대결 집계에 쓴다. 연출이 없으므로 결과는 규칙 계층만으로 정해진다.
import { type Opponent, publicView } from './ai.ts';
import { GameState, type RoundResult, type Setup, newDeck } from './game.ts';
import { type Rng, seededRng } from './rng.ts';

/** 덱 셔플 전용 난수로 48장을 나눈 고정 구성. AI 난수와 분리된다. */
export function dealSetup(deckRng: Rng): Setup {
  const d = newDeck(deckRng).map(c => c.id);
  return { hands: [d.slice(0, 10), d.slice(10, 20)], table: d.slice(20, 28), deck: d.slice(28) };
}

export type SimOptions = {
  /** 좌석별 상대 정책. 좌석 0이 선공. */
  players: [Opponent, Opponent];
  /** 좌석별 AI 판단 난수. */
  rngs: [Rng, Rng];
  /** 턴마다 불변식을 검사하는 콜백(테스트용). */
  check?: (s: GameState) => void;
};

/** 한 판을 끝까지 진행한다. 행동 수는 좌석별로 세며 흔들기 공개는 세지 않는다. */
export function playRound(s: GameState, o: SimOptions): RoundResult {
  const actions = [0, 0];
  let guard = 0;
  while (!s.over) {
    if (++guard > 200) throw new Error('판이 끝나지 않습니다.');
    const p = s.currentPlayer, ai = o.players[p], rng = o.rngs[p];
    if (s.remainingActions(p) === 0) {
      s.turn += 1;
      if (s.settleIfExhausted()) break;
      continue;
    }
    const a = ai.chooseAction(publicView(s, p), rng, actions[p]);
    let plan;
    if (a.kind === 'bomb') plan = s.planBomb(p, a.month);
    else if (a.kind === 'flip') plan = s.planFlip(p);
    else {
      const card = s.hands[p].find(c => c.id === a.cardId);
      if (!card) throw new Error(`손패에 없는 카드 ${a.cardId}`);
      if (s.canShake(p, card.month)) s.declareShake(p, card.month); // 사람의 손패 누르기와 같은 자동 흔들기
      plan = s.planTurn(p, card, a.targetId);
    }
    if (plan.needsDeckChoice) plan = s.replanDeckChoice(plan, ai.chooseFloorTarget(publicView(s, p), plan.deckCard!, plan.needsDeckChoice).targetId);
    s.applyTurn(plan);
    actions[p] += 1;
    if (s.pendingGukjin(p)) s.chooseGukjin(p, ai.chooseGukjin(publicView(s, p)).choice);
    if (plan.piSteals > 0) s.stealPi(1 - p, p, plan.piSteals);
    o.check?.(s);
    if (s.canDecide(p)) {
      if (!s.canGo(p)) { s.declareStop(p); break; }
      if (ai.decideGoStop(publicView(s, p)).decision === 'stop') { s.declareStop(p); break; }
      s.declareGo(p);
    }
    if (s.settleIfExhausted()) break;
  }
  return s.result!;
}

export type MatchSummary = { rounds: number; wins: [number, number]; draws: number; seats: Record<string, { wins: number; losses: number; draws: number }> };

/** 두 정책을 고정 시드로 여러 판 대결시킨다. 홀수 판은 좌석을 바꿔 선공을 교대한다. 결과는 정책 키별로 집계한다. */
export function playMatch(a: Opponent, b: Opponent, rounds: number, seed = 1): MatchSummary {
  const summary: MatchSummary = { rounds, wins: [0, 0], draws: 0, seats: { [a.key]: { wins: 0, losses: 0, draws: 0 }, [b.key]: { wins: 0, losses: 0, draws: 0 } } };
  for (let i = 0; i < rounds; i++) {
    const deckRng = seededRng(seed * 1000 + i);
    const players: [Opponent, Opponent] = i % 2 === 0 ? [a, b] : [b, a];
    const s = new GameState(dealSetup(deckRng));
    const r = playRound(s, { players, rngs: [seededRng(seed * 7919 + i * 2 + 1), seededRng(seed * 7919 + i * 2 + 2)] });
    if (r.outcome === '나가리') { summary.draws++; summary.seats[a.key].draws++; summary.seats[b.key].draws++; continue; }
    summary.wins[r.winner]++;
    const winner = players[r.winner], loser = players[1 - r.winner];
    summary.seats[winner.key].wins++; summary.seats[loser.key].losses++;
  }
  return summary;
}
