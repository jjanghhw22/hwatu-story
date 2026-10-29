// 11장 왕이 없는 밤(백무진): 한 판 안에서 3단계(견제 → 흔들기 → 왕의 손), 이기면 마지막 선택(스톱 = 엔딩 A, 고 = 4단계 추가 승부 → 엔딩 B). 순수 함수.
import type { CheatSpec } from './cheat.ts';
import type { Progress } from './progress.ts';
import { SKILLS, type SkillId } from './skills.ts';

export type KingStage = 1 | 2 | 3 | 4;
/** 단계 전환 조건: 1→2 더미 ≤ 14 또는 내 기본 ≥ 5, 2→3 더미 ≤ 6 또는 무진 기본 ≥ 5. 4단계는 추가 승부(처음부터). */
export const KING = { toStage2Deck: 14, toStage2MyBase: 5, toStage3Deck: 6, toStage3KingBase: 5, betMultiplier: 2, stage2MaxGo: 2 } as const;
export const KING_CHEAT_3: CheatSpec = { perTurn: 0.6, maxPerMatch: 2 };
export const KING_CHEAT_4: CheatSpec = { perTurn: 0.6, maxPerMatch: 3 };
/** 지금 상태에서 있어야 할 단계(한 번 오른 단계는 내려가지 않는다). */
export function nextKingStage(stage: KingStage, deckCount: number, myBase: number, kingBase: number): KingStage {
  if (stage === 4) return 4;
  let s = stage;
  if (s === 1 && (deckCount <= KING.toStage2Deck || myBase >= KING.toStage2MyBase)) s = 2;
  if (s === 2 && (deckCount <= KING.toStage3Deck || kingBase >= KING.toStage3KingBase)) s = 3;
  return s;
}
/** 기술 사용 기록 키(전 장 공통, Progress.counters). */
export const skillCounterKey = (id: SkillId) => `skill.${id}`;
/** 이번 여정에서 가장 많이 쓴 기술 n개(동점은 기술 목록 순). 기록이 없으면 눈썰미·바꿔치기. */
export function topSkills(p: Pick<Progress, 'counters'>, n = 2): SkillId[] {
  const used = (Object.keys(SKILLS) as SkillId[]).map((id, i) => ({ id, n: p.counters[skillCounterKey(id)] ?? 0, i })).filter(x => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i);
  return used.length ? used.slice(0, n).map(x => x.id) : (['eye', 'swap'] as SkillId[]).slice(0, n);
}
/** 단계별 잠긴 기술: 1단계 = 많이 쓴 2개("왕이 봤다"), 2·3단계 = 없음, 4단계 = 정직 기술 전부. */
export function stageLocks(stage: KingStage, top: readonly SkillId[]): SkillId[] {
  if (stage === 1) return [...top];
  if (stage === 4) return (Object.keys(SKILLS) as SkillId[]).filter(id => SKILLS[id].kind === 'honest');
  return [];
}
/** 단계별 상대 속임수. */
export function stageCheat(stage: KingStage): CheatSpec | undefined { return stage === 3 ? KING_CHEAT_3 : stage === 4 ? KING_CHEAT_4 : undefined; }
/** 단계 전환 컷인 한 줄(대화창만, 0.8초). 3단계는 태오 수락 여부로 갈린다. */
export function stageCutIn(stage: KingStage, taeohAccepted: boolean): string | null {
  if (stage === 2) return '서린이 배송 기사에게 봉투를 건넨다.';
  if (stage === 3) return taeohAccepted ? '태오가 직원 통로 문을 연다.' : '시장 트럭이 호텔 뒷문에 선다.';
  return null;
}
export const CUT_IN_MS = 800;
