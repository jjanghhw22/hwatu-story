// 대국 결과 정산 연출(요청 19): 승/패 도장 → 세로 전표(정산표) 항목이 한 줄씩 → 수첩 기록 줄 → 하단 버튼.
// 값은 TableScene이 확정 결과에서 만들어 넘기고 여기서는 표시만 한다(재계산 없음). 색·서체는 theme 토큰, 패널·버튼은 components 부품만 쓴다.
// 전표 줄 구성(receiptRows)은 순수 함수로 분리해 node 테스트로 검증한다.
import type Phaser from 'phaser';
import type { Score } from '../score.ts';
import { makeButton, makePanel } from './components.ts';
import { COLORS, FONTS, TEXT_STYLES, colorNum } from './theme.ts';

/** 전표 한 줄: 왼쪽 항목·오른쪽 값. big은 굵은 합계 줄(위에 점선 구분). */
export type ResultRow = { label: string; value: string; color?: string; big?: boolean };

/** 전표 줄을 만드는 데 필요한 확정 값. 호출 쪽(TableScene)이 결과 객체·배수에서 채운다. */
export type ReceiptInput = {
  outcome: '승리' | '나가리';
  /** 내가 이겼는가(최종 줄 색). */
  won: boolean;
  /** 점수 내역 머리에 쓸 승자 이름과 설명 줄에 쓸 상대 이름. */
  winnerName: string; oppName: string;
  /** 합의 종료(접음·잡기·들통)면 그 종류. */
  endKind?: 'fold' | 'caught' | 'bust';
  /** 승자의 획득 패 점수 내역(나가리면 null). */
  score: Score | null;
  base: number; goCount: number; settled: number;
  baks: string[]; multiplier: number;
  declaredText: string; declMultiplier: number;
  missionMult: number; betMult: number;
  finalPts: number;
  /** 판돈 정산(판돈 있는 판만). text는 호출 쪽이 포맷한 ±금액. 연습 대결은 생략 → 점수만 보인다. */
  money?: { delta: number; text: string };
};

/** 정산표 줄(순수 함수): 점수 내역(피/띠/열끗/광/족보) → 기본 → 고 → 박 → 선언 → 미션·판돈 배수 → 최종 → 금액. */
export function receiptRows(i: ReceiptInput): ResultRow[] {
  if (i.outcome !== '승리') return [
    { label: '승자 없음 — 아무도 스톱하지 않았다', value: '' },
    { label: '박·정산·이월 없음(미션 무효)', value: '', color: COLORS.textDim },
  ];
  const rows: ResultRow[] = [];
  if (i.endKind === 'fold') rows.push({ label: `접음 — ${i.oppName}의 기본 점수 그대로(고·박·배수 없음)`, value: '', color: COLORS.textDim });
  if (i.endKind === 'caught') rows.push({ label: `잡았다 — ${i.oppName}의 속임수를 잡아 판 몰수(기준 최소 7점)`, value: '', color: COLORS.textDim });
  if (i.endKind === 'bust') rows.push({ label: '들통 — 내 손이 잡혀 즉시 패배(승자 기준 최소 7점)', value: '', color: COLORS.textDim });
  const s = i.score;
  if (s) {
    rows.push({ label: `점수 내역 — ${i.winnerName}`, value: '', color: COLORS.textDim });
    rows.push({ label: `피 ${s.피.cards.length}장 · 가치 ${s.피.value}`, value: `${s.피.points}점` });
    rows.push({ label: `띠 ${s.띠.cards.length}장`, value: `${s.띠.points}점` });
    rows.push({ label: `열끗 ${s.열끗.cards.length}장`, value: `${s.열끗.points}점` });
    rows.push({ label: `광 ${s.광.cards.length}장`, value: `${s.광.points}점` });
    const jokbo = [...s.광.bonuses, ...s.열끗.bonuses, ...s.띠.bonuses];
    rows.push({ label: '족보(점수는 위에 포함)', value: jokbo.length ? jokbo.join(' · ') : '없음', color: jokbo.length ? COLORS.gold : COLORS.textDim });
  }
  rows.push({ label: '기본 점수', value: `${i.base}점` });
  if (i.endKind !== 'fold') rows.push({ label: '고 배수', value: i.goCount > 0 ? `${i.goCount}고 → ${i.settled}점` : '없음', color: i.goCount > 0 ? COLORS.text : COLORS.textDim });
  if (!i.endKind) {
    rows.push({ label: '박 배수', value: i.baks.length ? `${i.baks.join(' · ')} ×${i.multiplier}` : '없음', color: i.baks.length ? COLORS.red : COLORS.textDim });
    if (i.declMultiplier > 1) rows.push({ label: '선언 배수', value: `${i.declaredText} ×${i.declMultiplier}`, color: COLORS.red });
  }
  if (i.missionMult > 1) rows.push({ label: '미션', value: `×${i.missionMult}`, color: COLORS.gold });
  if (i.betMult > 1) rows.push({ label: '판돈 제안 수락', value: `×${i.betMult}`, color: COLORS.red });
  rows.push({ label: '최종', value: `${i.finalPts}점`, color: i.won ? COLORS.gold : COLORS.red, big: true });
  if (i.money) rows.push({
    label: i.endKind === 'fold' ? '접기 비용' : '판돈 정산', value: i.money.text, big: true,
    color: i.money.delta > 0 ? COLORS.gold : i.money.delta < 0 ? COLORS.red : COLORS.textDim,
  });
  return rows;
}

