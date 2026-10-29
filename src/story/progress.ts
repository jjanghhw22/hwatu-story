// 진행 상태와 저장(localStorage). 순수 함수로 상태를 바꾸고, 저장 실패는 무시한다. Phaser에 의존하지 않는다.
import { type Chapter, type ChapterId, chapterById, isChapterId, nextChapterId } from './chapters.ts';
import { COFFEE_DISCOUNT, FLAGS, GEAR_SLOTS, type ItemId, isItemId, itemById } from './items.ts';
import { banKey } from './suspicion.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import type { SerinState } from './serin.ts';
import { type SkillId, isSkillId } from './skills.ts';

export type Progress = {
  day: number;
  /** 소지금(원). 0 아래로 내려가지 않는다. */
  money: number;
  /** 현재(아직 끝내지 않은) 장. */
  chapterId: ChapterId;
  unlockedPlaces: PlaceId[];
  skills: SkillId[];
  focusMax: number;
  focus: number;
  flags: Record<string, boolean>;
  /** 가방(소모품·장비 개수). */
  bag: Partial<Record<ItemId, number>>;
  /** 서린 관계·사건 상태(serin.ts). */
  serin: SerinState;
  /** 셀 수 있는 값(장소별 일반 대결 승수 등). */
  counters: Record<string, number>;
  /** 장착한 장비(최대 GEAR_SLOTS=2). 장착한 것은 가방에서 빠진다. */
  gear: ItemId[];
};

export const STORAGE_KEY = 'hwatu.progress.v1';
/** 시작 소지금 12만 원, 압류 예고 3,200만 원(초반의 가짜 목표), 집중력 기본 100(바이블 3절). */
export const START_MONEY = 120000;
export const SEIZURE_NOTICE = 32000000;
export const FOCUS_BASE = 100;
/** 셀 수 있는 값의 키. */
export const COUNTERS = { bathWins: 'bath.wins' } as const;
/** 장소별 일반 대결 승수 키(목욕탕은 COUNTERS.bathWins와 같다). */
export const winsKey = (place: PlaceId) => `${place}.wins`;
/** 6장 그날 밤: 연습 대결이 잠기고 휴식만 가능. 휴식(다음 날)하면 풀린다. */
export const NIGHT_LOCK_FLAG = 'night.ch6';
export const DEBT_FROZEN_FLAG = 'debt.frozen';
/** 강봉구 입장: 항구 일반 대결 승수. */
export const BONGGU_ENTRY_WINS = 1;
/** 마 사장 대결 입장: 목욕탕 일반 대결 승수. */
export const MA_ENTRY_WINS = 2;

export const initialSerin = (): SerinState => ({ affinity: 0, visits: 0, lastEventDay: 0, lastVisitDay: 0, pity: 0, seen: [] });
export function initialProgress(): Progress {
  return { day: 1, money: START_MONEY, chapterId: 'prologue', unlockedPlaces: ['barber'], skills: [], focusMax: FOCUS_BASE, focus: FOCUS_BASE, flags: {}, bag: {}, serin: initialSerin(), counters: {}, gear: [] };
}

/** 저장소 추상화(테스트에서는 메모리 객체). */
export type KV = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
function defaultStorage(): KV | undefined { try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; } }

