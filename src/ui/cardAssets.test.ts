import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS } from '../cards.ts';
import { BACK_TEXTURE, CARD_ASPECT, CARD_ASSET_DIR, cardAssetFile, cardTextureKey } from './cardAssets.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'public', CARD_ASSET_DIR);

test('48개 카드 ID 모두 그림 파일이 존재하고 키가 고유하다', () => {
  const keys = new Set<string>();
  for (const c of CARDS) {
    const file = path.join(DIR, cardAssetFile(c.id));
    assert.ok(fs.existsSync(file), `없음: ${file}`);
    assert.ok(fs.statSync(file).size > 1000, `너무 작음: ${file}`);
    keys.add(cardTextureKey(c.id));
  }
  assert.equal(keys.size, 48);
  assert.ok(fs.existsSync(path.join(DIR, BACK_TEXTURE.file)), '뒷면 없음');
});

test('cards.json 연결표는 카드 데이터와 월·슬롯이 일치하고 원본 테두리 좌표를 갖는다', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'cards.json'), 'utf8'));
  assert.equal(manifest.cards.length, 48);
  assert.ok(Math.abs(manifest.frame.w / manifest.frame.h - CARD_ASPECT) < 0.001, '카드 비율');
  const used = new Set<string>();
  for (const m of manifest.cards) {
    const c = CARDS[m.id];
    assert.equal(m.month, c.month); assert.equal(m.file, cardAssetFile(m.id));
    assert.equal(m.id, (m.month - 1) * 4 + m.slot);
    const key = `${m.source.row},${m.source.col}`;
    assert.ok(!used.has(key), `원본 위치 중복: ${key}`); used.add(key);
    assert.ok(m.source.row >= 0 && m.source.row < 4 && m.source.col >= 0 && m.source.col < 12);
  }
  // 원본은 일본식 순서: 우리 11월(오동)은 원본 4행 9~12열, 우리 12월(비)은 원본 4행 5~8열
  const ours = (month: number) => manifest.cards.filter((m: { month: number }) => m.month === month);
  assert.ok(ours(11).every((m: { source: { row: number; col: number } }) => m.source.row === 3 && m.source.col >= 8));
  assert.ok(ours(12).every((m: { source: { row: number; col: number } }) => m.source.row === 3 && m.source.col >= 4 && m.source.col < 8));
  // 국진(9월 슬롯 0)은 원본 3행 9열(그룹 첫 장), 비광(12월 슬롯 0)은 4행 5열, 오동 쌍피(11월 슬롯 1)는 4행 11열
  const at = (id: number) => manifest.cards.find((m: { id: number }) => m.id === id).source;
  assert.deepEqual([at(32).row, at(32).col], [2, 8]);
  assert.deepEqual([at(44).row, at(44).col], [3, 4]);
  assert.deepEqual([at(41).row, at(41).col], [3, 10]);
  assert.deepEqual([at(47).row, at(47).col], [3, 7]); // 비 쌍피
});
