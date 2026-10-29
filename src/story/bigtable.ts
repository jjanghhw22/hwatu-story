// 6장 큰 판: 익명 고액 상대 2명 연속. 판돈 표시는 크게(1점 20만)지만 두 판 모두 돈 변동은 없다(정산 장면에서 이야기로 처리). 순수 함수.
export const BIG_TABLE = { rounds: 2, stakeShown: 200000, /** "걸릴 뻔": 6장에서 의심도가 처음 넘는 선. */ nearMissAt: 50 } as const;
export const NEAR_MISS_FLAG = 'ch6.nearMiss';
export type BigRound = 1 | 2;
/** 다음 판 번호. 마지막 판이면 null(장 완료로). */
export function nextBigRound(r: BigRound): BigRound | null { return r < BIG_TABLE.rounds ? ((r + 1) as BigRound) : null; }
/** 큰 판 사이 짧은 컷. */
export const BIG_TABLE_INTERLUDE = [{ kind: 'cut' as const, text: '한 판을 땄다. 자리가 바뀌고, 다음 상대가 앉는다. 판돈은 더 커졌다.' }];
/** 정산에 쓰는 판돈: 돈 변동 없는 판(noPayout)은 0. */
export function effectiveStake(launch: { stake?: number; noPayout?: boolean }): number { return launch.noPayout ? 0 : launch.stake ?? 0; }
/** "걸릴 뻔" 1회: 6장 판에서 의심도가 처음 nearMissAt을 넘는 순간, 아직 안 보여줬을 때. */
export function isNearMiss(isBigTable: boolean, before: number, after: number, shown: boolean): boolean { return isBigTable && !shown && before < BIG_TABLE.nearMissAt && after >= BIG_TABLE.nearMissAt; }
