// 세로형(720×1280) 대결 화면의 레이아웃 설정. 카드 크기·간격·영역·자리 좌표는 여기서만 정한다(그리기 코드에 숫자를 흩뿌리지 않는다).
/** 사각형. angle(도)이 있으면 중심 기준으로 기울여 그리고, 이동 연출은 도착 시 이 각도로 복원한다(바닥패만 쓴다). */
export type Rect = { x: number; y: number; w: number; h: number; angle?: number };

/**
 * 디자인 좌표. 폭 720 고정, 높이는 기기 비율에 맞춰 configureLayout()이 1280~1600 사이로 정한다(모듈 로드 시 1280).
 * Phaser Scale.FIT으로 PC에서는 가운데, 휴대폰에서는 잘리지 않게 맞춘다. 비율이 더 긴 기기에서만 위아래 띠가 남는다.
 */
export const DESIGN = { width: 720, height: 1280 };
export const BASE_HEIGHT = 1280, MAX_HEIGHT = 1600;
export const MARGIN = 20;
export const GAP = 10;
/** 화면 아래 기본 안전 여백. 손패가 화면 끝에 붙지 않게 한다(기기 홈바 여백은 configureLayout의 insets.bottom으로 더해진다). */
export const BOTTOM_SAFE = 20;

/** 카드 그림의 가로:세로 비율(원본 테두리 103.2:168.2). 화면의 모든 카드 사각형은 이 비율을 따른다. */
export const CARD_ASPECT = 103.2 / 168.2;
const sized = (h: number) => ({ w: Math.round(h * CARD_ASPECT), h });

/** 손패 주 줄(아랫줄) 최대 장수. 7장째부터는 윗줄에 왼쪽 정렬. */
export const HAND_MAIN_ROW = 6;
/** 손패 카드 높이: 주 줄 6장이 폭(720 − 여백×2) 안에 GAP 간격으로 들어가는 높이, 상한 196. */
const HAND_CARD_H = Math.min(196, Math.floor(((DESIGN.width - MARGIN * 2 - (HAND_MAIN_ROW - 1) * GAP) / HAND_MAIN_ROW) / CARD_ASPECT));

/** 카드 크기. 손패 > 바닥패 > 획득 패(미니). 높이만 정하고 폭은 비율로 계산한다. */
export const CARD = {
  hand: sized(HAND_CARD_H),                                 // 105×171
  floor: { ...sized(130), stackDx: 0.3, stackMax: 3 },      // 바닥패 높이 상한 130. 같은 월 묶음: 폭의 30%씩 옆으로 비껴 겹침, 자리는 3장 묶음 폭까지 확보
  mini: { ...sized(64), step: 14, minStep: 4 },             // 획득 패: 세로로 겹친 더미처럼. 기본 비낌 14, 묶음 폭이 모자라면 최소 4까지 줄임(크기는 유지)
  peek: sized(40),
} as const;

/** 손패 윗줄 위 기본 여백: 먹을 수 있는 패 화살표(높이 18 + 왕복 6)가 위 패널과 겹치지 않게 비워 둔다(이전 안내 줄 24px을 돌려 씀). 긴 화면에서는 늘어난다. */
export const HAND_TOP_PAD = 24;
/** 획득 패 패널 높이(한 줄 4묶음). */
export const CAPTURED_H = 84;
const TOP_H = 40, OPP_INFO_H = 84, MY_INFO_H = 64;
/** 1280 기준 화투판 높이(528). 긴 화면에서는 늘어난 높이의 70%가 더해진다. */
export const TABLE_H_BASE = BASE_HEIGHT - TOP_H - OPP_INFO_H - CAPTURED_H - MY_INFO_H - CAPTURED_H - (HAND_TOP_PAD + CARD.hand.h * 2 + GAP + BOTTOM_SAFE);
/** 늘어난 높이의 배분 비율: 화투판 70%, 손패 위 여백 30%. */
export const EXTRA_SPLIT = { table: 0.7, handPad: 0.3 } as const;

