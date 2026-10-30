// 플레이어 정보(초상화·선 배지·이름·상태 칩·점수 배지·손패 뒷면·대사 자리)와 획득 패 패널(한 줄 4묶음·장수 배지·박 경고). 테마: 어두운 녹색 패널 + 황동 테두리.
// 자리·크기는 layout.ts(INFO, scoreBadgeRect, activeBoxRect, flowChips, capturedRects)가 정한다.
import type { GukjinChoice } from '../game';
import type { Declared, Score } from '../score';
import type { Character, Mood } from '../character';
import { drawMiniBack, drawMiniCard } from './cardView';
import { CAPTURED_EMPTY_ALPHA, CAPTURED_TAG_H, CHIP_COLORS, COUNT_BADGE, COUNT_ICON, type CapturedRects, FOCUS_BAR, INFO, MARGIN, type Rect, SUSPICION_BAR, TEXT_MIN, activeBoxRect, capturedRects, fitChipsOneRow, focusBarRect, oppHandLayout, scoreBadgeRect, speechZone, suspicionBarRect, suspicionColor } from './layout';
import { type PortraitView, drawPortrait } from './portrait';
import { COLORS, type UI, box, chip, countBadge, label, measureText, outlined, panel } from './widgets';

export type PlayerInfo = {
  character: Character; mood: Mood; score: Score; goCount: number; gukjin: GukjinChoice | null;
  handCount?: number;      // 상대만: 붉은 뒷면으로 장수만 표시(내용은 공개하지 않음)
  /** 상대만: 뒷면을 그릴지 여부(패 나누기 연출 중 아직 도착하지 않은 장은 false). 자리는 handCount 기준으로 고정. */
  handVisible?: readonly boolean[];
  active: boolean;         // 현재 차례
  activeText: string;      // 차례 표시 문구
  ppeokCount?: number;     // 이 플레이어가 만든 뻑 묶음 수
  declared?: readonly Declared[]; // 흔들기/폭탄 선언(월별)
  flipChances?: number;    // 손패 없이 더미만 뒤집기 기회(카드가 아닌 카운터)
  /** 상대 패널: 큰 초상화·대사 자리·손패 뒷면 줄. 내 패널: 작은 초상화 한 줄. */
  big: boolean;
  /** 이 판의 선(先). 지금은 호출하는 쪽이 플레이어 0에 true를 넘긴다(선 교대 규칙 없음). */
  first: boolean;
  /** 내 패널만: 집중력(현재/최대). 있으면 이름 아래 왼쪽에 금색 바로 그린다(규칙 상태가 아니라 이야기 진행 값). */
  focus?: { cur: number; max: number };
  /** 내 패널만: 의심도(0~100). 있으면 집중력 바 오른쪽에 붉은 바. 속임수 기술·투시경이 없으면 넘기지 않는다(바 자체가 없음). */
  suspicion?: number;
  /** 상대 패널: 소지금(원, 표시용). */
  money?: number;
  /** 추가 칩(구상만 "봉쇄 N" 등). */
  extraChips?: StatusChip[];
};

