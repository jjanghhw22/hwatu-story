// 캐릭터 그림 표시 설정의 순수 계산 검증: 정사각형 잘라내기(비율 유지), focus 중심, 원본 밖으로 나가지 않음, 표정 그림 대체 순서.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARBER, PLAYER, type Character, cropSquare, portraitKeyCandidates, portraitTextureKey } from './character.ts';

const W = 1199, H = 1312; // 제공된 두 그림의 실제 크기

test('cropSquare: 정사각형이라 가로·세로 배율이 같다(얼굴이 찌그러지지 않음)', () => {
  for (const c of [BARBER, PLAYER]) {
    const p = cropSquare(W, H, c.portraitFit);
    assert.equal(p.sw, p.sh);
    assert.ok(p.sw > 0 && p.sw <= Math.min(W, H));
    const b = cropSquare(W, H, c.bustFit);
    assert.equal(b.sw, b.sh);
    assert.ok(b.sw > p.sw, '상반신 설정은 초상화보다 넓게 본다');
  }
});

test('cropSquare: focus가 잘라낸 영역의 중심에 온다(가장자리에 걸리지 않을 때)', () => {
  const r = cropSquare(1000, 1000, { focus: [0.5, 0.3], zoom: 2 });
  assert.deepEqual(r, { sx: 250, sy: 50, sw: 500, sh: 500 });
});

test('cropSquare: 원본 밖으로 나가지 않도록 밀어 넣고 크기는 유지한다', () => {
  const top = cropSquare(1000, 1000, { focus: [0.1, 0.05], zoom: 2 });
  assert.deepEqual(top, { sx: 0, sy: 0, sw: 500, sh: 500 });
  const bottom = cropSquare(1000, 1000, { focus: [0.95, 0.99], zoom: 2 });
  assert.deepEqual(bottom, { sx: 500, sy: 500, sw: 500, sh: 500 });
  for (const c of [BARBER, PLAYER]) {
    const p = cropSquare(W, H, c.portraitFit);
    assert.ok(p.sx >= 0 && p.sy >= 0 && p.sx + p.sw <= W && p.sy + p.sh <= H);
  }
});

test('cropSquare: zoom 1 이하는 짧은 변 전체', () => {
  const r = cropSquare(W, H, { focus: [0.5, 0.5], zoom: 0.5 });
  assert.equal(r.sw, W);
  assert.equal(r.sx, 0);
});

test('초상화 설정과 상반신 설정은 인물별로 따로 있고 같은 원본을 가리킨다', () => {
  for (const c of [BARBER, PLAYER]) {
    assert.notDeepEqual(c.portraitFit, c.bustFit);
    assert.ok(c.portraits.normal?.startsWith('assets/characters/'));
  }
  assert.equal(BARBER.portraits.normal, 'assets/characters/barber-neutral.png');
  assert.equal(PLAYER.portraits.normal, 'assets/characters/hero-neutral.png');
});

test('표정 그림이 없으면 기본 그림 키로 대신하고, 아무 그림도 없으면 빈 목록(자리 표시)', () => {
  assert.deepEqual(portraitKeyCandidates(BARBER, 'surprised'), [portraitTextureKey(BARBER, 'normal')]);
  assert.deepEqual(portraitKeyCandidates(BARBER, 'normal'), ['portrait-barber-normal']);
  const withMood: Character = { ...BARBER, portraits: { normal: 'a.png', happy: 'b.png' } };
  assert.deepEqual(portraitKeyCandidates(withMood, 'happy'), ['portrait-barber-happy', 'portrait-barber-normal']);
  const none: Character = { ...BARBER, portraits: {} };
  assert.deepEqual(portraitKeyCandidates(none, 'happy'), []);
});