/** 기기 안전 여백(디자인 단위). top은 상단 띠 위에, bottom은 아래 안전 여백에 더한다. */
export type SafeInsets = { top: number; bottom: number };
/** 현재 높이에서 계산된 가변 값. configureLayout()이 갱신한다. */
export const LAYOUT = { handTopPad: HAND_TOP_PAD, bottomSafe: BOTTOM_SAFE, insets: { top: 0, bottom: 0 } as SafeInsets, extra: 0 };

/**
 * 위에서 아래 순서의 영역. 손패(위 여백 + 두 줄 + 안전 여백)·정보·획득 패널 크기는 높이와 무관하게 같고, 남은 높이는 화투판과 손패 위 여백이 나눠 갖는다.
 * export 이름과 필드명은 고정이며 configureLayout()이 값만 갱신한다. 상시 안내 줄은 없다(메뉴 > 규칙 안내).
 */
export const REGIONS: { topBar: Rect; oppInfo: Rect; oppCaptured: Rect; table: Rect; myInfo: Rect; myCaptured: Rect; hand: Rect } = {
  topBar: { x: 0, y: 0, w: 720, h: TOP_H },
  /** 상대 초상화(반지름 36)·이름·칩·점수 배지·말풍선 자리·손패 뒷면. 화면 높이의 15% 이내. */
  oppInfo: { x: 0, y: 0, w: 720, h: OPP_INFO_H },
  oppCaptured: { x: 0, y: 0, w: 720, h: CAPTURED_H },
  table: { x: MARGIN, y: 0, w: 720 - MARGIN * 2, h: TABLE_H_BASE },
  myInfo: { x: 0, y: 0, w: 720, h: MY_INFO_H },
  myCaptured: { x: 0, y: 0, w: 720, h: CAPTURED_H },
  /** 손패: 위 여백(화살표 자리) + 두 줄(윗줄·아랫줄) + 아래 안전 여백. */
  hand: { x: 0, y: 0, w: 720, h: 0 },
};

/**
 * 디자인 높이(1280~1600)와 기기 안전 여백으로 REGIONS를 다시 계산한다. 게임을 만들기 전에 한 번 호출한다(판 중간에는 바꾸지 않는다).
 * 배분: 먼저 안전 여백(top은 상단 띠 위, bottom은 아래 여백에 더함) → 남는 양(height − 1280 − top − bottom)의 70%를 화투판, 30%를 손패 위 여백에 더한다.
 * 남는 양이 음수(여백이 큰 기기)면 화투판에서만 뺀다. 손패·획득패·정보 패널 크기는 바뀌지 않는다.
 */
export function configureLayout(height: number, insets: SafeInsets = { top: 0, bottom: 0 }): typeof REGIONS {
  const top = Math.max(0, Math.round(insets.top)), bottom = Math.max(0, Math.round(insets.bottom));
  DESIGN.height = Math.round(height);
  const extra = DESIGN.height - BASE_HEIGHT - top - bottom;
  const tableExtra = extra >= 0 ? Math.round(extra * EXTRA_SPLIT.table) : extra;
  const padExtra = extra >= 0 ? extra - tableExtra : 0;
  LAYOUT.insets = { top, bottom };
  LAYOUT.extra = extra;
  LAYOUT.handTopPad = HAND_TOP_PAD + padExtra;
  LAYOUT.bottomSafe = BOTTOM_SAFE + bottom;
  const handH = LAYOUT.handTopPad + CARD.hand.h * 2 + GAP + LAYOUT.bottomSafe;
  const tableH = TABLE_H_BASE + tableExtra;
  let y = top;
  const put = (r: Rect, h: number) => { r.y = y; r.h = h; y += h; };
  put(REGIONS.topBar, TOP_H);
  put(REGIONS.oppInfo, OPP_INFO_H);
  put(REGIONS.oppCaptured, CAPTURED_H);
  put(REGIONS.table, tableH);
  put(REGIONS.myInfo, MY_INFO_H);
  put(REGIONS.myCaptured, CAPTURED_H);
  put(REGIONS.hand, handH);
  return REGIONS;
}
configureLayout(BASE_HEIGHT);
/** 획득 패가 0장일 때 패널 배경 알파(테두리는 유지). */
export const CAPTURED_EMPTY_ALPHA = 0.35;
/** 더미 위에 카드를 잠시 들고 있는 자리: 더미 높이의 이 비율만큼 위(장수 배지를 가리지 않게). */
export const HOLD_LIFT = 0.35;

