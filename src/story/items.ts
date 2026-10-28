// 편의점 아이템 데이터(바이블 7절, 10개). 효과는 설명 글자 + 수치 필드. 동작은 다음 단계(F2).
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
  /** 수치: 집중력 변화(+N) / 전부 회복 / 최대치 변화 / 의심도 변화 / 성공률 보정(%p). 없는 값은 0·false. */
  focus: number;
  focusFull: boolean;
  focusMax: number;
  suspicion: number;
  successBonus: number;
};

const item = (id: ItemId, no: number, name: string, kind: ItemKind, effect: string, limit: string, unlock: string, v: Partial<Pick<Item, 'focus' | 'focusFull' | 'focusMax' | 'suspicion' | 'successBonus'>> = {}): Item =>
  ({ id, no, name, kind, effect, limit, unlock, focus: 0, focusFull: false, focusMax: 0, suspicion: 0, successBonus: 0, ...v });

export const ITEMS: readonly Item[] = [
  item('riceBall', 1, '참치 삼각김밥', 'consumable', '집중력 +20', '대결 중 불가', '처음부터', { focus: 20 }),
  item('canCoffee', 2, '진한 캔커피', 'consumable', '집중력 전부 회복, 다음 대결 첫 기술 비용 −10', '같은 대결 중첩 불가', '2장 첫 대화', { focusFull: true }),
  item('glucoseCandy', 3, '포도당 사탕', 'consumable', '대결 중 집중력 +25', '대결당 1회', '서린 재고 정리 부탁', { focus: 25 }),
  item('warmLunch', 4, '따뜻한 도시락', 'consumable', '집중력 전부 + 다음 대결 최대치 +20', '대결 전', '4장', { focusFull: true, focusMax: 20 }),
  item('sleepMask', 5, '숙면 안대', 'gear', '집 휴식 후 첫 대결 집중력 +30', '휴식해야 적용', '첫 귀가 이벤트', { focus: 30 }),
  item('xrayGlasses', 6, '투시경 안경', 'gear', '상대 손패 무작위 1장 공개', '대결당 1회, 의심도 +20', '5장 고물상', { suspicion: 20 }),
  item('blankMask', 7, '무표정 마스크', 'gear', '속임수로 오른 의심도 1회 −30', '들통을 막지는 못함', '3장', { suspicion: -30 }),
  item('luckyCoin', 8, '행운의 동전', 'consumable', '다음 확률 기술 성공률 +15%p(최대 90%)', '1회', '태오 이벤트', { successBonus: 15 }),
  item('buzzWatch', 9, '진동 손목시계', 'gear', '상대 기술 준비 시 1회 경고(종류 비공개)', '—', '7장'),
  item('pocketWatch', 10, '낡은 회중시계', 'gear', '일반 기술 1개 재사용 대기 초기화', '대결당 1회, 희귀 기술 제외', '9장 사건'),
];
export const ITEM_IDS = ITEMS.map(i => i.id);
/** 장비는 동시에 2칸만(바이블 3절). */
export const GEAR_SLOTS = 2;
