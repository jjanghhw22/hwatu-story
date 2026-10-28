// 진행 상태와 저장(localStorage). 순수 함수로 상태를 바꾸고, 저장 실패는 무시한다. Phaser에 의존하지 않는다.
import { type Chapter, type ChapterId, chapterById, isChapterId, nextChapterId } from './chapters.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import { type SkillId, isSkillId } from './skills.ts';

export type Progress = {
  day: number;
  /** 소지금(원). */
  money: number;
  /** 현재(아직 끝내지 않은) 장. */
  chapterId: ChapterId;
  unlockedPlaces: PlaceId[];
  skills: SkillId[];
  focusMax: number;
  focus: number;
  flags: Record<string, boolean>;
};

export const STORAGE_KEY = 'hwatu.progress.v1';
/** 시작 소지금 12만 원, 압류 예고 3,200만 원(초반의 가짜 목표), 집중력 기본 100(바이블 3절). */
export const START_MONEY = 120000;
export const SEIZURE_NOTICE = 32000000;
export const FOCUS_BASE = 100;

export function initialProgress(): Progress {
  return { day: 1, money: START_MONEY, chapterId: 'prologue', unlockedPlaces: ['barber'], skills: [], focusMax: FOCUS_BASE, focus: FOCUS_BASE, flags: {} };
}

/** 저장소 추상화(테스트에서는 메모리 객체). */
export type KV = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
function defaultStorage(): KV | undefined { try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; } }

export function serialize(p: Progress): string { return JSON.stringify(p); }
/** 문자열 → 진행 상태. 형식이 어긋나면 null(호출 쪽이 초기값으로). 모르는 id는 걸러낸다. */
export function deserialize(text: string): Progress | null {
  try {
    const o = JSON.parse(text) as Partial<Progress> | null;
    if (!o || typeof o !== 'object' || !isChapterId(o.chapterId)) return null;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const init = initialProgress();
    const focusMax = Math.max(1, Math.round(num(o.focusMax, init.focusMax)));
    const flags: Record<string, boolean> = {};
    if (o.flags && typeof o.flags === 'object') for (const [k, v] of Object.entries(o.flags)) if (typeof v === 'boolean') flags[k] = v;
    return {
      day: Math.max(1, Math.round(num(o.day, 1))),
      money: Math.max(0, Math.round(num(o.money, init.money))),
      chapterId: o.chapterId,
      unlockedPlaces: Array.from(new Set([...init.unlockedPlaces, ...(Array.isArray(o.unlockedPlaces) ? o.unlockedPlaces.filter(isPlaceId) : [])])),
      skills: Array.isArray(o.skills) ? Array.from(new Set(o.skills.filter(isSkillId))) : [],
      focusMax,
      focus: Math.min(focusMax, Math.max(0, Math.round(num(o.focus, focusMax)))),
      flags,
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
/** 집 휴식: 집중력 전부 회복, 하루 경과. */
export function rest(p: Progress): Progress { return { ...p, focus: p.focusMax, day: p.day + 1 }; }
export function canSpendFocus(focus: number, cost: number): boolean { return cost >= 0 && focus >= cost; }
/** 기술 사용: 비용 차감. 모자라면 차감하지 않고 그대로(0 미만이 되지 않는다). */
export function spendFocus(focus: number, cost: number): number { return canSpendFocus(focus, cost) ? focus - cost : focus; }
export function withFocus(p: Progress, focus: number): Progress { return { ...p, focus: Math.min(p.focusMax, Math.max(0, Math.round(focus))) }; }

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
  return { ...p, skills, unlockedPlaces, focusMax, focus: Math.min(p.focus, focusMax), chapterId: next, flags: { ...p.flags, [chapterDoneFlag(c.id)]: true } };
}
export function currentChapter(p: Progress): Chapter { return chapterById(p.chapterId); }

// ---- 표시 ----
/** "120,000원". */
export function formatWon(n: number): string { return `${Math.round(n).toLocaleString('ko-KR')}원`; }
/** 만 원 단위: 32,000,000 → "3,200만 원". 만 원 미만이 섞이면 원 단위로. */
export function formatManWon(n: number): string {
  const r = Math.round(n);
  if (r % 10000 !== 0) return formatWon(r);
  return `${(r / 10000).toLocaleString('ko-KR')}만 원`;
}
