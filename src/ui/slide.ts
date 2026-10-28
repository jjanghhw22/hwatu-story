// 정적 화면을 다시 그릴 때 같은 키(카드 id 등)의 요소가 자리를 옮겼으면 이전 자리에서 새 자리로 짧게 미끄러지게 한다.
// 그리기는 그대로 하고(요소는 매번 새로 만든다) 담는 컨테이너만 잠깐 어긋나게 두었다가 0으로 되돌리는 방식이라 규칙·입력과 무관하다.
import Phaser from 'phaser';
import type { Rect } from './layout';
import type { UI } from './widgets';

export class SlideTracker {
  private last = new Map<string, { x: number; y: number }>();
  private tweens = new Set<Phaser.Tweens.Tween>();
  constructor(private scene: Phaser.Scene, private ms: () => number) {}
  /**
   * key의 요소를 r 자리에 그린다(draw는 하위 컨테이너에 그린다). 이전 자리가 있고 다르면 그곳에서 미끄러져 오고,
   * 처음 나타나는 요소는 appear에 따라 바로 보이거나(none) 잠깐 뒤 나타난다(fade, delay ms).
   */
  place(ui: UI, key: string, r: Rect, draw: (ui: UI) => void, appear: 'none' | 'fade' = 'none', delay = 0) {
    const sub = ui.scene.add.container(0, 0);
    ui.layer.add(sub);
    draw({ scene: ui.scene, layer: sub });
    const prev = this.last.get(key);
    this.last.set(key, { x: r.x, y: r.y });
    if (prev && (prev.x !== r.x || prev.y !== r.y)) {
      sub.setPosition(prev.x - r.x, prev.y - r.y);
      this.tween({ targets: sub, x: 0, y: 0, duration: this.ms(), ease: 'Quad.easeOut' });
    } else if (!prev && appear === 'fade') {
      sub.setAlpha(0);
      this.tween({ targets: sub, alpha: 1, duration: this.ms(), delay, ease: 'Quad.easeOut' });
    }
  }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    const tw = this.scene.tweens.add({ ...cfg, onComplete: () => this.tweens.delete(tw) });
    this.tweens.add(tw);
  }
  /** 다시 그리기 직전에 호출: 지워질 요소를 향한 트윈을 멈춘다. 기억한 자리는 유지한다. */
  killTweens() { for (const tw of this.tweens) tw.remove(); this.tweens.clear(); }
  /** 새 판: 기억한 자리를 모두 잊는다. */
  reset() { this.killTweens(); this.last.clear(); }
  /** 이 키를 잊는다(예: 획득 연출 뒤 날아간 카드가 제자리에서 바로 나타나게). */
  forget(key: string) { this.last.delete(key); }
}
