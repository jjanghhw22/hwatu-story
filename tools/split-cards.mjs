// hwatu-overview.svg(Marcus Richert, CC BY-SA 4.0)에서 48장 카드를 잘라 PNG로 저장한다.
// 실행: node tools/split-cards.mjs  (프로젝트 루트에서)
// 분리 기준: 원본 안의 카드 테두리 도형(id="a", 중심 기준 ±51.6×±84.1 = 103.2×168.2)이 놓인 48개 translate 위치.
// 도안은 카드별 그룹이 아니라 전체 좌표계에 그려져 있으므로, 전체를 한 번 렌더링한 뒤 테두리 사각형 단위로 픽셀을 잘라낸다.
// 원본은 일본식 월 순서(11월=비, 12월=오동)이고 월 안의 카드 순서도 우리 데이터와 다르므로 아래 MAP으로 내용 기준 연결한다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
const require = createRequire(import.meta.url);
const { encodePNG, crop } = require('./png.cjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'hwatu-overview.svg');
const OUT = path.join(ROOT, 'public', 'assets', 'cards');
const SCALE = 3; // 1326×732 → 3978×2196. 카드 한 장 310×505.
const FRAME = { hw: 51.6, hh: 84.1 }; // 테두리 도형 a의 반폭·반높이
const COLS = [51.6, 160.15, 269.35, 377.9, 498.8, 607.35, 716.55, 825.1, 947.3, 1055.8, 1165, 1273.6]; // 테두리 translate x
const ROWS = [84.1, 270.4, 457.85, 647.6]; // 테두리 translate y

// 우리 카드 ID(src/cards.ts: id=(월-1)*4+슬롯) ← 원본(일본식 월 1..12, 그룹 안 열 0..3)
// 슬롯 순서(우리): 1·3월 [광,홍단,피,피] / 2,4,5,6,7,9,10월 [열끗,띠,피,피] / 8월 [광,열끗,피,피] / 11월 오동 [봉황,쌍피,피,피] / 12월 비 [비광,제비,비띠,쌍피]
// 원본 그룹 안 열: 대부분 [대표패, 피, 띠(또는 8월 열끗), 피] / 비 [비광,제비,비띠,쌍피] / 오동 [봉황,피,쌍피,피]
const SAME = [0, 2, 1, 3]; // 우리 슬롯 → 원본 열 (대표패, 띠, 피, 피 ← 열 0, 2, 1, 3)
const MAP = {}; // ourMonth → { jMonth, cols: [원본 열 for our slot 0..3] }
for (let m = 1; m <= 10; m++) MAP[m] = { jMonth: m, cols: SAME };
MAP[11] = { jMonth: 12, cols: [0, 2, 1, 3] }; // 오동: 봉황(0), 쌍피(2), 피(1), 피(3)
MAP[12] = { jMonth: 11, cols: [0, 1, 2, 3] }; // 비: 비광, 제비, 비띠, 쌍피

// 원본의 카드 안쪽(id="b")은 검은 윤곽선뿐이고 채움이 없어 흰 종이 위에 놓이는 전제다.
// 렌더 전에 48개 테두리 위치마다 안쪽 크기(90.6×153.8, 모서리 7)의 흰 사각형을 도안 뒤에 끼워 넣는다. 도안 자체는 바꾸지 않는다.
const INNER = { hw: 45.3, hh: 76.9, r: 7 };
const whiteBacks = ROWS.flatMap(cy => COLS.map(cx => `<rect x="${(cx - INNER.hw).toFixed(2)}" y="${(cy - INNER.hh).toFixed(2)}" width="${INNER.hw * 2}" height="${INNER.hh * 2}" rx="${INNER.r}" fill="#fff"/>`)).join('');
const svg = fs.readFileSync(SRC, 'utf8').replace('<g enable-background="new">', '<g enable-background="new">' + whiteBacks);
if (!svg.includes(whiteBacks)) throw new Error('흰 바탕 삽입 지점을 찾지 못했습니다.');
const img = new Resvg(svg, { fitTo: { mode: 'width', value: 1326 * SCALE } }).render();
const W = img.width, H = img.height, px = img.pixels;
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
let opaqueCheck = 0;
for (let month = 1; month <= 12; month++) {
  const { jMonth, cols } = MAP[month];
  const row = Math.floor((jMonth - 1) / 3), group = (jMonth - 1) % 3;
  cols.forEach((col, slot) => {
    const id = (month - 1) * 4 + slot;
    const c = group * 4 + col;
    const cx = COLS[c], cy = ROWS[row];
    const x = Math.round((cx - FRAME.hw) * SCALE), y = Math.round((cy - FRAME.hh) * SCALE);
    const w = Math.round(FRAME.hw * 2 * SCALE), h = Math.round(FRAME.hh * 2 * SCALE);
    const data = crop(px, W, H, x, y, w, h);
    if (data[((h >> 1) * w + (w >> 1)) * 4 + 3] === 255) opaqueCheck++;
    const file = `card-${String(id).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(OUT, file), encodePNG(data, w, h));
    manifest.push({ id, month, slot, file, source: { row, col: c, cx, cy, x: cx - FRAME.hw, y: cy - FRAME.hh, w: FRAME.hw * 2, h: FRAME.hh * 2 } });
  });
}
// 뒷면: 원본의 테두리 도형(a) 모양을 그대로 쓰고 안쪽을 진한 붉은색으로 채운 파생 도안.
const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-51.6 -84.1 103.2 168.2" width="${Math.round(103.2 * SCALE)}" height="${Math.round(168.2 * SCALE)}">
<path d="m51.6-79.1q0-5-5-5h-93.2q-5 0-5 5v158.2q0 5 5 5h93.2q5 0 5-5v-158.2m-13.3 2.2q7 0 7 7v139.8q0 7-7 7h-76.6q-7 0-7-7v-139.8q0-7 7-7h76.6z" fill="#EF1D1E"/>
<rect x="-45.3" y="-77" width="90.6" height="153.8" rx="7" fill="#B3121B"/>
<rect x="-36" y="-67" width="72" height="134" rx="5" fill="none" stroke="#EF1D1E" stroke-width="2"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'back.png'), new Resvg(backSvg).render().asPng());
fs.writeFileSync(path.join(OUT, 'cards.json'), JSON.stringify({ source: 'hwatu-overview.svg', scale: SCALE, frame: { w: FRAME.hw * 2, h: FRAME.hh * 2 }, cards: manifest }, null, 1));
console.log(`48장 저장 (${Math.round(FRAME.hw * 2 * SCALE)}×${Math.round(FRAME.hh * 2 * SCALE)}), 중심 불투명 ${opaqueCheck}/48, 뒷면 back.png, 목록 cards.json → ${OUT}`);
