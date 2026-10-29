// 의심도(바이블 3절): 판마다 0에서 시작, 속임수 기술·장비를 쓰면 상대의 눈썰미 배율(sharpness)만큼 오른다. 100이면 들통(그 판 즉시 패배). 순수 함수.
import { type ItemId } from './items.ts';
import { SKILLS, type SkillId } from './skills.ts';

export const SUSPICION_MAX = 100;
/** 상승·하강 기본값(sharpness 적용 전). 정직 기술은 0. */
export const SUSPICION = {
  swapSuccess: 25, swapFail: 40, xray: 20, handSwap: 45,
  calmFace: -30, mask: -30,
  /** 이 값 이상이 되는 순간 상대가 경고 말풍선을 한 번 띄운다. */
  warnAt: 70,
} as const;

export const clampSuspicion = (v: number) => Math.min(SUSPICION_MAX, Math.max(0, Math.round(v)));
/** 상승: 기본값 × sharpness(0 = 연습·이야기 판처럼 오르지 않음). */
export function raiseSuspicion(cur: number, base: number, sharpness: number): number { return clampSuspicion(cur + Math.max(0, base) * Math.max(0, sharpness)); }
/** 하강(태연한 얼굴·무표정 마스크): 0 아래로 내려가지 않는다. */
export function lowerSuspicion(cur: number, amount: number): number { return clampSuspicion(cur - Math.abs(amount)); }
export const isBusted = (v: number) => v >= SUSPICION_MAX;
/** 경고는 warnAt 선을 처음 넘을 때 한 번. */
export const crossesWarn = (before: number, after: number) => before < SUSPICION.warnAt && after >= SUSPICION.warnAt;
/** 바이블 5장: 속임수 기술(또는 투시경)을 하나도 안 가졌으면 게이지 자체가 보이지 않는다. */
export function suspicionVisible(skills: readonly SkillId[], gear: readonly ItemId[]): boolean {
  return skills.some(id => SKILLS[id].kind === 'cheat') || gear.includes('xrayGlasses');
}
/** 바꿔치기 성공률: 70%, 행운의 동전 +15%p, 최대 90%. */
export const SWAP_RATE = { base: 0.7, coin: 0.15, max: 0.9 } as const;
export function swapSuccessRate(coin: boolean): number { return Math.min(SWAP_RATE.max, SWAP_RATE.base + (coin ? SWAP_RATE.coin : 0)); }
/** 하루 출입 금지 플래그 키(들통 난 장소·날). 다음 날은 키가 달라 자연히 풀린다. */
export const banKey = (place: string, day: number) => `banned:${place}:${day}`;