export type StatusChip = { text: string; color: number; alpha?: number; /** 한 줄에 다 안 들어갈 때 쓰는 줄임말("뒤집기2", "국→쌍"). */ short?: string };
/** 상태 칩 목록: 고 칩은 항상(0이면 흐리게), 나머지는 값이 있을 때만. 순수 함수. */
export function statusChips(p: Pick<PlayerInfo, 'goCount' | 'declared' | 'flipChances' | 'gukjin' | 'ppeokCount'>): StatusChip[] {
  const decl = p.declared ?? [];
  const shakes = decl.filter(d => d.kinds.includes('흔들기')).length;
  const bombs = decl.filter(d => d.kinds.includes('폭탄')).length;
  const out: StatusChip[] = [{ text: `${p.goCount}고`, color: CHIP_COLORS.go, alpha: p.goCount > 0 ? 1 : 0.35 }];
  if (shakes) out.push({ text: `흔들기 ${shakes}`, short: `흔${shakes}`, color: CHIP_COLORS.shake });
  if (bombs) out.push({ text: `폭탄 ${bombs}`, short: `폭${bombs}`, color: CHIP_COLORS.bomb });
  if (p.flipChances) out.push({ text: `뒤집기 ${p.flipChances}`, short: `뒤집기${p.flipChances}`, color: CHIP_COLORS.other });
  if (p.gukjin) out.push({ text: `국진→${p.gukjin === '피' ? '쌍피' : '열끗'}`, short: p.gukjin === '피' ? '국→쌍' : '국→열', color: CHIP_COLORS.other });
  if (p.ppeokCount) out.push({ text: `뻑 ${p.ppeokCount}`, short: `뻑${p.ppeokCount}`, color: CHIP_COLORS.other });
  return out;
}
/** 고·흔·폭 아이콘 자리 3개(기준작 "1고 ·1 ·1" 자리): 값과 색. 0이면 회색. 순수 함수. */
export function countIcons(p: Pick<PlayerInfo, 'goCount' | 'declared'>): { text: string; n: number; color: number }[] {
  const decl = p.declared ?? [];
  const shakes = decl.filter(d => d.kinds.includes('흔들기')).length, bombs = decl.filter(d => d.kinds.includes('폭탄')).length;
  return [{ text: `고${p.goCount}`, n: p.goCount, color: COUNT_ICON.go }, { text: `흔${shakes}`, n: shakes, color: COUNT_ICON.shake }, { text: `폭${bombs}`, n: bombs, color: COUNT_ICON.bomb }];
}
/** 아이콘 3개를 x,y(왼쪽 위)부터 가로로. 지나간 오른쪽 끝 x를 돌려준다. 그림은 나중에 교체(이미지 발주 C). */
function drawCountIcons(ui: UI, x: number, y: number, p: Pick<PlayerInfo, 'goCount' | 'declared'>): number {
  const d = COUNT_ICON.d;
  countIcons(p).forEach((ic, i) => {
    const cx = x + i * (d + COUNT_ICON.gap) + d / 2, cy = y + d / 2;
    const c = ui.scene.add.circle(cx, cy, d / 2, ic.n > 0 ? ic.color : COUNT_ICON.off).setStrokeStyle(1, ic.n > 0 ? 0xffffff : 0x55524c, 0.6);
    ui.layer.add(c);
    label(ui, cx, cy, ic.text, COUNT_ICON.size, ic.n > 0 ? '#ffffff' : '#8d8577', d, [0.5, 0.5], true);
  });
  return x + 3 * d + 2 * COUNT_ICON.gap;
}

export type PlayerInfoView = { scoreText: Phaser.GameObjects.Text; portrait: PortraitView; /** 의심도 바(흔들림 연출용). */ suspicionBar?: Phaser.GameObjects.Rectangle };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
/**
 * 정보 패널(글자 최소 18). 상대: 초상화 → 이름·소지금 → 아래 줄 고·흔·폭 아이콘 + 나머지 칩, 오른쪽 구역 점수 배지·말풍선 자리·손패 뒷면·차례 상자.
 * 나: 초상화 → 왼쪽 열(이름 줄 / 집중 줄 / 의심 줄) → 오른쪽 열(x 340: 아이콘 3개, 그 아래 칩) → 차례 상자 → 점수 배지.
 * 점수 숫자 글자(강조 연출용)·초상화·의심도 바를 돌려준다.
 */