export type ResultBoardSpec = {
  /** 도장 글자('승'·'패'·'무')와 색. */
  stamp: { text: string; color: string };
  title: string;
  /** 제목 아래 작은 설명(판이 끝난 사정)과 상대 반응 대사. 없으면 줄 생략. */
  subtitle?: string; quote?: string;
  rows: ResultRow[];
  /** 수첩 기록 줄 "수첩에 기록됨 — ○○". 없으면 줄 자체를 생략. noteIconKey가 로드돼 있지 않으면 theme 색 수첩 모양. */
  note?: string; noteIconKey?: string;
  buttons: { text: string; onTap: () => void }[];
  /** 연출 줄이기: 애니메이션 없이 즉시 완성 상태. */
  reduced: boolean;
};

const W = 560, PAD = 24, ROW_H = 34, BIG_H = 46, NOTE_H = 40, BTN_H = 52, BTN_GAP = 10;
/** 도장 0.3초, 전표 항목 0.15초 간격(요청 19 명세 값). */
const STAMP_MS = 300, STAMP_HOLD = 320, STAMP_MOVE_MS = 200, ROW_MS = 150, STAMP_ANGLE = -8;
const STAMP_SIZE = 96, STAMP_END_SCALE = 60 / STAMP_SIZE;

/**
 * 결과 전표를 띄운다. 씬의 draw()와 무관한 별도 컨테이너(depth 900)라 재그리기에 지워지지 않고,
 * 뒤 입력은 어두운 막이 차단한다. 어디를 눌러도 즉시 완성(스킵)되고, 버튼은 완성된 뒤에만 보인다.
 */
