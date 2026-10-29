// 역정보형 상대(4장 복희)의 말풍선. 순수 함수: 상대 차례 시작 때 bluff 확률로 실제 상태의 반대를 말하고, 나머지는 사실대로.
// 시선 돌리기를 쓰면 그 판의 다음 말풍선 하나 옆에 "(거짓)"/"(참)"이 붙는다.
import { type Rng, pickIndex } from '../rng.ts';

export type BluffLines = { /** 상대가 잘나갈 때(기본 5점 이상) 하는 거짓말: 비관. */ pessimist: readonly string[]; /** 상대가 못할 때(2점 이하) 하는 거짓말: 낙관. */ optimist: readonly string[]; /** 사실대로: [낮음(≤2), 중간(3~4), 높음(≥5)] 한 줄씩. */ truthful: readonly [string, string, string] };
export type BluffLine = { text: string; truthful: boolean };
/** 거짓말의 기준: 기본 점수 5 이상이면 비관으로 속이고, 2 이하면 낙관으로 속인다. 3~4점은 속일 말이 없어 사실대로. */
export const BLUFF = { pessimistAt: 5, optimistAt: 2 } as const;

export function truthBand(oppBase: number): 0 | 1 | 2 { return oppBase <= BLUFF.optimistAt ? 0 : oppBase >= BLUFF.pessimistAt ? 2 : 1; }
/** 말풍선 하나. bluffRate 확률로 거짓(상태의 반대), 아니면 사실. 상대 기본 점수(공개 정보)만 본다. */
export function pickBluff(rng: Rng, bluffRate: number, oppBase: number, lines: BluffLines): BluffLine {
  const lie = rng() < bluffRate;
  if (lie && oppBase >= BLUFF.pessimistAt) return { text: lines.pessimist[pickIndex(rng, lines.pessimist.length)], truthful: false };
  if (lie && oppBase <= BLUFF.optimistAt) return { text: lines.optimist[pickIndex(rng, lines.optimist.length)], truthful: false };
  return { text: lines.truthful[truthBand(oppBase)], truthful: true };
}
/** 시선 돌리기가 켜져 있으면 "(거짓)"/"(참)"을 붙인다. */
export function markBluff(l: BluffLine, reveal: boolean): string { return reveal ? `${l.text} (${l.truthful ? '참' : '거짓'})` : l.text; }
