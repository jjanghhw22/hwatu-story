// 초상화 컴포넌트. 캐릭터 그림이 읽혀 있으면 얼굴·어깨 중심으로 잘라 원 안에 그리고(portraitFit), 없으면 자리 표시 초상화(황동 테 + 실루엣 + 이니셜)를 그린다.
// 표정 그림이 없는 표정은 기본 그림(normal)을 쓰고 표정 배지와 작은 움직임만 더한다. 그림 교체·조정은 character.ts에서만 한다.
import type Phaser from 'phaser';
import { type Character, MOODS, type Mood, cropSquare, portraitKeyCandidates, portraitTextureKey } from '../character';
import { COLORS, type UI, label } from './widgets';

/** 원형 초상화 텍스처를 화면 지름의 몇 배로 만들지(휴대폰 고해상도에서 흐려지지 않게). */
const PORTRAIT_SUPERSAMPLE = 3;

/** 씬 preload: 등록된 그림 파일만 읽는다. 이미 읽힌 키(새 판 restart)는 다시 등록하지 않는다. 읽기 실패는 경고만 남기고 자리 표시로 대신한다. */
export function preloadPortraits(loader: Phaser.Loader.LoaderPlugin, chars: Character[]) {
  for (const c of chars) for (const [mood, file] of Object.entries(c.portraits)) {
    const key = portraitTextureKey(c, mood as Mood);
    if (file && !loader.textureManager.exists(key)) loader.image(key, file);
  }
  loader.once('loaderror', (file: { key: string; src: string }) => {
    if (file.key.startsWith('portrait-')) console.warn('캐릭터 그림을 읽지 못해 자리 표시 초상화를 씁니다:', file.key, file.src);
  });
}

export type PortraitView = { container: Phaser.GameObjects.Container; cx: number; cy: number; r: number };

/**
 * 원형으로 잘라낸 초상화 텍스처. (인물·표정·반지름)마다 한 번만 만들고 텍스처 관리자에 남겨 두므로 새 판·매 draw에서 중복 생성되지 않는다.
 * 원본에서 정사각형(cropSquare)을 잘라 정사각형 캔버스에 그리므로 비율이 유지된다. 그림이 없으면 undefined.
 */
function circlePortraitKey(scene: Phaser.Scene, c: Character, mood: Mood, r: number): string | undefined {
  const src = portraitKeyCandidates(c, mood).find(k => scene.textures.exists(k));
  if (!src) return undefined;
  const key = `${src}-circle-${r}`;
  if (scene.textures.exists(key)) return key;
  const image = scene.textures.get(src).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const d = r * 2 * PORTRAIT_SUPERSAMPLE;
  const canvas = scene.textures.createCanvas(key, d, d);
  if (!canvas) return undefined;
  const ctx = canvas.getContext();
  const crop = cropSquare(image.width, image.height, c.portraitFit);
  ctx.save();
  ctx.beginPath(); ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, d, d);
  ctx.restore();
  canvas.refresh();
  return key;
}

/** 초상화. 돌려주는 컨테이너에 표정 반응 트윈을 걸 수 있다. */
export function drawPortrait(ui: UI, cx: number, cy: number, r: number, c: Character, mood: Mood, active: boolean): PortraitView {
  const s = ui.scene, container = s.add.container(0, 0);
  ui.layer.add(container);
  const sub: UI = { scene: s, layer: container };
  // 황동 테(차례면 금색) 위에 어두운 바탕
  container.add(s.add.circle(cx, cy + 2, r + 4, 0x0a0806, 0.5));
  container.add(s.add.circle(cx, cy, r + 3, active ? COLORS.cardSelectedEdge : COLORS.brass));
  container.add(s.add.circle(cx, cy, r, 0x1b2a26));
  const key = circlePortraitKey(s, c, mood, r);
  if (key) {
    container.add(s.add.image(cx, cy, key).setScale(1 / PORTRAIT_SUPERSAMPLE));
  } else {
    // 자리 표시(그림을 읽지 못했을 때만): 머리·어깨 실루엣 + 이니셜
    container.add(s.add.ellipse(cx, cy + r * 0.95, r * 1.5, r * 0.9, 0x3a4a44));
    container.add(s.add.circle(cx, cy - r * 0.15, r * 0.48, 0x4a5a54));
    container.add(s.add.circle(cx, cy, r, 0x000000, 0).setStrokeStyle(1, 0x5a6a64));
    label(sub, cx, cy + r * 0.05, c.initial, Math.round(r * 0.8), COLORS.text, r * 2, [0.5, 0.5], true);
  }
  const info = MOODS[mood];
  if (info.glyph) {
    // 표정 배지: 표정 그림이 아직 없으므로 상태는 배지와 움직임으로 보인다
    container.add(s.add.circle(cx + r * 0.75, cy - r * 0.75, Math.max(9, r * 0.28), COLORS.brass).setStrokeStyle(1, 0x3a2619));
    label(sub, cx + r * 0.75, cy - r * 0.75, info.glyph, Math.max(11, Math.round(r * 0.34)), COLORS.dark, r, [0.5, 0.5], true);
  }
  return { container, cx, cy, r };
}

/** 상태별 작은 움직임(놀람: 튀어오름, 당황: 좌우 떨림, 기쁨: 까딱, 패배: 가라앉음). 기다리지 않는다. */
export function portraitReact(scene: Phaser.Scene, view: PortraitView, mood: Mood, reduced: boolean): Phaser.Tweens.Tween | undefined {
  const t = view.container, m = MOODS[mood].motion;
  if (reduced || m === 'none') return undefined;
  if (m === 'bounce') return scene.tweens.add({ targets: t, y: -8, duration: 90, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
  if (m === 'shake') return scene.tweens.add({ targets: t, x: 4, duration: 45, yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
  if (m === 'bob') return scene.tweens.add({ targets: t, y: -5, duration: 140, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  return scene.tweens.add({ targets: t, y: 6, alpha: 0.85, duration: 300, ease: 'Quad.easeOut' });
}