// ---- 정보 패널 ----
/** 정보 패널 요소 크기. 점수 배지(오른쪽 끝), 상태 칩, 선(先) 배지, 차례 상자, 다음 패 보기 버튼, 상대 손패 뒷면. */
export const INFO = {
  portraitBig: 36, portraitSmall: 24,
  scoreBadge: { w: 96, h: 40 },
  chip: { h: 20, pad: 14, gap: 6, rowGap: 4, size: 12, radius: 6 },
  firstBadge: { d: 22, color: 0xc0392b },
  activeBox: { w: 96, h: 26 },
  peekW: 140,
  oppHand: { h: 32, step: 9 },
  /** 왼쪽 구역(초상화·이름·칩)과 오른쪽 구역(점수 배지, 상대는 말풍선·손패 뒷면)을 나누는 x. */
  split: 330,
} as const;
/** 칩 색. 고 붉은색, 흔들기 황동, 폭탄 주황, 나머지 어두운 녹색. */
export const CHIP_COLORS = { go: 0xc0392b, shake: 0xb08d4a, bomb: 0xf0923a, other: 0x2b3b36 } as const;
/** 장수 배지(획득 묶음 오른쪽 아래, 더미 오른쪽 아래): 검은 원 + 흰 숫자. */
export const COUNT_BADGE = { d: 24, fill: 0x111111, alpha: 0.9, size: 13 } as const;

/** 점수 배지: 패널 오른쪽 끝. 상대 패널은 위쪽(아래에 손패 뒷면 줄), 내 패널은 세로 가운데. */
export function scoreBadgeRect(reg: Rect, big: boolean): Rect {
  const { w, h } = INFO.scoreBadge;
  return { x: reg.w - MARGIN - 12 - w, y: big ? reg.y + 4 : reg.y + Math.round((reg.h - h) / 2), w, h };
}
/** 내 패널의 "다음 패 보기" 버튼: 점수 배지 왼쪽, 폭 140. */
export function peekButtonRect(reg: Rect): Rect {
  const sb = scoreBadgeRect(reg, false);
  return { x: sb.x - 8 - INFO.peekW, y: reg.y + Math.round(reg.h / 2) - 16, w: INFO.peekW, h: 32 };
}
/** 차례 상자("내 차례"/"상대 차례"/"바닥패 선택"). 상대는 오른쪽 구역 왼쪽 아래, 나는 다음 패 보기 버튼 왼쪽. */
export function activeBoxRect(reg: Rect, big: boolean): Rect {
  const { w, h } = INFO.activeBox;
  if (big) return { x: INFO.split, y: reg.y + reg.h - 36, w, h };
  return { x: peekButtonRect(reg).x - 10 - w, y: reg.y + Math.round(reg.h / 2) - 13, w, h };
}
/** 말풍선: 점수 배지와의 간격, 한 줄 높이, 두 줄까지 허용한 최대 높이(패널 안에 머무름). */
export const SPEECH = { gapToBadge: 12, h: 34, maxH: 52 } as const;
/** 상대 말풍선 전용 자리(상대 정보 패널 오른쪽 위, 점수 배지 왼쪽 − 12). 이름·칩(왼쪽)·점수 배지와 겹치지 않도록 미리 비워 둔다. 긴 대사는 이 폭 안에서 두 줄로 접는다. */
export function speechZone(reg: Rect = REGIONS.oppInfo): Rect {
  const sb = scoreBadgeRect(reg, true);
  return { x: INFO.split, y: reg.y + 6, w: sb.x - SPEECH.gapToBadge - INFO.split, h: SPEECH.h };
}
/** 상태 칩 흐름 배치: 글자 폭 배열을 받아 왼쪽부터 놓고 maxX를 넘으면 다음 줄(xRow부터). 순수 함수. */
export function flowChips(textWidths: readonly number[], x0: number, y0: number, maxX: number, xRow: number = x0): Rect[] {
  const { h, pad, gap, rowGap } = INFO.chip;
  const out: Rect[] = [];
  let x = x0, y = y0;
  for (const tw of textWidths) {
    const w = Math.round(tw + pad);
    if (x + w > maxX && x > xRow) { x = xRow; y += h + rowGap; }
    out.push({ x, y, w, h });
    x += w + gap;
  }
  return out;
}