export function serialize(p: Progress): string { return JSON.stringify(p); }
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** 문자열 → 진행 상태. 형식이 어긋나면 null(호출 쪽이 초기값으로). 모르는 id는 걸러내고, 예전 저장에 없는 필드는 기본값으로 채운다. */
export function deserialize(text: string): Progress | null {
  try {
    const o = JSON.parse(text) as Partial<Progress> | null;
    if (!o || typeof o !== 'object' || !isChapterId(o.chapterId)) return null;
    const init = initialProgress();
    const focusMax = Math.max(1, Math.round(num(o.focusMax, init.focusMax)));
    const flags: Record<string, boolean> = {};
    if (o.flags && typeof o.flags === 'object') for (const [k, v] of Object.entries(o.flags)) if (typeof v === 'boolean') flags[k] = v;
    const bag: Partial<Record<ItemId, number>> = {};
    if (o.bag && typeof o.bag === 'object') for (const [k, v] of Object.entries(o.bag)) if (isItemId(k) && typeof v === 'number' && v > 0) bag[k] = Math.round(v);
    const counters: Record<string, number> = {};
    if (o.counters && typeof o.counters === 'object') for (const [k, v] of Object.entries(o.counters)) if (typeof v === 'number' && Number.isFinite(v)) counters[k] = Math.round(v);
    const s = (o.serin && typeof o.serin === 'object' ? o.serin : {}) as Partial<SerinState>;
    const serin: SerinState = {
      affinity: Math.max(0, Math.round(num(s.affinity, 0))), visits: Math.max(0, Math.round(num(s.visits, 0))),
      lastEventDay: Math.max(0, Math.round(num(s.lastEventDay, 0))), lastVisitDay: Math.max(0, Math.round(num(s.lastVisitDay, 0))),
      pity: Math.max(0, Math.round(num(s.pity, 0))), seen: Array.isArray(s.seen) ? s.seen.filter((x): x is string => typeof x === 'string') : [],
    };
    // 현재 장의 무대는 열려 있어야 한다(예전 저장 보정. 프롤로그의 무대 '집'은 1장 끝에 열리므로 제외)
    const stage: PlaceId[] = o.chapterId === 'prologue' ? [] : [chapterById(o.chapterId).place];
    return {
      day: Math.max(1, Math.round(num(o.day, 1))),
      money: Math.max(0, Math.round(num(o.money, init.money))),
      chapterId: o.chapterId,
      unlockedPlaces: Array.from(new Set([...init.unlockedPlaces, ...(Array.isArray(o.unlockedPlaces) ? o.unlockedPlaces.filter(isPlaceId) : []), ...stage])),
      skills: Array.isArray(o.skills) ? Array.from(new Set(o.skills.filter(isSkillId))) : [],
      focusMax,
      focus: Math.min(focusMax, Math.max(0, Math.round(num(o.focus, focusMax)))),
      flags, bag, serin, counters,
      gear: Array.isArray(o.gear) ? Array.from(new Set(o.gear.filter(isItemId))).slice(0, GEAR_SLOTS) : [],
    };
  } catch { return null; }
}

export function loadProgress(storage: KV | undefined = defaultStorage()): Progress {
  try { const t = storage?.getItem(STORAGE_KEY); const p = t ? deserialize(t) : null; return p ?? initialProgress(); } catch { return initialProgress(); }
}
/** 저장. 실패(저장소 없음·용량)는 무시하고 false. */
export function saveProgress(p: Progress, storage: KV | undefined = defaultStorage()): boolean {
  try { storage?.setItem(STORAGE_KEY, serialize(p)); return !!storage; } catch { return false; }
}
export function resetProgress(storage: KV | undefined = defaultStorage()): Progress {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* 저장소 없음 */ }
  return initialProgress();
}

// ---- 집중력 ----
/** 집 휴식: 집중력 전부 회복, 하루 경과. 첫 휴식은 '첫 귀가' 플래그(숙면 안대 해금). */
export function rest(p: Progress): Progress {
  const flags: Record<string, boolean> = { ...p.flags, [FLAGS.homeFirstRest]: true, [NIGHT_LOCK_FLAG]: false };
  if (p.gear.includes('sleepMask')) flags[FLAGS.maskRested] = true; // 숙면 안대: 다음 대결 집중력 +30
  return { ...p, focus: p.focusMax, day: p.day + 1, flags };
}
export function canSpendFocus(focus: number, cost: number): boolean { return cost >= 0 && focus >= cost; }
/** 기술 사용: 비용 차감. 모자라면 차감하지 않고 그대로(0 미만이 되지 않는다). */
export function spendFocus(focus: number, cost: number): number { return canSpendFocus(focus, cost) ? focus - cost : focus; }
export function withFocus(p: Progress, focus: number): Progress { return { ...p, focus: Math.min(p.focusMax, Math.max(0, Math.round(focus))) }; }

