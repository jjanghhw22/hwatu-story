// 미션(요소표 '미션 설계'): 판 시작에 내 손패에 없는 카드 2~3장을 뽑아, 내 획득패에 전부 들어오면 최종 점수(와 돈)에 배수를 곱한다.
// 규칙 엔진 밖(story 계층)에서 결과 final에 곱한다. 상대는 미션이 없고 AI는 모른다. 순수 함수.
import { CARDS, type Card } from '../cards.ts';
import { type Rng, pickIndex } from '../rng.ts';

export type MissionType = 'pair' | 'gwangPi' | 'godori' | 'band' | 'ssangpi' | 'three' | 'rainGukjin' | 'gwang2';
export type MissionDef = { type: MissionType; no: number; name: string; multiplier: number; /** 이 장부터 나온다(1~4장은 ①②④만). */ fromChapter: number };
export const MISSION_TYPES: readonly MissionDef[] = [
  { type: 'pair', no: 1, name: '같은 월 2장', multiplier: 2, fromChapter: 1 },
  { type: 'gwangPi', no: 2, name: '광 1 + 지정 피 1', multiplier: 3, fromChapter: 1 },
  { type: 'godori', no: 3, name: '고도리 열끗 2', multiplier: 3, fromChapter: 5 },
  { type: 'band', no: 4, name: '한 단 2장', multiplier: 3, fromChapter: 1 },
  { type: 'ssangpi', no: 5, name: '쌍피 2', multiplier: 3, fromChapter: 5 },
  { type: 'three', no: 6, name: '지정 3장', multiplier: 4, fromChapter: 5 },
  { type: 'rainGukjin', no: 7, name: '비광 + 국진', multiplier: 4, fromChapter: 5 },
  { type: 'gwang2', no: 8, name: '광 2', multiplier: 4, fromChapter: 5 },
];
export type Mission = { def: MissionDef; cardIds: number[] };

const shuffle = <T>(rng: Rng, xs: readonly T[]): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = pickIndex(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const take = (rng: Rng, pool: readonly Card[], n: number): number[] | null => (pool.length < n ? null : shuffle(rng, pool).slice(0, n).map(c => c.id));

/** 유형별 카드 뽑기(손패에 없는 카드 중). 만들 수 없으면 null. */
export function pickMissionCards(rng: Rng, type: MissionType, handIds: ReadonlySet<number>): number[] | null {
  const pool = CARDS.filter(c => !handIds.has(c.id));
  const of = (pred: (c: Card) => boolean) => pool.filter(pred);
  switch (type) {
    case 'pair': {
      const months = shuffle(rng, Array.from(new Set(pool.map(c => c.month))));
      for (const m of months) { const ids = take(rng, of(c => c.month === m), 2); if (ids) return ids; }
      return null;
    }
    case 'gwangPi': { const g = take(rng, of(c => c.kind === '광'), 1), p = take(rng, of(c => c.kind === '피'), 1); return g && p ? [...g, ...p] : null; }
    case 'godori': return take(rng, of(c => c.godori), 2);
    case 'band': {
      const bands = shuffle(rng, ['홍단', '청단', '초단'] as const);
      for (const b of bands) { const ids = take(rng, of(c => c.band === b), 2); if (ids) return ids; }
      return null;
    }
    case 'ssangpi': return take(rng, of(c => c.ssangpi), 2);
    case 'three': return take(rng, pool, 3);
    case 'rainGukjin': { const r = of(c => c.rainGwang), g = of(c => c.gukjin); return r.length && g.length ? [r[0].id, g[0].id] : null; }
    case 'gwang2': return take(rng, of(c => c.kind === '광'), 2);
  }
}
/** 장 번호로 허용되는 유형. */
export function allowedMissionTypes(chapterNo: number): MissionDef[] { return MISSION_TYPES.filter(t => chapterNo >= t.fromChapter); }
/** 판 시작 추첨: 허용 유형 중 하나를 고르고 카드를 뽑는다. 그 유형으로 못 만들면 다른 유형을 차례로 시도한다. */
export function drawMission(rng: Rng, handIds: ReadonlySet<number>, chapterNo: number): Mission | null {
  const types = shuffle(rng, allowedMissionTypes(chapterNo));
  for (const def of types) { const cardIds = pickMissionCards(rng, def.type, handIds); if (cardIds) return { def, cardIds }; }
  return null;
}
export function missionDone(m: Mission, capturedIds: ReadonlySet<number>): boolean { return m.cardIds.every(id => capturedIds.has(id)); }
/** 정산 배수: 미션을 이뤘고 승리(나가리 아님)일 때만. 못 해도 벌칙 없음. */
export function missionMultiplier(m: Mission | null, done: boolean, outcome: '승리' | '나가리'): number { return m && done && outcome === '승리' ? m.def.multiplier : 1; }
export function missionCards(m: Mission): Card[] { return m.cardIds.map(id => CARDS[id]); }