/** 상대 손패 뒷면 위치(정보 패널 오른쪽 아래 줄, 점수 배지·말풍선 자리 아래). 연출의 출발·도착점으로도 쓴다. */
export function oppHandLayout(reg: Rect, count: number, badgeShown: boolean): Rect[] {
  const h = INFO.oppHand.h, w = Math.round(h * CARD_ASPECT), step = INFO.oppHand.step;
  void badgeShown;
  const right = reg.w - MARGIN - 12;
  const x0 = right - (w + Math.max(0, count - 1) * step);
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * step, y: reg.y + reg.h - h - 4, w, h }));
}

// ---- 손패 ----
/** 먹을 수 있는 손패 표시: 카드 위쪽 가운데의 파란 아래 방향 삼각형(흰 테두리), 위아래 bob px 왕복. */
export const HAND_ARROW = { w: 26, h: 18, color: 0x3b82f6, edge: 0xffffff, edgeW: 2, bob: 6, above: 0 } as const; // 꼭짓점이 카드 윗변에 닿고, 위 여백 24 = 높이 18 + 왕복 6

/**
 * 손패 배치: 아랫줄이 주 줄(최대 6장, 가로 가운데 정렬), 7장째부터 윗줄에 왼쪽 정렬(아랫줄 첫 장과 왼쪽을 맞춤).
 * 두 줄은 겹치지 않고 모두 보인다. 6장 이하는 아랫줄만 쓴다. 기회 패도 같은 규칙으로 뒤에 이어진다.
 */
export function handLayout(count: number): Rect[] {
  const { w, h } = CARD.hand;
  const upperY = REGIONS.hand.y + LAYOUT.handTopPad, mainY = upperY + h + GAP;
  const main = Math.min(count, HAND_MAIN_ROW);
  const mainW = main * w + Math.max(0, main - 1) * GAP;
  const left = Math.round((DESIGN.width - mainW) / 2);
  const out: Rect[] = [];
  for (let i = 0; i < count; i++) {
    if (i < main) out.push({ x: left + i * (w + GAP), y: mainY, w, h });
    else out.push({ x: left + (i - main) * (w + GAP), y: upperY, w, h });
  }
  return out;
}

// ---- 화투판·바닥패 ----
/** 화투판 안쪽(나무 틀 안). 메시지 띠는 없고, 메시지는 필요할 때만 위쪽에 캡슐로 뜬다. */
export function tableInner(): Rect {
  const t = REGIONS.table;
  return { x: t.x + 12, y: t.y + 12, w: t.w - 24, h: t.h - 24 };
}
/** 1280 기준 화투판 안쪽 높이. 긴 화면에서 바닥 자리의 세로 간격을 이 값 대비 비례로 넓힌다(최대 FLOOR_STRETCH_MAX배, 카드 크기는 그대로). */
export const BASE_INNER_H = TABLE_H_BASE - 24;
export const FLOOR_STRETCH_MAX = 1.3;
/** 화투판 위쪽 메시지 캡슐(비어 있지 않을 때만). 바닥 자리를 차지하지 않는다. */
export const TABLE_MESSAGE = { h: 30, alpha: 0.55, size: 14, padX: 16, top: 8 } as const;

