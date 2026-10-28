// 개발용 고정 시나리오. 특수 상황(쪽·뻑·따닥·쓸 등)을 같은 패 구성으로 재현한다. 일반 게임의 무작위 배분과는 별개다.
// id = (월-1)*4 + 슬롯. 1월: 0 광, 1 홍단, 2 피, 3 피 / 2월: 4 매조, 5 홍단, 6 피, 7 피 / 3월: 8 광, 9 홍단, 10 피, 11 피 / 4월: 12 두견새, 13 초단, 14 피, 15 피
import { CARDS } from './cards.ts';
import type { Setup } from './game.ts';

export type Scenario = { key: string; title: string; desc: string; setup: Setup };

type Partial = { hand0: number[]; hand1?: number[]; table: number[]; deckTop: number[]; tableSize?: number; fillMonths?: number[]; handSizes?: [number, number]; flipChances?: [number, number]; /** 이미 획득한 패(족보·고/스톱 재현용). */ captured0?: number[]; captured1?: number[] };
/**
 * 지정한 카드 외의 자리는 시나리오와 무관한 월(기본 5~12월)의 카드로 id 순서대로 채운다.
 * 손패는 10장, 바닥은 tableSize(기본 8)장까지 채우고 나머지는 더미 뒤쪽에 둔다.
 */
export function buildSetup(p: Partial): Setup {
  const used = new Set<number>([...p.hand0, ...(p.hand1 ?? []), ...p.table, ...p.deckTop, ...(p.captured0 ?? []), ...(p.captured1 ?? [])]);
  const fillMonths = p.fillMonths ?? [5, 6, 7, 8, 9, 10, 11, 12];
  const fillers = CARDS.filter(c => !used.has(c.id) && fillMonths.includes(c.month)).map(c => c.id);
  const rest = CARDS.filter(c => !used.has(c.id) && !fillMonths.includes(c.month)).map(c => c.id);
  const take = (n: number) => fillers.splice(0, n);
  const sizes = p.handSizes ?? [10, 10];
  const hand0 = [...p.hand0, ...take(Math.max(0, sizes[0] - p.hand0.length))];
  const hand1 = [...(p.hand1 ?? []), ...take(Math.max(0, sizes[1] - (p.hand1 ?? []).length))];
  const table = [...p.table, ...take(Math.max(0, (p.tableSize ?? 8) - p.table.length))];
  const deck = [...p.deckTop, ...fillers, ...rest];
  return { hands: [hand0, hand1], table, deck, ...(p.flipChances ? { flipChances: p.flipChances } : {}), ...(p.captured0 || p.captured1 ? { captured: [p.captured0 ?? [], p.captured1 ?? []] as [number[], number[]] } : {}) };
}