export function showResultBoard(scene: Phaser.Scene, spec: ResultBoardSpec): { container: Phaser.GameObjects.Container; skip(): void } {
  const sw = scene.scale.width, sh = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(900);
  const dim = scene.add.rectangle(0, 0, sw, sh, colorNum(COLORS.shadow), 0.72).setOrigin(0).setInteractive();
  root.add(dim);
  const headH = 36 + (spec.subtitle ? 24 : 0) + (spec.quote ? 28 : 0);
  const rowsH = spec.rows.reduce((a, r) => a + (r.big ? BIG_H : ROW_H), 0);
  const noteH = spec.note ? NOTE_H : 0;
  const btnsH = spec.buttons.length ? spec.buttons.length * (BTN_H + BTN_GAP) - BTN_GAP : 0;
  const h = PAD + headH + 10 + rowsH + noteH + 14 + btnsH + PAD;
  const x = Math.round((sw - W) / 2), y = Math.round(Math.max(16, (sh - h) / 2));
  root.add(makePanel(scene, x, y, W, h));
  // 머리: 제목 + 설명 + 상대 반응 대사(도장이 내려앉을 오른쪽 자리는 비워 둔다)
  const headW = W - PAD * 2 - 96;
  root.add(scene.add.text(x + PAD, y + PAD, spec.title, TEXT_STYLES.h2));
  let hy = y + PAD + 34;
  if (spec.subtitle) { root.add(scene.add.text(x + PAD, hy, spec.subtitle, { ...TEXT_STYLES.caption, wordWrap: { width: headW } })); hy += 24; }
  if (spec.quote) root.add(scene.add.text(x + PAD, hy, `“${spec.quote}”`, { ...TEXT_STYLES.caption, color: COLORS.gold, wordWrap: { width: headW } }));
  const sep = scene.add.graphics();
  sep.lineStyle(1, colorNum(COLORS.goldDim), 1).lineBetween(x + PAD, y + PAD + headH + 2, x + W - PAD, y + PAD + headH + 2);
  root.add(sep);
  // 전표 줄: 최종 배치로 만들어 두고 한 줄씩 드러낸다(스킵·연출 줄이기는 전부 즉시 표시)
  const steps: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | Phaser.GameObjects.Image)[][] = [];
  let cy = y + PAD + headH + 10;
  for (const r of spec.rows) {
    const rh = r.big ? BIG_H : ROW_H;
    const objs: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = [];
    if (r.big) { // 합계 줄 위 점선(전표 느낌)
      const g = scene.add.graphics().lineStyle(1, colorNum(COLORS.goldDim), 1);
      for (let dx = 0; dx < W - PAD * 2; dx += 12) g.lineBetween(x + PAD + dx, cy + 4, x + PAD + Math.min(dx + 6, W - PAD * 2), cy + 4);
      objs.push(g);
    }
    const size = r.big ? 26 : 17, midY = cy + rh / 2 + (r.big ? 2 : 0);
    objs.push(scene.add.text(x + PAD, midY, r.label, {
      fontFamily: r.big ? FONTS.title : FONTS.body, fontSize: size,
      color: r.big ? (r.color ?? COLORS.text) : COLORS.textDim,
      wordWrap: { width: W - PAD * 2 - (r.value ? 120 : 0) },
    }).setOrigin(0, 0.5));
    if (r.value) objs.push(scene.add.text(x + W - PAD, midY, r.value, {
      fontFamily: r.big ? FONTS.title : FONTS.body, fontSize: size, color: r.color ?? COLORS.text, fontStyle: r.big ? 'bold' : undefined,
    }).setOrigin(1, 0.5));
    for (const o of objs) root.add(o);
    steps.push(objs);
    cy += rh;
  }
  // 수첩 기록 줄(있을 때만): 아이콘 그림이 없으면 theme 색 수첩 모양(여정 지도와 같은 폴백)
  if (spec.note) {
    const objs: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | Phaser.GameObjects.Image)[] = [];
    const iy = cy + NOTE_H / 2;
    if (spec.noteIconKey && scene.textures.exists(spec.noteIconKey)) objs.push(scene.add.image(x + PAD + 14, iy, spec.noteIconKey).setDisplaySize(28, 28));
    else {
      const g = scene.add.graphics();
      g.fillStyle(colorNum(COLORS.panel), 1).fillRoundedRect(x + PAD + 3, iy - 12, 20, 24, 3);
      g.lineStyle(1, colorNum(COLORS.goldDim), 1).strokeRoundedRect(x + PAD + 3, iy - 12, 20, 24, 3);
      g.lineStyle(1, colorNum(COLORS.textDim), 1);
      for (let i = 0; i < 3; i++) g.lineBetween(x + PAD + 7, iy - 6 + i * 6, x + PAD + 19, iy - 6 + i * 6);
      objs.push(g);
    }
    objs.push(scene.add.text(x + PAD + 34, iy, `수첩에 기록됨 — ${spec.note}`, { fontFamily: FONTS.body, fontSize: 16, color: COLORS.gold }).setOrigin(0, 0.5));
    for (const o of objs) root.add(o);
    steps.push(objs);
    cy += NOTE_H;
  }
  // 하단 버튼(완성 전에는 숨김 → 스킵 탭이 버튼을 잘못 누르지 않는다)
  cy += 14;
  const btns = spec.buttons.map(b => {
    const btn = makeButton(scene, x + PAD, cy, W - PAD * 2, BTN_H, b.text, b.onTap);
    root.add(btn.container); cy += BTN_H + BTN_GAP; return btn;
  });
  // 승/패 도장: 화면 중앙에 찍힌 뒤 전표 머리 오른쪽으로 내려앉는다
  const stamp = scene.add.text(sw / 2, sh / 2, spec.stamp.text, { ...TEXT_STYLES.h1, fontSize: STAMP_SIZE, color: spec.stamp.color }).setOrigin(0.5);
  root.add(stamp);
  const stampEnd = { x: x + W - PAD - 40, y: y + PAD + 28 };

  const timers: Phaser.Time.TimerEvent[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    for (const t of timers) t.remove(false);
    for (const tw of tweens) tw.remove();
    stamp.setPosition(stampEnd.x, stampEnd.y).setScale(STAMP_END_SCALE).setAngle(STAMP_ANGLE).setAlpha(1);
    for (const ss of steps) for (const o of ss) o.setAlpha(1);
    for (const b of btns) b.container.setVisible(true);
  };
  dim.on('pointerdown', finish); // 탭 한 번으로 즉시 완성(스킵)
  if (spec.reduced) { finish(); return { container: root, skip: finish }; }
  // 숨긴 상태에서 시작
  for (const ss of steps) for (const o of ss) o.setAlpha(0);
  for (const b of btns) b.container.setVisible(false);
  stamp.setScale(1.4).setAlpha(0);
  // 1) 도장: 0.3초, 스케일 1.4→1.0, 살짝 기울이며 찍힌다 → 잠깐 뒤 전표 머리로 축소 이동
  tweens.push(scene.tweens.add({ targets: stamp, scale: 1, alpha: 1, angle: STAMP_ANGLE, duration: STAMP_MS, ease: 'Cubic.easeIn' }));
  timers.push(scene.time.delayedCall(STAMP_MS + STAMP_HOLD, () => {
    if (!finished) tweens.push(scene.tweens.add({ targets: stamp, x: stampEnd.x, y: stampEnd.y, scale: STAMP_END_SCALE, duration: STAMP_MOVE_MS, ease: 'Cubic.easeInOut' }));
  }));
  // 2) 전표 항목이 0.15초 간격으로 한 줄씩 → 수첩 줄 → 마지막에 버튼 표시(완성)
  let idx = 0;
  timers.push(scene.time.delayedCall(STAMP_MS, () => {
    if (finished) return;
    timers.push(scene.time.addEvent({ delay: ROW_MS, repeat: steps.length, callback: () => {
      if (finished) return;
      if (idx < steps.length) { for (const o of steps[idx]) o.setAlpha(1); idx++; }
      else finish();
    } }));
  }));
  return { container: root, skip: finish };
}