/** 바닥패 자리: 더미 중심을 원점으로, 첫 장 중심의 상대 좌표(카드 폭·높이 단위)와 자리별 고정 기울기(도). */
export type FloorSlot = { ux: number; uy: number; angle: number };
/**
 * 더미 둘레 흩뿌림 자리 12개. 앞 6개는 안쪽 고리(더미 좌우·위·아래), 뒤 6개는 바깥 고리. 새 월은 배열 앞 순서부터 받는다.
 * 묶음은 오른쪽으로 비껴 쌓이므로(폭 1.6배까지) 자리 사이 간격을 0.3폭 두어 기울기(±6°, 장마다 +3°)를 포함해도 겹치지 않는다.
 */
export const FLOOR_SLOTS: readonly FloorSlot[] = [
  { ux: -1.9, uy: -0.03, angle: -4 }, { ux: 1.3, uy: 0.03, angle: 3 },
  { ux: -1.25, uy: -1.23, angle: -5 }, { ux: 0.65, uy: -1.25, angle: 4 },
  { ux: -1.1, uy: 1.29, angle: 2 }, { ux: 0.8, uy: 1.23, angle: -3 },
  { ux: -3.8, uy: 0.04, angle: 5 }, { ux: 3.2, uy: -0.04, angle: -6 },
  { ux: -3.15, uy: -1.27, angle: 6 }, { ux: 2.55, uy: -1.29, angle: -2 },
  { ux: -3.0, uy: 1.25, angle: -5 }, { ux: 2.7, uy: 1.27, angle: 4 },
];
/** 같은 월 묶음: 장마다 더하는 기울기(도). */
export const FLOOR_STACK_TILT = 3;
/** 선택 단계 펼침: 가로 간격(카드 폭 + fanGap), 가로로 이웃과 겹치면 위쪽으로 펼치는 비율(높이 × upDy), 사방이 막혔을 때 대각선 펼침의 가로 비율(폭 × diagDx), 같은 줄로 보는 세로 거리(높이 단위). */
export const FLOOR_FAN = { gap: 6, upDy: 0.55, diagDx: 0.6, rowTol: 0.6 } as const;
/** 예전 이름 호환. */
export const FLOOR_FAN_GAP = FLOOR_FAN.gap;

/**
 * 펼침 방향: 같은 줄의 이웃 자리(더미 포함) 중심까지의 거리가 오른쪽이 왼쪽보다 가까우면 왼쪽(−1), 아니면 오른쪽(+1).
 * 화투판 가장자리(모든 자리의 바깥 끝)도 이웃으로 쳐서 가장자리 자리는 안쪽으로 펼친다. 순수 함수.
 */
export function fanDirection(slotIndex: number): 1 | -1 {
  const sl = FLOOR_SLOTS[slotIndex];
  const others = [...FLOOR_SLOTS.filter((_, k) => k !== slotIndex), { ux: 0, uy: 0, angle: 0 }].filter(o => Math.abs(o.uy - sl.uy) < FLOOR_FAN.rowTol);
  const stackW = 1 + CARD.floor.stackDx * (CARD.floor.stackMax - 1);
  const edgeR = Math.max(...FLOOR_SLOTS.map(o => o.ux - 0.5 + stackW)), edgeL = Math.min(...FLOOR_SLOTS.map(o => o.ux - 0.5));
  const right = Math.min(edgeR - sl.ux, ...others.filter(o => o.ux > sl.ux).map(o => o.ux - sl.ux));
  const left = Math.min(sl.ux - edgeL, ...others.filter(o => o.ux < sl.ux).map(o => sl.ux - o.ux));
  return right < left ? -1 : 1;
}