export const SCENARIOS: Scenario[] = [
  { key: 'jjok', title: '쪽', desc: '1월 피를 내면 바닥에 1월이 없고, 바로 뒤집는 더미 패가 1월 피 → 두 장 획득 + 상대 피 1장.',
    setup: buildSetup({ hand0: [2], hand1: [0, 1], table: [], deckTop: [3] }) },
  { key: 'ppeok', title: '뻑 만들기', desc: '바닥의 1월 피에 1월 피를 맞추는데 더미 패가 1월 홍단 → 세 장이 바닥에 남는다. 다음 턴 1월 광으로 자뻑 회수(상대 피 2장).',
    setup: buildSetup({ hand0: [3, 0], table: [2], deckTop: [1] }) },
  { key: 'ppeok-other', title: '상대 뻑 회수', desc: '내가 뻑을 만들면 상대가 1월 광으로 그 묶음을 가져간다(상대가 내 피 1장).',
    setup: buildSetup({ hand0: [3], hand1: [0], table: [2], deckTop: [1] }) },
  { key: 'ttadak', title: '따닥', desc: '바닥에 2월 피 두 장, 2월 매조를 내면 더미 패도 2월 홍단 → 선택창 없이 4장 획득 + 상대 피 1장.',
    setup: buildSetup({ hand0: [4], table: [6, 7], deckTop: [5] }) },
  { key: 'choice', title: '두 장 중 선택(따닥 아님)', desc: '바닥에 2월 피 두 장, 2월 매조를 내는데 더미 패는 다른 월 → 어느 피를 가져올지 고른다.',
    setup: buildSetup({ hand0: [4], table: [6, 7], deckTop: [20] }) },
  { key: 'sseul', title: '쓸', desc: '바닥 두 장(3월 피, 4월 피)을 3월 광과 더미의 4월 피로 모두 가져가 바닥이 비면 쓸 + 상대 피 1장.',
    setup: buildSetup({ hand0: [8], table: [10, 14], deckTop: [15], tableSize: 2 }) },
  { key: 'ttadak-sseul', title: '따닥 + 쓸', desc: '바닥이 2월 피 두 장뿐일 때 따닥으로 바닥을 비우면 보너스 합산(상대 피 2장).',
    setup: buildSetup({ hand0: [4], table: [6, 7], deckTop: [5], tableSize: 2 }) },
  { key: 'initial-three', title: '처음 깔린 3장', desc: '바닥에 1월 세 장이 처음부터 깔려 있다. 1월 피로 네 장을 가져가지만 뻑 회수 보너스는 없다.',
    setup: buildSetup({ hand0: [3], table: [0, 1, 2], deckTop: [20] }) },
  { key: 'shake', title: '흔들기', desc: '손패에 1월 세 장(광·홍단·피)과 3월 세 장이 있고 바닥에는 그 월이 없다. 그 월의 카드를 누르면 세 장을 공개(흔들기)한 뒤 누른 카드 한 장을 낸다. 승자의 흔들기만 정산 배수에 들어간다.',
    setup: buildSetup({ hand0: [0, 1, 2, 8, 9, 10], table: [], deckTop: [20] }) },
  { key: 'bomb', title: '폭탄', desc: '손패에 1월 세 장, 바닥에 1월 피 한 장. 1월 카드를 누르면 세 장이 함께 나가 4장을 획득하고 상대 피 1장, 손패 영역에 기회 패 2장이 생긴다.',
    setup: buildSetup({ hand0: [0, 1, 2], table: [3], deckTop: [20] }) },
  { key: 'bomb-vs-shake', title: '폭탄 우선과 자동 흔들기', desc: '1월 세 장은 바닥에 1월이 있어 누르면 폭탄, 3월 세 장은 바닥에 3월이 없어 누르면 흔들기 공개 뒤 그 카드를 낸다. 같은 월에 흔들기와 폭탄이 겹쳐도 정산 배수는 한 번(×2)이다.',
    setup: buildSetup({ hand0: [0, 1, 2, 8, 9, 10], table: [3], deckTop: [20] }) },
  { key: 'flip-only', title: '손패 없이 기회만 남음', desc: '내 손패는 없고 기회 패 2장만 있다. 기회 패를 누르면 더미 한 장만 처리하며, 기회가 다 떨어져야 판이 끝난다.',
    setup: buildSetup({ hand0: [], hand1: [], table: [2, 24], deckTop: [3, 25], handSizes: [0, 2], flipChances: [2, 0] }) },
  { key: 'empty-floor', title: '빈 바닥 시작', desc: '바닥이 비어 있어 손패와 더미 패가 그대로 놓인다. 쓸이 아니다.',
    setup: buildSetup({ hand0: [2], table: [], deckTop: [20], tableSize: 0 }) },
  { key: 'combo', title: '족보 완성(고도리)', desc: '매조·두견새를 이미 모았다. 8월 기러기로 바닥의 8월 피를 가져가면 고도리가 완성되어 강조·이름·점수 변화가 표시된다. 삼광도 한 장 남은 상태(힌트 표시).',
    setup: buildSetup({ hand0: [29, 8], table: [30, 34], deckTop: [20], captured0: [4, 12, 0, 28], fillMonths: [5, 6, 7, 10, 11, 12] }) },
  { key: 'gukjin', title: '국진 선택', desc: '9월 국진을 내 9월 청단으로 가져간 뒤 열끗/쌍피 선택창이 뜬다. 한 판에 한 번만 정한다.',
    setup: buildSetup({ hand0: [33], table: [32], deckTop: [20], fillMonths: [5, 6, 7, 8, 10, 11, 12] }) },
  { key: 'gostop', title: '고/스톱', desc: '삼광과 피 12장(6점)을 모은 상태. 5월 피로 바닥의 5월 피를 가져가면 피 14장으로 8점이 되어 고/스톱 선택창이 뜬다. 스톱하면 결과창이 순서대로 펼쳐진다.',
    setup: buildSetup({ hand0: [19], table: [18], deckTop: [20], captured0: [0, 8, 28, 2, 3, 6, 7, 10, 11, 14, 15, 22, 23, 26, 27], fillMonths: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12] }) },
];

export function findScenario(key: string) { return SCENARIOS.find(s => s.key === key); }

/** 마지막 행동 예외 재현: 내 마지막 손패가 바닥에 없는 월이고 더미 윗장이 같은 월(쪽 모양이지만 보너스 없음). 상대는 행동 없음. */
export const LAST_ACTION_SETUP: Setup = buildSetup({ hand0: [2], hand1: [], table: [24], deckTop: [3, 20], handSizes: [1, 0] });
