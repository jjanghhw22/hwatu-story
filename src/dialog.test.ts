import test from 'node:test';
import assert from 'node:assert/strict';
import { BARBER_LINES, DialogPolicy, EVENT_MOOD } from './dialog.ts';

test('대사는 사건 때만, 최소 3턴 간격, 결과 대사는 예외, 새 판에서 초기화', () => {
  const d = new DialogPolicy(BARBER_LINES, 3);
  assert.equal(d.pick('playerCombo', 2), '오, 제법인데?');
  assert.equal(d.pick('aiPpeok', 3), null);      // 간격 1
  assert.equal(d.pick('playerGo', 4), null);     // 간격 2
  assert.equal(d.pick('aiPpeok', 5, () => 0), '아이고, 붙었네.'); // 간격 3
  assert.equal(d.pick('playerWin', 6, () => 0), '좋아. 다음 얘길 해주지.'); // 결과 대사는 간격 예외
  assert.equal(d.pick('aiWin', 6), '오늘은 여기까지. 또 오게.');
  d.reset();
  assert.equal(d.pick('playerGo', 0, () => 0), '배짱은 있구먼.');
  assert.equal(d.pick('playerJjok', 3), '허, 잘 붙네.');
  assert.equal(d.pick('playerSseul', 6), '싹 가져가는구먼.');
  assert.equal(d.pick('playerBomb', 9), '그걸 숨겨 뒀어?');
  for (const k of Object.keys(BARBER_LINES) as (keyof typeof BARBER_LINES)[]) { assert.ok(BARBER_LINES[k].length >= 1, k); assert.ok(EVENT_MOOD[k], k); }
});
