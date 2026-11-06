// 공통 UI 부품(요청 13): theme.ts 토큰만 사용한다(widgets.ts의 옛 색·서체는 쓰지 않는다). 기존 화면의 교체는 다음 단계.
// 돌려주는 container를 씬의 레이어에 넣으면 레이어 destroy(true)로 함께 정리된다.
import type Phaser from 'phaser';
import { COLORS, TEXT_STYLES, colorNum } from './theme.ts';

/** 패널·버튼 모서리 둥글기. */
export const RADIUS = 8;

/** 패널: panel 배경 + panelBorder 테두리 + 모서리 8px. */
export function makePanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(colorNum(COLORS.panel), 1).fillRoundedRect(x, y, w, h, RADIUS);
  g.lineStyle(1, colorNum(COLORS.panelBorder), 1).strokeRoundedRect(x, y, w, h, RADIUS);
  return g;
}

export type Button = {
  container: Phaser.GameObjects.Container;
  /** disabled: 글자 textDim·테두리 goldDim, 입력 무시. */
  setEnabled(on: boolean): void;
};

/**
 * 버튼: panel 배경 + gold 1px 테두리 + body 서체. 상태 normal / pressed(그림자 덧칠로 살짝 어두워짐) / disabled.
 * 실행은 버튼 안에서 손을 뗄 때(onTap). 밖으로 끌고 나가면 취소된다.
 */
export function makeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, labelText: string, onTap: () => void): Button {
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const text = scene.add.text(x + w / 2, y + h / 2, labelText, { ...TEXT_STYLES.body, fontSize: Math.min(20, h - 12) }).setOrigin(0.5);
  const hit = scene.add.rectangle(x, y, w, h, 0x000000, 0.001).setOrigin(0);
  container.add([g, text, hit]);
  let enabled = true, pressed = false;
  const redraw = () => {
    g.clear();
    g.fillStyle(colorNum(COLORS.panel), 1).fillRoundedRect(x, y, w, h, RADIUS);
    if (pressed && enabled) g.fillStyle(colorNum(COLORS.shadow), 0.25).fillRoundedRect(x, y, w, h, RADIUS);
    g.lineStyle(1, colorNum(enabled ? COLORS.gold : COLORS.goldDim), 1).strokeRoundedRect(x, y, w, h, RADIUS);
    text.setColor(enabled ? COLORS.text : COLORS.textDim);
  };
  redraw();
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerdown', () => { if (!enabled) return; pressed = true; redraw(); });
  const release = (fire: boolean) => { if (!enabled || !pressed) return; pressed = false; redraw(); if (fire) onTap(); };
  hit.on('pointerup', () => release(true));
  hit.on('pointerout', () => release(false));
  return { container, setEnabled(on: boolean) { enabled = on; pressed = false; redraw(); } };
}

export type Modal = {
  container: Phaser.GameObjects.Container;
  /** 중앙 패널 자리(내용 배치용). */
  panel: { x: number; y: number; w: number; h: number };
  /** 모달 전체(어두운 막 포함)를 제거한다. */
  close(): void;
};

/**
 * 모달: 화면 전체를 어둡게(shadow, 알파 0.6) 덮어 뒤쪽 입력을 차단하고, 중앙에 w×h 패널(makePanel)을 띄운다.
 * onClose가 있으면 패널 밖(어두운 막)을 눌렀을 때 호출한다(모달 제거는 호출한 쪽이 close()로).
 */
export function makeModal(scene: Phaser.Scene, w: number, h: number, onClose?: () => void): Modal {
  const sw = scene.scale.width, sh = scene.scale.height;
  const container = scene.add.container(0, 0);
  const dim = scene.add.rectangle(0, 0, sw, sh, colorNum(COLORS.shadow), 0.6).setOrigin(0).setInteractive();
  const x = Math.round((sw - w) / 2), y = Math.round((sh - h) / 2);
  container.add([dim, makePanel(scene, x, y, w, h)]);
  if (onClose) dim.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const inside = p.worldX >= x && p.worldX <= x + w && p.worldY >= y && p.worldY <= y + h;
    if (!inside) onClose();
  });
  return { container, panel: { x, y, w, h }, close: () => container.destroy(true) };
}