export function drawPlayerInfo(ui: UI, reg: Rect, p: PlayerInfo): PlayerInfoView {
  panel(ui, MARGIN, reg.y + 3, reg.w - MARGIN * 2, reg.h - 6, 'dark', p.active);
  const r = p.big ? INFO.portraitBig : INFO.portraitSmall;
  const cy = reg.y + reg.h / 2;
  const portrait = drawPortrait(ui, MARGIN + 14 + r, cy, r, p.character, p.mood, p.active);
  const xLeft = MARGIN + 26 + r * 2;
  let x = xLeft;
  const nameY = reg.y + 5, nameSize = INFO.nameSize;
  if (p.first) {
    const d = INFO.firstBadge.d, bcy = nameY + nameSize / 2 + 1;
    const c = ui.scene.add.circle(x + d / 2, bcy, d / 2, INFO.firstBadge.color).setStrokeStyle(1, 0xffffff, 0.6);
    ui.layer.add(c);
    label(ui, x + d / 2, bcy, '선', 14, '#ffffff', d, [0.5, 0.5], true);
    x += d + 6;
  }
  const name = label(ui, x, nameY, p.character.name, nameSize, COLORS.text, 200, [0, 0], true);
  if (p.money !== undefined) label(ui, x + name.width + 8, nameY, `${Math.round(p.money).toLocaleString('ko-KR')}원`, TEXT_MIN, COLORS.gold, 220, [0, 0], true);
  // 점수 배지(오른쪽 끝): 검은 바탕 + 황동 테두리 + 금색 큰 숫자 + "점"
  const sb = scoreBadgeRect(reg, p.big);
  box(ui, sb.x, sb.y, sb.w, sb.h, 0x111111, 0.9, COLORS.brass);
  const unit = label(ui, sb.x + sb.w - 10, sb.y + sb.h / 2 + 3, '점', 16, COLORS.gold, 30, [1, 0.5], true);
  const scoreText = label(ui, sb.x + sb.w - 10 - unit.width - 3, sb.y + sb.h / 2, String(p.score.total), 26, COLORS.gold, 80, [1, 0.5], true);
  const act = activeBoxRect(reg, p.big);
  // 아이콘 3개(고·흔·폭) + 나머지 칩(뒤집기·국진·뻑). 칩은 패널 안 한 줄에만 둔다(둘째 줄은 기술 줄과 겹침 — 요청 12-5)
  const chips = [...(p.extraChips ?? []), ...statusChips(p).slice(1).filter(c => !c.text.startsWith('흔들기') && !c.text.startsWith('폭탄'))];
  const measure = (t: string) => measureText(ui.scene, t, INFO.chip.size, true);
  const drawChips = (fit: { rects: Rect[]; texts: string[]; kept: number }) =>
    fit.rects.forEach((r, i) => { const src = i < fit.kept ? chips[i] : { color: CHIP_COLORS.other, alpha: 1 }; chip(ui, r, fit.texts[i], src.color, src.alpha ?? 1); });
  if (p.big) {
    const iconY = reg.y + reg.h - 6 - COUNT_ICON.d;
    const afterIcons = drawCountIcons(ui, xLeft, iconY, p);
    drawChips(fitChipsOneRow(chips, measure, afterIcons + 6, iconY + Math.round((COUNT_ICON.d - INFO.chip.h) / 2), speechZone(reg).x - 6));
  } else {
    drawCountIcons(ui, COUNT_ICON.myX, reg.y + 4, p);
    drawChips(fitChipsOneRow(chips, measure, COUNT_ICON.myX, reg.y + 4 + COUNT_ICON.d + 3, act.x - 6));
  }
  let suspicionBar: Phaser.GameObjects.Rectangle | undefined;
  if (p.focus) {
    const fb = focusBarRect(reg);
    const ratio = p.focus.max > 0 ? Math.min(1, Math.max(0, p.focus.cur / p.focus.max)) : 0;
    box(ui, fb.x, fb.y, fb.w, fb.h, FOCUS_BAR.track, 1, COLORS.brassDim);
    if (ratio > 0) box(ui, fb.x + 1, fb.y + 1, Math.max(1, Math.round((fb.w - 2) * ratio)), fb.h - 2, FOCUS_BAR.fill);
    label(ui, fb.x + fb.w + 6, fb.y + fb.h / 2, `집중 ${p.focus.cur}/${p.focus.max}`, FOCUS_BAR.labelSize, COLORS.gold, FOCUS_BAR.labelW + 20, [0, 0.5], true);
  }
  if (p.suspicion !== undefined) {
    // 붉은 눈 모양 바(집중 바 아래 줄): 50 이상 주황, 70 이상 빨강. 바 사각형을 돌려줘 상승 순간 흔들림 트윈을 건다
    const susp = suspicionBarRect(reg), color = suspicionColor(p.suspicion);
    ui.layer.add(ui.scene.add.ellipse(susp.x + susp.w / 2, susp.y + susp.h / 2, susp.w + 10, susp.h + 8, SUSPICION_BAR.track).setStrokeStyle(1, 0x7a2a2a));
    suspicionBar = box(ui, susp.x, susp.y, susp.w, susp.h, 0x2a1416, 1, 0x7a2a2a);
    const ratio = Math.min(1, Math.max(0, p.suspicion / 100));
    if (ratio > 0) box(ui, susp.x + 1, susp.y + 1, Math.max(1, Math.round((susp.w - 2) * ratio)), susp.h - 2, color);
    label(ui, susp.x + susp.w + 6, susp.y + susp.h / 2, `의심 ${p.suspicion}`, FOCUS_BAR.labelSize, p.suspicion >= SUSPICION_BAR.warnAt ? hex(color) : COLORS.danger, FOCUS_BAR.labelW + 20, [0, 0.5], true);
  }
  if (p.active) { box(ui, act.x, act.y, act.w, act.h, 0xe0b64f); label(ui, act.x + act.w / 2, act.y + act.h / 2, p.activeText, INFO.activeBox.size, COLORS.dark, act.w, [0.5, 0.5], true); }
  if (p.big && p.handCount !== undefined) oppHandLayout(reg, p.handCount, p.active).forEach((h, i) => { if (p.handVisible?.[i] === false) return; drawMiniBack(ui, h.x, h.y, h.w, h.h); });
  return { scoreText, portrait, suspicionBar };
}