// ---- 돈 ----
/** 돈 증감. 0 아래로 내려가지 않는다(부족하면 가진 만큼만). 실제 적용된 양을 함께 돌려준다. */
export function addMoney(p: Progress, delta: number): { progress: Progress; applied: number } {
  const applied = delta < 0 ? -Math.min(p.money, -delta) : Math.round(delta);
  return { progress: { ...p, money: p.money + applied }, applied };
}
/** 일반 대결 정산: 최종 점수 × 판돈을 승자가 가져간다(진 쪽은 가진 만큼만). 나가리·판돈 0이면 0. */
export function settleStake(final: number, stakePerPoint: number, won: boolean): number { return stakePerPoint > 0 ? (won ? 1 : -1) * final * stakePerPoint : 0; }
export function counter(p: Progress, key: string): number { return p.counters[key] ?? 0; }
export function bump(p: Progress, key: string, by = 1): Progress { return { ...p, counters: { ...p.counters, [key]: counter(p, key) + by } }; }
/** 마 사장 대결 입장: 목욕탕 일반 대결 2승 + 3장이 현재 장. */
export function canChallengeMa(p: Progress): boolean { return p.chapterId === 'ch3' && counter(p, COUNTERS.bathWins) >= MA_ENTRY_WINS; }
/** 강봉구 입장: 항구 일반 대결 1승 + 5장이 현재 장. */
export function canChallengeBonggu(p: Progress): boolean { return p.chapterId === 'ch5' && counter(p, winsKey('harbor')) >= BONGGU_ENTRY_WINS; }
export function isNightLocked(p: Progress): boolean { return p.flags[NIGHT_LOCK_FLAG] === true; }
export function isDebtFrozen(p: Progress): boolean { return p.flags[DEBT_FROZEN_FLAG] === true; }

// ---- 가방·아이템 ----
export function bagCount(p: Progress, id: ItemId): number { return p.bag[id] ?? 0; }
export function addToBag(p: Progress, id: ItemId, n = 1): Progress { return { ...p, bag: { ...p.bag, [id]: bagCount(p, id) + n } }; }
/** 가방에서 하나 뺀다. 없으면 그대로(null). */
export function takeFromBag(p: Progress, id: ItemId): Progress | null {
  const n = bagCount(p, id);
  if (n <= 0) return null;
  const bag = { ...p.bag };
  if (n - 1 > 0) bag[id] = n - 1; else delete bag[id];
  return { ...p, bag };
}
/** 구매: 돈이 모자라면 null. */
export function buyItem(p: Progress, id: ItemId): Progress | null {
  const it = itemById(id);
  if (it.price === null || p.money < it.price) return null;
  return addToBag(addMoney(p, -it.price).progress, id);
}
export type UseResult = { progress: Progress; focusDelta: number; note: string };
/**
 * 지도(대결 밖)에서 소모품 사용: 삼각김밥 집중력 +20(상한 최대치), 캔커피 전부 회복 + 다음 대결 첫 기술 비용 −10 플래그. 사탕은 대결 중에만.
 * 가방에 없거나 지도에서 못 쓰는 것은 null.
 */
