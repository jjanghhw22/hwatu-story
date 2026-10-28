// 화투 48장 카드 데이터. 화면 코드와 무관한 순수 데이터.
// id = (월-1)*4 + 슬롯(0~3). 11월은 오동, 12월은 비(한국식 순서).

export type Kind = '광' | '열끗' | '띠' | '피';
export type Band = '홍단' | '청단' | '초단' | '비띠';

export type Card = {
  id: number;          // 0..47
  month: number;       // 1..12
  name: string;        // 월 이름(솔 … 오동, 비)
  title: string;       // 패 이름(송학, 매조, 국진 …)
  kind: Kind;          // 광 / 열끗 / 띠 / 피
  band: Band | null;   // 띠일 때만. 비띠는 홍단/청단/초단 어디에도 속하지 않음
  ssangpi: boolean;    // 피 2장 가치(11월 오동 쌍피, 12월 비 쌍피)
  rainGwang: boolean;  // 12월 비광: 항상 광이지만 3광 조합에서는 2점(비삼광)
  godori: boolean;     // 고도리 구성 열끗(2월 매조, 4월 두견새, 8월 기러기)
  gukjin: boolean;     // 9월 국진: 기본은 열끗. 규칙 옵션에 따라 쌍피로 사용 가능(비광과 별개 처리)
};

type Spec = { kind: Kind; title: string; band?: Band; ssangpi?: boolean; rainGwang?: boolean; godori?: boolean; gukjin?: boolean };
const 광 = (title: string, x: Partial<Spec> = {}): Spec => ({ kind: '광', title, ...x });
const 열끗 = (title: string, x: Partial<Spec> = {}): Spec => ({ kind: '열끗', title, ...x });
const 띠 = (band: Band): Spec => ({ kind: '띠', title: band, band });
const 피 = (): Spec => ({ kind: '피', title: '피' });
const 쌍피 = (): Spec => ({ kind: '피', title: '쌍피', ssangpi: true });

const MONTHS: { name: string; cards: [Spec, Spec, Spec, Spec] }[] = [
  { name: '솔',    cards: [광('송학'),                 띠('홍단'),                      피(), 피()] },
  { name: '매화',  cards: [열끗('매조', { godori: true }), 띠('홍단'),                  피(), 피()] },
  { name: '벚꽃',  cards: [광('벚꽃'),                 띠('홍단'),                      피(), 피()] },
  { name: '등나무', cards: [열끗('두견새', { godori: true }), 띠('초단'),                피(), 피()] },
  { name: '창포',  cards: [열끗('난초'),               띠('초단'),                      피(), 피()] },
  { name: '모란',  cards: [열끗('나비'),               띠('청단'),                      피(), 피()] },
  { name: '싸리',  cards: [열끗('멧돼지'),             띠('초단'),                      피(), 피()] },
  { name: '공산',  cards: [광('보름달'),               열끗('기러기', { godori: true }), 피(), 피()] },
  { name: '국화',  cards: [열끗('국진', { gukjin: true }), 띠('청단'),                  피(), 피()] },
  { name: '단풍',  cards: [열끗('사슴'),               띠('청단'),                      피(), 피()] },
  { name: '오동',  cards: [광('봉황'),                 쌍피(),                          피(), 피()] },
  { name: '비',    cards: [광('비광', { rainGwang: true }), 열끗('제비'),              띠('비띠'), 쌍피()] },
];

export const CARDS: readonly Card[] = Object.freeze(
  MONTHS.flatMap((m, mi) =>
    m.cards.map((s, slot) =>
      Object.freeze({
        id: mi * 4 + slot,
        month: mi + 1,
        name: m.name,
        title: s.title,
        kind: s.kind,
        band: s.band ?? null,
        ssangpi: s.ssangpi ?? false,
        rainGwang: s.rainGwang ?? false,
        godori: s.godori ?? false,
        gukjin: s.gukjin ?? false,
      }),
    ),
  ),
);

export function cardById(id: number): Card {
  const c = CARDS[id];
  if (!c) throw new RangeError(`카드 id 범위 밖: ${id}`);
  return c;
}

/** 화면 표기용 짧은 분류 태그. */
export function kindLabel(c: Card): string {
  if (c.kind === '광') return c.rainGwang ? '비광' : '광';
  if (c.kind === '열끗') return c.godori ? '고도리' : c.gukjin ? '열끗·국진' : '열끗';
  if (c.kind === '띠') return c.band ?? '띠';
  return c.ssangpi ? '쌍피' : '피';
}
