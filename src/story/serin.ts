// 서린 관계·지원 사건(바이블 8절). 호감은 방문·대화·약속 이행으로만 오르고 돈은 사건 해결에만 쓰인다.
// 방문마다 하루 1회 사건을 추첨하고, 사건마다 답례 등급을 뽑는다(천장 보정). 난수는 주입받아 재현 가능하다. Phaser에 의존하지 않는다.
import { type Rng, pickIndex } from '../rng.ts';
import type { Scene } from './chapters.ts';
import { FLAGS } from './items.ts';
import { type Progress, addMoney, setFlag, withFocus } from './progress.ts';

export type SerinState = {
  /** 관계 점수. 방문(+1, 하루 1회)·대화 선택(+1~2)·약속 이행(+3)으로만 오른다. */
  affinity: number;
  visits: number;
  /** 마지막으로 사건이 난 day(하루 1회). */
  lastEventDay: number;
  /** 마지막 방문 day(호감 +1은 하루 1회). */
  lastVisitDay: number;
  /** 희귀 이상이 안 나온 연속 횟수(천장 보정용). */
  pity: number;
  /** 이미 겪은 사건 id(반복 불가 사건 판정). */
  seen: string[];
};

/** 호감 증가량. 돈은 여기에 없다. */
export const AFFINITY = { visit: 1, talk: 1, talkBig: 2, promise: 3 } as const;

export type SerinEventId = 'meal' | 'textbook' | 'stock' | 'parcel' | 'exam' | 'saturday' | 'rain' | 'visitor' | 'gift';
export type SerinEvent = {
  id: SerinEventId;
  title: string;
  /** 서린의 말(바이블 표). */
  quote: string;
  /** 가능한 결과(바이블 표). */
  outcome: string;
  /** 이번 단계에서 동작하는 사건. 나머지는 데이터만이라 추첨에서 빠진다. */
  implemented: boolean;
  /** 반복 가능(식사처럼 막힌 돈을 늘 풀어 주는 사건). 아니면 한 번만. */
  repeatable: boolean;
  /** 선택지가 있는 사건(교재비). */
  choice?: { accept: string; decline: string; cost: number };
  scenes: Scene[];
};
const line = (text: string): Scene => ({ kind: 'line', speaker: 'seorin', text });
const cut = (text: string): Scene => ({ kind: 'cut', text });
/** 식사 사건의 돈(요청 06: "손님이 두고 간 거야"), 교재비 사건의 돈. */
export const MEAL_MONEY = 20000, MEAL_FOCUS = 20, TEXTBOOK_COST = 50000;

export const SERIN_EVENTS: readonly SerinEvent[] = [
  { id: 'meal', title: '야간 근무 식사', quote: '혼자 먹긴 좀 많네.', outcome: '음식, 회복, 관계 대화', implemented: true, repeatable: true,
    scenes: [cut('야간 근무. 서린이 도시락을 꺼낸다.'), line('혼자 먹긴 좀 많네.'), cut('봉투 하나를 더 민다.'), line('손님이 두고 간 거야.')] },
  { id: 'textbook', title: '교재비 부족', quote: '빌리는 거야. 적어 놔.', outcome: '답례품, 정보, 새 사건', implemented: true, repeatable: false,
    choice: { accept: '빌려준다', decline: '지금은 어렵다', cost: TEXTBOOK_COST },
    scenes: [cut('교재비가 모자란다고 한다.'), line('빌리는 거야. 적어 놔.')] },
  { id: 'stock', title: '재고 정리 부탁', quote: '', outcome: '포도당 사탕 해금', implemented: true, repeatable: false,
    scenes: [cut('서린이 재고 정리를 부탁한다. 유통기한이 가까운 포도당 사탕을 따로 빼 둔다.')] },
  { id: 'parcel', title: '배송 상자 분실', quote: '찾으면 네가 먼저 골라.', outcome: '상품 또는 장비 해금', implemented: false, repeatable: false, scenes: [line('찾으면 네가 먼저 골라.')] },
  { id: 'exam', title: '시험 전 부탁', quote: '한 시간만 조용히 있어 줄래?', outcome: '함께 공부, 눈썰미 강화', implemented: false, repeatable: false, scenes: [line('한 시간만 조용히 있어 줄래?')] },
  { id: 'saturday', title: '토요일 약속', quote: '옷은 좀 멀쩡하게 입고 와.', outcome: '고물상(투시경), "데이트인 줄 알았어?", 핫팩', implemented: false, repeatable: false, scenes: [line('옷은 좀 멀쩡하게 입고 와.')] },
  { id: 'rain', title: '비 오는 날', quote: '우산 하나인데 어떻게 할래?', outcome: '관계 진전, 개인사', implemented: false, repeatable: false, scenes: [line('우산 하나인데 어떻게 할래?')] },
  { id: 'visitor', title: '수상한 방문객', quote: '저 사람 또 왔어.', outcome: '뱀눈 단서(7장 전조)', implemented: false, repeatable: false, scenes: [line('저 사람 또 왔어.')] },
  { id: 'gift', title: '오래된 선물', quote: '이거, 네 아버지가 맡긴 건가 봐.', outcome: '회중시계 사건', implemented: false, repeatable: false, scenes: [line('이거, 네 아버지가 맡긴 건가 봐.')] },
];
export function serinEventById(id: SerinEventId): SerinEvent { return SERIN_EVENTS.find(e => e.id === id)!; }