export function useItemOnMap(p: Progress, id: ItemId): UseResult | null {
  const it = itemById(id);
  if (it.use !== 'map') return null;
  const taken = takeFromBag(p, id);
  if (!taken) return null;
  const before = taken.focus;
  let next = it.focusFull ? withFocus(taken, taken.focusMax) : withFocus(taken, taken.focus + it.focus);
  if (id === 'canCoffee') next = { ...next, flags: { ...next.flags, [FLAGS.coffeeBoost]: true } };
  if (id === 'luckyCoin') return { progress: setFlag(taken, FLAGS.coinBoost), focusDelta: 0, note: `${it.name}: 다음 바꿔치기 성공률 +15%p(최대 90%)` };
  const focusDelta = next.focus - before;
  return { progress: next, focusDelta, note: `${it.name}: 집중력 ${before} → ${next.focus}${id === 'canCoffee' ? ` · 다음 대결 첫 기술 비용 −${COFFEE_DISCOUNT}` : ''}` };
}
// ---- 장비(집에서만 장착·해제, 2칸) ----
/** 장착: 가방에 있는 장비를 한 칸에 끼운다(가방에서 빠짐). 칸이 차거나 장비가 아니거나 가방에 없으면 null. */
export function equipGear(p: Progress, id: ItemId): Progress | null {
  if (itemById(id).kind !== 'gear' || p.gear.includes(id) || p.gear.length >= GEAR_SLOTS) return null;
  const taken = takeFromBag(p, id);
  return taken ? { ...taken, gear: [...taken.gear, id] } : null;
}
/** 해제: 가방으로 돌아간다. */
export function unequipGear(p: Progress, id: ItemId): Progress | null {
  if (!p.gear.includes(id)) return null;
  return addToBag({ ...p, gear: p.gear.filter(g => g !== id) }, id);
}
// ---- 출입 금지(들통) ----
export function isBanned(p: Progress, place: PlaceId): boolean { return p.flags[banKey(place, p.day)] === true; }
export function banPlace(p: Progress, place: PlaceId): Progress { return setFlag(p, banKey(place, p.day)); }
/** 대결 중 기술 비용: 캔커피 효과가 있으면 첫 기술 −10(0 미만 없음). */
export function skillCostWithBoost(cost: number, boosted: boolean): number { return boosted ? Math.max(0, cost - COFFEE_DISCOUNT) : cost; }

// ---- 이야기 진행 ----
export const chapterDoneFlag = (id: ChapterId) => `${id}.done`;
export function isChapterDone(p: Progress, id: ChapterId): boolean { return p.flags[chapterDoneFlag(id)] === true; }
/** 장을 끝낸다: 보상 기술·열리는 장소·집중력 최대치를 반영하고 다음 장으로. 이미 끝낸 장이면 그대로. */
export function completeChapter(p: Progress, c: Chapter): Progress {
  if (isChapterDone(p, c.id)) return p;
  const skills = c.rewardSkill && !p.skills.includes(c.rewardSkill) ? [...p.skills, c.rewardSkill] : p.skills;
  const unlockedPlaces = Array.from(new Set([...p.unlockedPlaces, ...c.unlocks]));
  const focusMax = Math.max(p.focusMax, c.focusMaxAfter ?? 0);
  const next = p.chapterId === c.id ? nextChapterId(c.id) : p.chapterId;
  const flags: Record<string, boolean> = { ...p.flags, [chapterDoneFlag(c.id)]: true };
  for (const f of c.setFlags ?? []) flags[f] = true;
  let out: Progress = { ...p, skills, unlockedPlaces, focusMax, focus: Math.min(p.focus, focusMax), chapterId: next, flags };
  for (const [id, n] of Object.entries(c.rewardItems ?? {})) out = addToBag(out, id as ItemId, n ?? 1);
  return out;
}
export function currentChapter(p: Progress): Chapter { return chapterById(p.chapterId); }
export function setFlag(p: Progress, key: string, value = true): Progress { return { ...p, flags: { ...p.flags, [key]: value } }; }

// ---- 표시 ----
/** "120,000원". */
export function formatWon(n: number): string { return `${Math.round(n).toLocaleString('ko-KR')}원`; }
/** 부호 있는 원화: "+20,000원" / "−50,000원". */
export function formatWonDelta(n: number): string { return `${n < 0 ? '−' : '+'}${formatWon(Math.abs(n))}`; }
/** 만 원 단위: 32,000,000 → "3,200만 원". 만 원 미만이 섞이면 원 단위로. */
export function formatManWon(n: number): string {
  const r = Math.round(n);
  if (r % 10000 !== 0) return formatWon(r);
  return `${(r / 10000).toLocaleString('ko-KR')}만 원`;
}
