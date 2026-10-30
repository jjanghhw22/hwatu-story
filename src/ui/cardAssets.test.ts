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

test('cards.json 연결표(골목간판풍): 월·슬롯·원본 번호가 카드 데이터와 일치하고 번호 중복이 없다', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'cards.json'), 'utf8'));
  assert.equal(manifest.cards.length, 48);
  assert.ok(Math.abs(manifest.frame.w / manifest.frame.h - CARD_ASPECT) < 0.001, '카드 비율 2:3');
  const used = new Set<number>();
  for (const m of manifest.cards) {
    const c = CARDS[m.id];
    assert.equal(m.month, c.month); assert.equal(m.file, cardAssetFile(m.id));
    assert.equal(m.id, (m.month - 1) * 4 + m.slot, '슬롯 순서 = src/cards.ts 순서');
    // 원본 파일 번호 n(01~48)이 카드 id n−1에 그대로 대응
    assert.equal(m.source.no, m.id + 1, `원본 번호: ${m.source.file}`);
    assert.ok(String(m.source.file).startsWith(`골목간판풍_${String(m.source.no).padStart(2, '0')}_`), `원본 파일명: ${m.source.file}`);
    assert.ok(!used.has(m.source.no), `원본 번호 중복: ${m.source.no}`); used.add(m.source.no);
  }
});
