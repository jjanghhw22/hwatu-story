// 이벤트 콜아웃(요청 21): 판의 사건(쪽·뻑·따닥·싹쓸이·고·흔들·폭탄 등)을 화면에 도장 찍듯 큰 문구로 띄운다.
// 입력은 차단하지 않는다(뒤 판은 그대로 보이고 눌리지도 않게 막지 않는다). 글자 뒤에는 이미지 없이 Graphics 먹 번짐 구름 하나.
// 연출 줄이기: 스케일 연출 생략, 유지 0.3초.
import type Phaser from 'phaser';
import { SOUND } from './sound.ts';
import { COLORS, FONTS, colorNum } from './theme.ts';

export type CalloutTone = 'gold' | 'red';
export type CalloutOpts = {
  /** 기본 gold, 나쁜 사건(뻑·박 경고)은 red. */
  tone?: CalloutTone;
  /** 상대 사건: 0.7배(호출 쪽이 위쪽 좌표와 함께 넘긴다). */
  small?: boolean;
  x?: number; y?: number;
  /** '연출 줄이기' 설정값(FxSettings.reduced). */
  reduced: boolean;
};
/** 글자 크기(명세 64~80 범위)·깊이·시간. 등장 스케일 1.5→1.0 0.25초, 0.8초 유지 후 페이드. */
const SIZE = 72, DEPTH = 850, IN_MS = 250, HOLD_MS = 800, OUT_MS = 200, HOLD_REDUCED_MS = 300;

/** 글자 뒤 먹 번짐 구름: 겹친 원들(그림 파일 없이). sin 기반 고정 패턴이라 같은 글자는 같은 모양. */
function inkCloud(scene: Phaser.Scene, textW: number, tone: CalloutTone): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const w = textW + SIZE * 0.9, h = SIZE * 1.5, n = Math.max(4, Math.round(w / 56));
  g.fillStyle(colorNum(COLORS.shadow), 0.5);
  for (let i = 0; i <= n; i++) {
    const px = -w / 2 + (w / n) * i, r = (h / 2) * (0.72 + 0.34 * Math.abs(Math.sin(i * 2.399)));
    g.fillCircle(px, (i % 2 ? -1 : 1) * h * 0.07, r);
  }
  // 가장자리에 아주 옅은 색 번짐(참고 게임 뱃지의 테두리 느낌)
  g.fillStyle(colorNum(tone === 'red' ? COLORS.red : COLORS.goldDim), 0.12);
  for (let i = 0; i <= n; i++) {
    const px = -w / 2 + (w / n) * i, r = (h / 2) * (0.86 + 0.3 * Math.abs(Math.sin(i * 1.731)));
    g.fillCircle(px, (i % 2 ? 1 : -1) * h * 0.09, r);
  }
  return g;
}

/** 콜아웃 하나를 띄우고 사라질 때까지의 Promise를 돌려준다. 등장음(stamp)은 여기서 낸다. */
export function showCallout(scene: Phaser.Scene, text: string, o: CalloutOpts): Promise<void> {
  return new Promise(resolve => {
    const tone = o.tone ?? 'gold', scaleTo = o.small ? 0.7 : 1;
    const x = o.x ?? scene.scale.width / 2, y = o.y ?? scene.scale.height / 2;
    const c = scene.add.container(x, y).setDepth(DEPTH);
    const t = scene.add.text(0, 0, text, {
      fontFamily: FONTS.title, fontSize: SIZE, fontStyle: 'bold',
      color: tone === 'red' ? COLORS.red : COLORS.gold,
      stroke: COLORS.shadow, strokeThickness: 10,
    }).setOrigin(0.5);
    c.add([inkCloud(scene, t.width, tone), t]);
    SOUND.sfx('stamp');
    const done = () => { c.destroy(); resolve(); };
    const fadeOut = (holdMs: number, outMs: number) =>
      scene.time.delayedCall(holdMs, () => scene.tweens.add({ targets: c, alpha: 0, duration: outMs, ease: 'Sine.easeIn', onComplete: done }));
    if (o.reduced) {
      c.setScale(scaleTo).setAlpha(0);
      scene.tweens.add({ targets: c, alpha: 1, duration: 80, onComplete: () => fadeOut(HOLD_REDUCED_MS, 100) });
      return;
    }
    c.setScale(1.5 * scaleTo).setAlpha(0);
    scene.tweens.add({
      targets: c, alpha: 1, scale: scaleTo, duration: IN_MS, ease: 'Cubic.easeIn',
      onComplete: () => fadeOut(HOLD_MS, OUT_MS),
    });
  });
}
