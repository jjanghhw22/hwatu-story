// 10장 왕의 식탁(백운호텔 초대전): 문지기 셋의 순서, 차유라 가짜 흔들기, 구상만 봉쇄, 서린의 부적, 서린 관계 분기. 순수 함수.
import type { Rng } from '../rng.ts';
import type { OpponentId } from './opponents.ts';
import type { PlaceId } from './places.ts';
import { type Progress, setFlag } from './progress.ts';

/** 서린의 부적을 받았다는 플래그(10장 편의점 첫 방문). 초대전 1은 이 뒤에 열린다(요청 11-B). */
export const CHARM_FLAG = 'ch10.charm';
/** 초대전 순서: 민정호 → 차유라 → 구상만. */
export const GATES: readonly OpponentId[] = ['jeongho', 'yura', 'sangman'];
export type GateNo = 1 | 2 | 3;
export const gateFlag = (n: GateNo) => `ch10.gate${n}`;
export function gatesWon(p: Progress): number { return ([1, 2, 3] as GateNo[]).filter(n => p.flags[gateFlag(n)]).length; }
/** 다음에 열린 초대전 번호(앞 판을 이겨야 다음이 열린다). 다 이겼으면 null. */
export function nextGate(p: Progress): GateNo | null { const n = gatesWon(p); return n >= 3 ? null : ((n + 1) as GateNo); }
export function canChallengeGate(p: Progress, n: GateNo): boolean { return p.chapterId === 'ch10' && p.flags[CHARM_FLAG] === true && nextGate(p) === n; }
export function winGate(p: Progress, n: GateNo): Progress { return setFlag(p, gateFlag(n)); }

/** 차유라: 자기 차례 rate 확률로 가짜 흔들기 예고(말풍선 + 종소리만, 실제 선언 없음 → 규칙 상태를 바꾸지 않는다). */
export function fakeShake(rng: Rng, rate: number | undefined): boolean { return !!rate && rng() < rate; }
export const FAKE_SHAKE_LINE = '흔들어 볼까?';

/** 구상만 봉쇄: 남은 봉쇄가 있으면 이번 기술을 막는다(집중력은 이미 소모, 효과 없음). */
export function consumeBlock(left: number): { blocked: boolean; left: number } { return left > 0 ? { blocked: true, left: left - 1 } : { blocked: false, left: 0 }; }

/** 서린의 부적(장비, 판당 1회): 의심도가 100에 닿는 순간 70으로 되돌린다(들통 1회 막기). */
export const CHARM_RESET = 70;
export function applyCharm(value: number, equipped: boolean, used: boolean): { value: number; used: boolean; saved: boolean } {
  return value >= 100 && equipped && !used ? { value: CHARM_RESET, used: true, saved: true } : { value, used, saved: false };
}

// ---- 서린 관계 분기(10장) ----
export type SerinRoute = 'friend' | 'slow' | 'distance';
export const ROUTE_NEED_AFFINITY = 8;
export const routeFlag = (r: SerinRoute) => `serin.route.${r}`;
export function serinRoute(p: Progress): SerinRoute { return p.flags[routeFlag('slow')] ? 'slow' : p.flags[routeFlag('distance')] ? 'distance' : 'friend'; }
export function setRoute(p: Progress, r: SerinRoute): Progress { return setFlag(setFlag(p, 'serin.routeAsked'), routeFlag(r)); }
/** 초대전 2·3 사이 편의점 방문(부적을 받은 뒤), 1회: 호감 8 이상이면 선택 창, 아니면 조용히 'friend'(요청 11-B). */
export function routeStep(p: Progress): 'ask' | 'default' | 'none' {
  if (p.chapterId !== 'ch10' || !p.flags[CHARM_FLAG] || p.flags['serin.routeAsked'] || gatesWon(p) !== 2) return 'none';
  return p.serin.affinity >= ROUTE_NEED_AFFINITY ? 'ask' : 'default';
}
/** 10장 지도 ▶ 안내: 부적 전과 관계 분기 차례(초대전 2·3 사이)에는 편의점, 그 밖에는 null(무대인 호텔로). */
export function ch10Pointer(p: Progress): PlaceId | null {
  if (p.chapterId !== 'ch10') return null;
  return !p.flags[CHARM_FLAG] || routeStep(p) !== 'none' ? 'store' : null;
}