// ---- 답례 등급 ----
export type RewardTier = 'common' | 'useful' | 'rare' | 'veryRare' | 'special';
/** 일상 55 / 유용 28 / 희귀 12 / 매우 희귀 4 / 특별 1 (%). 지원 금액은 확률을 올리지 않는다. */
export const REWARD_TIERS: readonly { id: RewardTier; name: string; percent: number }[] = [
  { id: 'common', name: '일상', percent: 55 }, { id: 'useful', name: '유용', percent: 28 }, { id: 'rare', name: '희귀', percent: 12 }, { id: 'veryRare', name: '매우 희귀', percent: 4 }, { id: 'special', name: '특별', percent: 1 },
];
/** 희귀 이상이 이 횟수 동안 안 나오면 다음은 희귀 이상 확정. */
export const PITY_LIMIT = 10;
export const isRareOrBetter = (t: RewardTier) => t === 'rare' || t === 'veryRare' || t === 'special';
export function tierName(t: RewardTier): string { return REWARD_TIERS.find(x => x.id === t)!.name; }
/** 등급 추첨. pity가 PITY_LIMIT 이상이면 희귀 이상 가운데서(12:4:1) 뽑는다. */
export function rollTier(rng: Rng, pity: number): RewardTier {
  const pool = pity >= PITY_LIMIT ? REWARD_TIERS.filter(t => isRareOrBetter(t.id)) : REWARD_TIERS;
  const total = pool.reduce((s, t) => s + t.percent, 0);
  let r = rng() * total;
  for (const t of pool) { if (r < t.percent) return t.id; r -= t.percent; }
  return pool[pool.length - 1].id;
}

// ---- 방문 ----
export type VisitResult = { progress: Progress; firstToday: boolean; event?: SerinEvent; tier?: RewardTier };
/** 사건 추첨 후보: 구현된 사건 중 반복 가능하거나 아직 안 겪은 것. */
export function eventCandidates(s: SerinState): SerinEvent[] { return SERIN_EVENTS.filter(e => e.implemented && (e.repeatable || !s.seen.includes(e.id))); }
/**
 * 편의점 방문: 하루 첫 방문이면 호감 +1. 하루 첫 사건이면 후보 중 하나를 뽑고 답례 등급을 추첨한다(희귀 이상 → 고물상 소개 플래그, pity 초기화; 아니면 pity +1).
 * 사건의 효과(돈·집중력·플래그)는 applyEvent에서 선택과 함께 적용한다.
 */
export function visitSerin(p: Progress, rng: Rng): VisitResult {
  let s: SerinState = { ...p.serin, visits: p.serin.visits + 1 };
  const firstToday = s.lastVisitDay < p.day;
  if (firstToday) s = { ...s, affinity: s.affinity + AFFINITY.visit, lastVisitDay: p.day };
  let event: SerinEvent | undefined, tier: RewardTier | undefined, next: Progress = { ...p, serin: s };
  if (s.lastEventDay < p.day) {
    const cands = eventCandidates(s);
    if (cands.length) {
      event = cands[pickIndex(rng, cands.length)];
      tier = rollTier(rng, s.pity);
      const rare = isRareOrBetter(tier);
      s = { ...s, lastEventDay: p.day, seen: s.seen.includes(event.id) ? s.seen : [...s.seen, event.id], pity: rare ? 0 : s.pity + 1 };
      next = { ...p, serin: s };
      if (rare) next = setFlag(next, FLAGS.serinJunk);
    }
  }
  return { progress: next, firstToday, event, tier };
}

export type EventChoice = 'accept' | 'decline' | 'none';
export type EventResult = { progress: Progress; moneyDelta: number; focusDelta: number; notice: string[] };
/** 사건 효과. 식사: 돈 +20,000·집중력 +20·대화 +1. 교재비: 빌려주면 −50,000·+2·답례 플래그, 거절 +1. 재고 정리: 사탕 해금·+1. */
export function applyEvent(p: Progress, id: SerinEventId, choice: EventChoice = 'none'): EventResult {
  const bumpAff = (q: Progress, by: number): Progress => ({ ...q, serin: { ...q.serin, affinity: q.serin.affinity + by } });
  if (id === 'meal') {
    const m = addMoney(p, MEAL_MONEY);
    const before = m.progress.focus;
    const next = bumpAff(withFocus(m.progress, before + MEAL_FOCUS), AFFINITY.talk);
    return { progress: next, moneyDelta: m.applied, focusDelta: next.focus - before, notice: [`집중력 ${before} → ${next.focus}`, `${formatPlus(m.applied)} (손님이 두고 간 거야)`] };
  }
  if (id === 'textbook') {
    if (choice === 'accept') {
      if (p.money < TEXTBOOK_COST) return { progress: p, moneyDelta: 0, focusDelta: 0, notice: ['돈이 모자라 빌려줄 수 없다.'] };
      const m = addMoney(p, -TEXTBOOK_COST);
      return { progress: bumpAff(setFlag(m.progress, 'serin.textbookOwed'), AFFINITY.talkBig), moneyDelta: m.applied, focusDelta: 0, notice: [`${formatPlus(m.applied)} 빌려줬다. 적어 놓는다고 한다.`] };
    }
    return { progress: bumpAff(setFlag(p, 'serin.textbookDeclined'), AFFINITY.talk), moneyDelta: 0, focusDelta: 0, notice: ['이번엔 빌려주지 않았다.'] };
  }
  if (id === 'stock') return { progress: bumpAff(setFlag(p, FLAGS.serinStock), AFFINITY.talk), moneyDelta: 0, focusDelta: 0, notice: ['상점에 포도당 사탕이 들어왔다.'] };
  return { progress: p, moneyDelta: 0, focusDelta: 0, notice: ['(다음 단계에서 이어진다)'] };
}
const formatPlus = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toLocaleString('ko-KR')}원`;
