// 결과 전표 줄(요청 19, 순수 함수) 검증: 점수 내역·배수 줄 구성, 판돈 유무, 접음·잡기·나가리의 특수 줄.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from '../cards.ts';
import { scoreCaptured } from '../score.ts';
import { type ReceiptInput, receiptRows } from './result.ts';
import { COLORS } from './theme.ts';

/** 기본 입력(연습 대결 승리, 획득 패 없음). 각 테스트가 필요한 부분만 덮어쓴다. */
const base = (over: Partial<ReceiptInput> = {}): ReceiptInput => ({
  outcome: '승리', won: true, winnerName: '도윤', oppName: '장대식',
  score: scoreCaptured([]), base: 3, goCount: 0, settled: 3,
  baks: [], multiplier: 1, declaredText: '', declMultiplier: 1,
  missionMult: 1, betMult: 1, finalPts: 3, ...over,
});
const labels = (rows: ReturnType<typeof receiptRows>) => rows.map(r => r.label);

test('연습 대결(판돈 없음): 점수 내역 피/띠/열끗/광/족보 → 기본 → 고 → 박 → 최종, 돈 줄은 없다', () => {
  const rows = receiptRows(base());
  const ls = labels(rows);
  for (const want of ['점수 내역', '피 ', '띠 ', '열끗 ', '광 ', '족보', '기본 점수', '고 배수', '박 배수', '최종'])
    assert.ok(ls.some(l => l.startsWith(want)), `${want} 줄이 있어야 한다`);
  assert.ok(!ls.includes('판돈 정산') && !ls.includes('접기 비용'), '판돈 없는 판은 점수만');
  const last = rows[rows.length - 1];
  assert.equal(last.label, '최종'); assert.ok(last.big); assert.equal(last.color, COLORS.gold, '승리 최종은 gold');
});

test('족보 줄: 고도리가 있으면 이름이 금색으로, 없으면 "없음"', () => {
  const godori = CARDS.filter(c => c.godori);
  assert.equal(godori.length, 3);
  const rows = receiptRows(base({ score: scoreCaptured(godori) }));
  const jokbo = rows.find(r => r.label.startsWith('족보'))!;
  assert.ok(jokbo.value.includes('고도리')); assert.equal(jokbo.color, COLORS.gold);
  const none = receiptRows(base()).find(r => r.label.startsWith('족보'))!;
  assert.equal(none.value, '없음');
});

test('판돈 있는 판: 증가는 gold, 감소는 red, 패배의 최종 점수 줄은 red', () => {
  const winRows = receiptRows(base({ money: { delta: 12000, text: '+12,000원' } }));
  const win = winRows[winRows.length - 1];
  assert.equal(win.label, '판돈 정산'); assert.equal(win.color, COLORS.gold); assert.ok(win.big);
  const loseRows = receiptRows(base({ won: false, money: { delta: -9000, text: '−9,000원' } }));
  assert.equal(loseRows[loseRows.length - 1].color, COLORS.red);
  assert.equal(loseRows.find(r => r.label === '최종')!.color, COLORS.red, '패배 최종 점수는 red');
});

test('접음: 설명 줄이 붙고 고·박 줄이 없으며 돈 줄 이름은 "접기 비용"', () => {
  const rows = receiptRows(base({ won: false, endKind: 'fold', money: { delta: -3000, text: '−3,000원' } }));
  const ls = labels(rows);
  assert.ok(ls[0].startsWith('접음 — 장대식'));
  assert.ok(!ls.includes('고 배수') && !ls.includes('박 배수'), '접음은 고·박·배수 없음');
  assert.equal(rows[rows.length - 1].label, '접기 비용');
});

test('잡았다·들통: 설명 줄 + 고 줄은 있으나 박·선언 줄은 없다(합의 종료)', () => {
  for (const [endKind, head] of [['caught', '잡았다'], ['bust', '들통']] as const) {
    const ls = labels(receiptRows(base({ endKind, goCount: 1, settled: 8, base: 7 })));
    assert.ok(ls[0].startsWith(head), `${endKind} 설명 줄`);
    assert.ok(ls.includes('고 배수') && !ls.includes('박 배수') && !ls.includes('선언 배수'));
  }
});

test('배수 줄: 박·선언·미션·판돈 수락이 조건부로만 붙는다', () => {
  const rows = receiptRows(base({ baks: ['피박', '광박'], multiplier: 4, declaredText: '1월 흔들기', declMultiplier: 2, missionMult: 2, betMult: 2 }));
  assert.equal(rows.find(r => r.label === '박 배수')!.value, '피박 · 광박 ×4');
  assert.equal(rows.find(r => r.label === '선언 배수')!.value, '1월 흔들기 ×2');
  assert.equal(rows.find(r => r.label === '미션')!.value, '×2');
  assert.equal(rows.find(r => r.label === '판돈 제안 수락')!.value, '×2');
  const plain = labels(receiptRows(base()));
  for (const no of ['선언 배수', '미션', '판돈 제안 수락']) assert.ok(!plain.includes(no), `${no} 줄은 조건부`);
});

test('나가리: 승자 없음 두 줄뿐, 점수 내역·최종 줄 없음', () => {
  const rows = receiptRows({ ...base(), outcome: '나가리', won: false, score: null });
  assert.equal(rows.length, 2);
  assert.ok(rows[0].label.includes('승자 없음'));
  assert.ok(!labels(rows).includes('최종'));
});
