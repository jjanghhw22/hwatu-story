// 편의점 아이템 데이터(바이블 7절, 10개). 효과는 설명 글자 + 수치 필드.
// 동작(F2·F3): 삼각김밥·캔커피·행운의 동전(지도에서 사용), 포도당 사탕(대결 중), 숙면 안대·무표정 마스크·투시경 안경(장비). 진동 손목시계·회중시계·도시락은 데이터만.
// 상점 해금은 Progress.flags의 플래그로 판정한다(unlockFlag가 null이면 처음부터).
export type ItemId = 'riceBall' | 'canCoffee' | 'glucoseCandy' | 'warmLunch' | 'sleepMask' | 'xrayGlasses' | 'blankMask' | 'luckyCoin' | 'buzzWatch' | 'pocketWatch';
export type ItemKind = 'consumable' | 'gear';

export type Item = {
  id: ItemId;
  no: number;
  name: string;
  kind: ItemKind;
  /** 효과(바이블 표 그대로). */
  effect: string;
  /** 제한(바이블 표 그대로). */
  limit: string;
  /** 해금 조건(바이블 표 그대로). */
  unlock: string;
  /** 상점 해금 플래그(Progress.flags 키). null이면 처음부터. */
  unlockFlag: string | null;
  /** 상점 가격(원). null이면 팔지 않는다(사건으로만 얻음). */
  price: number | null;
  /** 어디서 쓰는지: 지도(대결 밖) / 대결 중 / 장비(집에서 장착, 2칸) / 없음. */
  use: 'map' | 'match' | 'gear' | 'none';
  /** 수치: 집중력 변화(+N) / 전부 회복 / 최대치 변화 / 의심도 변화 / 성공률 보정(%p). 없는 값은 0·false. */
  focus: number;
  focusFull: boolean;
  focusMax: number;
  suspicion: number;
  successBonus: number;
};

type Vals = Partial<Pick<Item, 'focus' | 'focusFull' | 'focusMax' | 'suspicion' | 'successBonus'>>;
const item = (id: ItemId, no: number, name: string, kind: ItemKind, effect: string, limit: string, unlock: string, unlockFlag: string | null, price: number | null, use: Item['use'], v: Vals = {}): Item =>
  ({ id, no, name, kind, effect, limit, unlock, unlockFlag, price, use, focus: 0, focusFull: false, focusMax: 0, suspicion: 0, successBonus: 0, ...v });

/** 플래그 키(한곳에서 관리). */
export const FLAGS = {
  ch2Talked: 'ch2.talked', serinStock: 'serin.stock', homeFirstRest: 'home.firstRest', serinJunk: 'serin.junk', taeohCoin: 'taeoh.coin', serinWatch: 'serin.watch',
  /** 캔커피: 다음 대결 첫 기술 비용 −10. */
  coffeeBoost: 'coffee.boost',
  /** 행운의 동전: 다음 바꿔치기 성공률 +15%p. */
  coinBoost: 'coin.boost',
  /** 숙면 안대를 끼고 집에서 쉼: 다음 대결 집중력 +30. */
  maskRested: 'mask.rested',
  /** 눈썰미 강화(4장 이후): 더미 윗장 2장 보기. */
  eyePlus: 'eye+',
} as const;
export const COFFEE_DISCOUNT = 10;

export const ITEMS: readonly Item[] = [
  item('riceBall', 1, '참치 삼각김밥', 'consumable', '집중력 +20', '대결 중 불가', '처음부터', null, 1500, 'map', { focus: 20 }),
  item('canCoffee', 2, '진한 캔커피', 'consumable', '집중력 전부 회복, 다음 대결 첫 기술 비용 −10', '같은 대결 중첩 불가', '2장 첫 대화', FLAGS.ch2Talked, 2500, 'map', { focusFull: true }),
  item('glucoseCandy', 3, '포도당 사탕', 'consumable', '대결 중 집중력 +25', '대결당 1회', '서린 재고 정리 부탁', FLAGS.serinStock, 1200, 'match', { focus: 25 }),
  item('warmLunch', 4, '따뜻한 도시락', 'consumable', '집중력 전부 + 다음 대결 최대치 +20', '대결 전', '4장', 'ch4.done', 6000, 'none', { focusFull: true, focusMax: 20 }),
  item('sleepMask', 5, '숙면 안대', 'gear', '집 휴식 후 첫 대결 집중력 +30', '휴식해야 적용', '첫 귀가 이벤트(집에서 처음 휴식)', FLAGS.homeFirstRest, 15000, 'gear', { focus: 30 }),
  item('xrayGlasses', 6, '투시경 안경', 'gear', '상대 손패 무작위 1장 공개', '대결당 1회, 의심도 +20', '5장 고물상(서린 희귀 답례 → 상점 뒷방)', FLAGS.serinJunk, 30000, 'gear', { suspicion: 20 }),
  item('blankMask', 7, '무표정 마스크', 'gear', '속임수로 오른 의심도 1회 −30', '들통을 막지는 못함', '3장', 'ch3.done', 8000, 'gear', { suspicion: -30 }),
  item('luckyCoin', 8, '행운의 동전', 'consumable', '다음 확률 기술 성공률 +15%p(최대 90%)', '1회', '태오 이벤트', FLAGS.taeohCoin, null, 'map', { successBonus: 15 }),
  item('buzzWatch', 9, '진동 손목시계', 'gear', '상대 기술 준비 시 1회 경고(종류 비공개)', '—', '7장', 'ch7.done', null, 'gear'),
  item('pocketWatch', 10, '낡은 회중시계', 'gear', '일반 기술 1개 재사용 대기 초기화', '대결당 1회, 희귀 기술 제외', '9장 사건', FLAGS.serinWatch, null, 'gear'),
];
export const ITEM_IDS = ITEMS.map(i => i.id);
export const isItemId = (v: unknown): v is ItemId => typeof v === 'string' && ITEMS.some(i => i.id === v);
export function itemById(id: ItemId): Item { return ITEMS.find(i => i.id === id)!; }
/** 장비는 동시에 2칸만(바이블 3절). */
export const GEAR_SLOTS = 2;

/** 상점 해금 여부: 플래그가 없거나 켜져 있으면. */
export function isItemUnlocked(it: Item, flags: Record<string, boolean>): boolean { return it.unlockFlag === null || flags[it.unlockFlag] === true; }
/** 지금 상점에 진열되는 것(해금 + 가격 있음), 번호순. */
export function shopItems(flags: Record<string, boolean>): Item[] { return ITEMS.filter(i => i.price !== null && isItemUnlocked(i, flags)); }