/** 기울어진 사각형의 경계 사각형(중심 기준 회전). 겹침 검사에 쓴다. */
export function rotatedBounds(r: Rect): Rect {
  const a = ((r.angle ?? 0) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const bw = r.w * c + r.h * s, bh = r.w * s + r.h * c;
  return { x: r.x + r.w / 2 - bw / 2, y: r.y + r.h / 2 - bh / 2, w: bw, h: bh };
}

export type FloorLayout = {
  /** 입력 순서와 같은 순서의 카드 위치(angle 포함). */
  cards: Rect[];
  /** 그릴 순서(입력 인덱스). 큰 묶음과 선택 중인 묶음을 나중에 그려 위에 오게 한다. */
  drawOrder: number[];
  deck: Rect;
  scale: number;
  /** 월 → 자리 번호. 다음 턴에 다시 넘기면 기존 묶음이 같은 자리에 남는다. */
  slots: Map<number, number>;
};

/** 자리 하나가 3장 묶음까지 차지하는 경계(더미 중심 원점, 주어진 카드 크기). 기울기를 포함한다. */
function slotBounds(slot: FloorSlot, w: number, h: number): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let k = 0; k < CARD.floor.stackMax; k++) {
    const b = rotatedBounds({ x: slot.ux * w - w / 2 + k * w * CARD.floor.stackDx, y: slot.uy * h - h / 2, w, h, angle: slot.angle + k * FLOOR_STACK_TILT });
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * 바닥패 배치: 같은 월은 한 자리에 옆으로 비껴 겹친 묶음(장마다 +3° 기울기)으로 놓고, 가운데는 더미다.
 * 자리는 3장 묶음 폭까지 확보해 묶음이 커져도 다른 월과 겹치거나 크기가 바뀌지 않는다.
 * 크기: 높이 상한 130에서 시작해 12자리 + 더미 + 묶음 폭 + 기울기 여유가 화투판 안쪽에 들어오도록 비율을 유지한 채 줄인다.
 * prevSlots를 넘기면 이미 자리를 가진 월은 그 자리를 유지하고, 새 월만 빈 자리(FLOOR_SLOTS 순)를 받는다.
 * fanMonth를 주면 그 월 묶음은 겹치지 않게 옆으로 펼쳐(오른쪽 자리는 왼쪽으로, 기울기 없이) 각 장을 쉽게 고를 수 있게 한다(바닥패 선택 단계).
 */
export function floorLayout(months: readonly number[], fanMonth?: number, prevSlots?: ReadonlyMap<number, number>): FloorLayout {
  const area = tableInner();
  const order: number[] = [];
  const groups = new Map<number, number[]>();
  months.forEach((m, i) => { if (!groups.has(m)) { groups.set(m, []); order.push(m); } groups.get(m)!.push(i); });
  // 자리 배정: 기존 자리 유지 → 새 월은 빈 자리 순서대로
  const slots = new Map<number, number>();
  const taken = new Set<number>();
  for (const m of order) { const s = prevSlots?.get(m); if (s !== undefined && !taken.has(s) && s >= 0 && s < FLOOR_SLOTS.length) { slots.set(m, s); taken.add(s); } }
  for (const m of order) { if (slots.has(m)) continue; const s = FLOOR_SLOTS.findIndex((_, k) => !taken.has(k)); if (s < 0) throw new Error('바닥패 자리가 부족합니다.'); slots.set(m, s); taken.add(s); }
  // 크기: 기본 크기에서 모든 자리(3장 묶음·기울기 포함)와 더미의 경계를 구해 안쪽 영역에 맞춘다
  const base = CARD.floor;
  let minX = -base.w / 2, minY = -base.h / 2, maxX = base.w / 2, maxY = base.h / 2;
  for (const sl of FLOOR_SLOTS) { const b = slotBounds(sl, base.w, base.h); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  const scale = Math.min(1, area.w / (maxX - minX), area.h / (maxY - minY));
  const w = Math.floor(base.w * scale), h = Math.floor(base.h * scale);
  // 긴 화면: 카드 크기(폭에 묶임)는 그대로 두고 자리의 세로 간격만 1280 기준 대비 비례로 넓힌다(영역 안에 들어오는 범위, 최대 1.3배)
  const fy = Math.max(1, Math.min(FLOOR_STRETCH_MAX, area.h / BASE_INNER_H, area.h / ((maxY - minY) * scale)));
  // 더미 중심: 전체 경계가 안쪽 영역 가운데에 오도록
  const cx = Math.round(area.x + area.w / 2 - ((minX + maxX) / 2) * scale), cy = Math.round(area.y + area.h / 2 - ((minY + maxY) / 2) * scale * fy);
  const cards: Rect[] = new Array(months.length);
  const deck: Rect = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
  // 펼치지 않는 월부터 놓고, 펼칠 월은 그 결과를 보고 빈 쪽으로 펼친다
  const fanned = order.filter(m => m === fanMonth && groups.get(m)!.length > 1);
  for (const m of order.filter(m => !fanned.includes(m))) {
    const sl = FLOOR_SLOTS[slots.get(m)!];
    const x0 = Math.round(cx + sl.ux * w - w / 2), y0 = Math.round(cy + sl.uy * fy * h - h / 2);
    groups.get(m)!.forEach((cardIndex, k) => { cards[cardIndex] = { x: x0 + k * Math.round(w * base.stackDx), y: y0, w, h, angle: sl.angle + k * FLOOR_STACK_TILT }; });
  }
  for (const m of fanned) {
    const si = slots.get(m)!, sl = FLOOR_SLOTS[si], idx = groups.get(m)!;
    const x0 = Math.round(cx + sl.ux * w - w / 2), y0 = Math.round(cy + sl.uy * fy * h - h / 2);
    const occupied = [deck, ...cards.filter(Boolean)];
    const blocked = (rs: Rect[]) => rs.some(r => occupied.some(o => overlapsRect(r, rotatedBounds(o))));
    const outside = (rs: Rect[]) => rs.some(r => r.x < area.x || r.x + r.w > area.x + area.w || r.y < area.y || r.y + r.h > area.y + area.h);
    // 펼친 장은 고르기 쉽게 기울기 없이. 1) 빈 쪽으로 가로 펼침 2) 이웃과 겹치거나 영역 밖이면 위쪽으로 3) 위쪽도 막히면 아래쪽 → 반대쪽 가로 → 대각선 4) 모두 막히면 영역 안에 드는 위쪽(없으면 아래쪽)
    const dir = fanDirection(si);
    const spread = (dx: number, dy: number) => idx.map((_, k) => ({ x: x0 + Math.round(k * dx), y: y0 + Math.round(k * dy), w, h, angle: 0 }));
    const sideW = w + FLOOR_FAN.gap, upH = h * FLOOR_FAN.upDy, diagW = w * FLOOR_FAN.diagDx;
    const up = spread(0, -upH);
    const candidates = [spread(dir * sideW, 0), up, spread(0, upH), spread(-dir * sideW, 0), spread(-dir * diagW, -upH), spread(dir * diagW, -upH), spread(-dir * diagW, upH), spread(dir * diagW, upH)];
    const chosen = candidates.find(rs => !blocked(rs) && !outside(rs)) ?? (!outside(up) ? up : spread(0, upH));
    idx.forEach((cardIndex, k) => { cards[cardIndex] = chosen[k]; });
  }
  const ordered = [...order].sort((a, b) => (a === fanMonth ? 1 : b === fanMonth ? -1 : groups.get(a)!.length - groups.get(b)!.length));
  const drawOrder = ordered.flatMap(m => groups.get(m)!);
  return { cards, drawOrder, deck, scale, slots };
}
/** 축 정렬 사각형 겹침. */
function overlapsRect(a: Rect, b: Rect) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

// ---- 획득 패 ----
/** 한 줄 4묶음(광·열끗·띠·피) 폭 비율과 묶음 사이 간격. */
export const CAPTURED_WIDTHS = [0.18, 0.26, 0.26, 0.30] as const;
export const CAPTURED_GROUP_GAP = 12;
/** 묶음 위의 작은 글자 줄(완성 족보·힌트) 높이. 그 아래에 카드 더미가 온다. */
export const CAPTURED_TAG_H = 12;
export type CapturedCell = Rect & { kind: '광' | '열끗' | '띠' | '피' };
/** 획득 패 패널 묶음 칸: 왼쪽부터 광·열끗·띠·피 한 줄. 양쪽 패널이 같은 기준을 쓴다. */
export function capturedLayout(reg: Rect): CapturedCell[] {
  const inner = { x: MARGIN + 8, y: reg.y + 4, w: reg.w - MARGIN * 2 - 16, h: reg.h - 8 };
  const avail = inner.w - CAPTURED_GROUP_GAP * (CAPTURED_WIDTHS.length - 1);
  const cells: CapturedCell[] = [];
  let x = inner.x;
  (['광', '열끗', '띠', '피'] as const).forEach((kind, i) => { const w = Math.floor(avail * CAPTURED_WIDTHS[i]); cells.push({ kind, x, y: inner.y, w, h: inner.h }); x += w + CAPTURED_GROUP_GAP; });
  return cells;
}

/** 획득 패 정렬용 최소 카드 정보(점수 계층의 Card와 호환). */
export type CapturedCardLike = { id: number; kind: '광' | '열끗' | '띠' | '피'; band: string | null; godori: boolean; ssangpi: boolean; gukjin: boolean };
/** 분류 안의 묶음 번호: 열끗은 고도리 패 먼저, 띠는 홍단·청단·초단·비띠 순, 피는 쌍피(쌍피로 쓰는 국진 포함) 먼저, 광은 한 묶음. */
export function capturedGroup(kind: CapturedCell['kind'], c: CapturedCardLike): number {
  if (kind === '열끗') return c.godori ? 0 : 1;
  if (kind === '띠') return ['홍단', '청단', '초단'].indexOf(c.band ?? '') === -1 ? 3 : ['홍단', '청단', '초단'].indexOf(c.band ?? '');
  if (kind === '피') return c.ssangpi || c.gukjin ? 0 : 1;
  return 0;
}
/** 분류 안의 표시 순서: 묶음 번호 → id. 같은 입력이면 같은 순서라 턴이 지나도 기존 카드가 불필요하게 움직이지 않는다. */
export function capturedOrder<T extends CapturedCardLike>(kind: CapturedCell['kind'], cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => capturedGroup(kind, a) - capturedGroup(kind, b) || a.id - b.id);
}

export type CapturedRects = { cells: CapturedCell[]; rects: Map<number, Rect> };
/**
 * 획득 패 전체의 카드 위치(카드 id → 사각형). 묶음 안 카드는 가로로 비껴 겹친 더미(기본 14px)이며 폭이 모자라면 비낌만 줄인다(최소 4, 크기 유지).
 * 패널 그리기와 획득 연출의 도착점이 같은 함수를 써서 카드 id별 최종 위치가 일치한다.
 */
export function capturedRects(reg: Rect, groups: Record<CapturedCell['kind'], readonly CapturedCardLike[]>): CapturedRects {
  const cells = capturedLayout(reg);
  const rects = new Map<number, Rect>();
  const { w, h, step } = CARD.mini;
  for (const cell of cells) {
    const cards = capturedOrder(cell.kind, groups[cell.kind]);
    const n = cards.length;
    if (n === 0) continue;
    const s = miniStep(n, cell.w - 8, w, step);
    const y = cell.y + CAPTURED_TAG_H;
    cards.forEach((c, i) => rects.set(c.id, { x: cell.x + 4 + i * s, y, w, h }));
  }
  return { cells, rects };
}

/** 겹침 간격: 기본 step을 쓰되 n장이 availW를 넘지 않도록 줄인다(최소 minStep은 보이게). */
export function miniStep(n: number, availW: number, cardW: number, maxStep: number): number {
  if (n <= 1) return maxStep;
  return Math.max(CARD.mini.minStep, Math.min(maxStep, Math.floor((availW - cardW) / (n - 1))));
}