export type CapturedOptions = {
  /** 연출 중이라 숨길 카드 id(자리는 계산한다). */
  hidden?: ReadonlySet<number>;
  /** 족보 완성 직전 힌트("고도리 1장" 등). 해당 묶음 위 글자 줄에 붙인다. */
  near?: readonly string[];
  /** 패널을 누르면 큰 카드 목록을 연다(입력 가능한 안정된 상태에서만 넘긴다). */
  onTap?: () => void;
  /** 카드를 그릴 때 자리 이동 연출을 거는 훅(SlideTracker.place). 없으면 바로 그린다. */
  place?: (key: string, r: Rect, draw: (ui: UI) => void) => void;
  /** 박 위험(turnPlan.bakWarnings): 피박은 피 묶음, 광박은 광 묶음 왼쪽에 빨간 글자로 상시 표시. */
  warnings?: readonly ('피박' | '광박')[];
};
const HINT_CELL: Record<string, '광' | '열끗' | '띠'> = { '삼광': '광', '고도리': '열끗', '홍단': '띠', '청단': '띠', '초단': '띠' };
const WARN_CELL: Record<'피박' | '광박', '피' | '광'> = { '피박': '피', '광박': '광' };
/** 박 경고 글자 크기. */
export const BAK_WARN_SIZE = 18;

/**
 * 획득 패: 한 줄 4묶음(광·열끗·띠·피). 묶음 안 카드는 비껴 겹친 더미, 오른쪽 아래 장수 배지(피는 가치), 위에 완성 족보·힌트 한 줄.
 * 양쪽 패널이 같은 기준(capturedRects)으로 배치되며 카드 id별 자리는 획득 연출의 도착점과 같다. 0장이면 배지도 카드도 없다.
 */
export function drawCaptured(ui: UI, reg: Rect, score: Score, o: CapturedOptions = {}): CapturedRects {
  const total = score.광.cards.length + score.열끗.cards.length + score.띠.cards.length + score.피.cards.length;
  // 0장이면 배경을 옅게(테두리 유지)해 판 시작 직후 화면이 무겁지 않게 한다
  const outer = panel(ui, MARGIN, reg.y, reg.w - MARGIN * 2, reg.h, 'dark', false, total === 0 ? CAPTURED_EMPTY_ALPHA : 1);
  if (o.onTap) outer.setInteractive({ useHandCursor: true }).on('pointerdown', o.onTap);
  const lay = capturedRects(reg, { 광: score.광.cards, 열끗: score.열끗.cards, 띠: score.띠.cards, 피: score.피.cards });
  for (const cell of lay.cells) {
    const g = score[cell.kind];
    const tags = [...g.bonuses, ...(o.near ?? []).filter(h => HINT_CELL[h.split(' ')[0]] === cell.kind)];
    if (tags.length) label(ui, cell.x + 4, cell.y, tags.join(' · '), 11, COLORS.gold, cell.w, [0, 0], true);
    for (const c of g.cards) {
      if (o.hidden?.has(c.id)) continue;
      const r = lay.rects.get(c.id)!;
      const draw = (u: UI) => drawMiniCard(u, r.x, r.y, r.w, r.h, c);
      if (o.place) o.place(`cap:${c.id}`, r, draw); else draw(ui);
    }
    if (g.cards.length) countBadge(ui, cell.x + cell.w - COUNT_BADGE.d / 2 - 2, cell.y + cell.h - COUNT_BADGE.d / 2 - 2, String(cell.kind === '피' ? score.피.value : g.cards.length));
    const warn = (o.warnings ?? []).find(w => WARN_CELL[w] === cell.kind);
    if (warn) outlined(ui, cell.x + 2, cell.y + CAPTURED_TAG_H + (cell.h - CAPTURED_TAG_H) / 2, warn, BAK_WARN_SIZE, COLORS.bakWarn, [0, 0.5]);
  }
  return lay;
}
