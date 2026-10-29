// 카드 이동·뒤집기·강조·배너·섬광 연출. 정적 화면(layer)과 별도의 fx 컨테이너에 스프라이트를 띄우고 트윈으로 움직인다.
// 상태(GameState)는 건드리지 않는다. clear()로 진행 중인 트윈·스프라이트·배너·말풍선을 모두 정리한다.
// 시간·크기·강도는 FX 한곳에서 관리한다. 아래 수치는 이 게임의 초기 연출 설정값이며 다른 게임의 측정값이 아니다.
import Phaser from 'phaser';
import type { Card } from '../cards';
import { BACK_TEXTURE, cardTextureKey } from './cardAssets';
import { type Rect, SPEECH } from './layout';
import { BRUSH_FONT, FONT } from './widgets';

export const FX = {
  /** 손패 선택: 위로 살짝 들어올림. */
  select: 70, selectLift: 14,
  /** 패 내기: 출발은 빠르고 도착은 짧게 감속(Cubic.easeOut). 이동 중 약한 기울기와 그림자. */
  fly: 160, flyTilt: 5, shadowDx: 5, shadowDy: 8,
  /** 접촉 순간: 작은 크기 변화와 충격 표시. */
  impact: 60, impactScale: 1.06, impactRing: 140,
  /** 뒤집기 총 시간(절반 지점에서 앞면으로 교체). */
  flip: 160,
  /** 맞은 패 강조. */
  highlight: 100,
  /** 획득 이동. */
  capture: 210,
  /** 빈자리 정리(손패·획득패가 짧게 이동). */
  slide: 120,
  /** 사건 글자: 쪽 300, 따닥·쓸 350, 뻑 400, 폭탄 450, 족보 600, 고 450, 흔들기 400. */
  bannerJjok: 300, bannerShort: 350, bannerPpeok: 400, bannerBomb: 450, bannerCombo: 600, bannerGo: 450, bannerShake: 400,
  /** 글자 등장: 작게 → 빠르게 커짐 → 살짝 돌아옴. */
  bannerIn: 110, bannerSettle: 70, bannerOut: 120,
  /** 쪽 섬광, 쓸 궤적. */
  flash: 160, trail: 260,
  /** 점수 숫자 강조. */
  scorePulse: 150,
  /** 폭탄 화면 흔들림(연출 줄이기에서는 없음). 최대 100ms. */
  shake: 100, shakeAmp: 0.003,
  /** 상대 생각 시간, 결과창 항목 간격, 말풍선 표시 시간, 도발 말풍선 뒤 고/스톱 창까지 기다리는 시간. */
  think: 400, resultStep: 260, bubble: 2400, taunt: 900,
  /** 들통 막·배너, 흔들기 종 흔들림, 투시경 공개 시간, 의심도 바 흔들림. */
  bust: 600, bell: 300, xray: 3000, suspicionShake: 80,
  /** 패 나누기: 한 장 이동 시간, 다음 장 출발 간격(연출 줄이기에서는 ms()로 절반). */
  deal: 140, dealStep: 45,
  /** 먹을 수 있는 손패 화살표의 위아래 왕복 주기(연출 줄이기에서는 움직이지 않음). */
  arrowBob: 600,
} as const;
/** 예전 이름 호환. */
export const FX_MS = FX;

const STORAGE_KEY = 'hwatu.fx.reduced';
/** 연출 설정: 줄이기 모드(화면 흔들림·번쩍임 없음, 카드 이동 절반). 규칙 처리 순서와 결과는 바뀌지 않는다. */
export class FxSettings {
  reduced = false;
  constructor() { try { this.reduced = localStorage.getItem(STORAGE_KEY) === 'on'; } catch { /* 저장소 없음 */ } }
  setReduced(v: boolean) { this.reduced = v; try { localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off'); } catch { /* 저장소 없음 */ } }
  /** 이동·강조 시간. 줄이기에서는 절반(최소 40ms). */
  ms(base: number) { return this.reduced ? Math.max(40, Math.round(base * 0.5)) : base; }
  /** 배너 시간. 줄이기에서는 60%. */
  bannerMs(base: number) { return this.reduced ? Math.round(base * 0.6) : base; }
}

/** 배너 스타일: 붓터치 배경색과 글자색. ink 먹물(뻑·따닥·회수), gold 금색(족보·흔들기·쪽), red 붉은 붓(고), orange 주황(폭탄), green 초록(쓸). */
export type BannerStyle = 'ink' | 'gold' | 'red' | 'orange' | 'green';
const BANNER: Record<BannerStyle, { fill: number; fillAlpha: number; edge: number; color: string; stroke: string }> = {
  ink: { fill: 0x14100e, fillAlpha: 0.92, edge: 0x3a2619, color: '#f3e9d2', stroke: '#0a0806' },
  gold: { fill: 0x3a2a10, fillAlpha: 0.92, edge: 0xb08d4a, color: '#f2c45a', stroke: '#2a1a08' },
  red: { fill: 0x8a1a1a, fillAlpha: 0.94, edge: 0xc0392b, color: '#fff1c2', stroke: '#3a0808' },
  orange: { fill: 0xb8521a, fillAlpha: 0.94, edge: 0xf0923a, color: '#fff1c2', stroke: '#4a1a04' },
  green: { fill: 0x1d5a3a, fillAlpha: 0.94, edge: 0x4caf7a, color: '#f3e9d2', stroke: '#062a18' },
};

export class CardFx {
  private tweens = new Set<Phaser.Tweens.Tween>();
  private objects = new Set<Phaser.GameObjects.GameObject>();
  private bubble?: { objs: Phaser.GameObjects.GameObject[]; timer: Phaser.Time.TimerEvent };
  constructor(private scene: Phaser.Scene, readonly layer: Phaser.GameObjects.Container, readonly settings: FxSettings = new FxSettings()) {}

  /** 카드 스프라이트를 r 위치·크기(·기울기)로 만든다. card=null이면 뒷면. */
  spawn(card: Card | null, r: Rect): Phaser.GameObjects.Image {
    const key = card ? cardTextureKey(card.id) : BACK_TEXTURE.key;
    const img = this.scene.add.image(r.x + r.w / 2, r.y + r.h / 2, key).setDisplaySize(r.w, r.h).setAngle(r.angle ?? 0);
    this.layer.add(img); this.objects.add(img);
    return img;
  }
  remove(obj: Phaser.GameObjects.GameObject) { this.objects.delete(obj); obj.destroy(); }
  private track<T extends Phaser.GameObjects.GameObject>(o: T): T { this.layer.add(o); this.objects.add(o); return o; }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(resolve => {
      const tw = this.scene.tweens.add({ ...cfg, onComplete: () => { this.tweens.delete(tw); resolve(); } });
      this.tweens.add(tw);
    });
  }
  /** 트윈 없이 잠깐 기다린다(씬 시계 기준이라 clear() 뒤에도 안전). */
  wait(ms: number) { return new Promise<void>(r => this.scene.time.delayedCall(ms, r)); }

  /** 기울기만 바꾼다(흔들기 부채꼴 펼침). */
  tiltTo(img: Phaser.GameObjects.Image, angle: number, ms: number = this.settings.ms(FX.fly)) {
    return this.tween({ targets: img, angle, duration: ms, ease: 'Cubic.easeOut' });
  }
  /** 손패 선택 피드백: 위로 살짝 올린다. */
  lift(img: Phaser.GameObjects.Image, ms: number = this.settings.ms(FX.select)) {
    return this.tween({ targets: img, y: img.y - FX.selectLift, duration: ms, ease: 'Quad.easeOut' });
  }

  /** r 위치·크기로 이동. 출발은 빠르고 도착은 짧게 감속한다. 도착 뒤 그림 비율은 r 그대로(displaySize), 각도는 r.angle(없으면 0). */
  moveTo(img: Phaser.GameObjects.Image, r: Rect, ms: number = this.settings.ms(FX.fly)) {
    return this.tween({ targets: img, x: r.x + r.w / 2, y: r.y + r.h / 2, displayWidth: r.w, displayHeight: r.h, angle: r.angle ?? 0, duration: ms, ease: 'Cubic.easeOut' });
  }

  /**
   * 패 날리기: 이동 중 작은 그림자와 약한 기울기로 두께감을 주고, 도착하면 그림자를 지우고 기울기·크기를 정확히 복원한다.
   * 연출 줄이기에서는 그림자·기울기 없이 moveTo와 같다.
   */
  async fly(img: Phaser.GameObjects.Image, r: Rect, ms: number = this.settings.ms(FX.fly), tilt: number = FX.flyTilt) {
    if (this.settings.reduced) { await this.moveTo(img, r, ms); return; }
    const dir = r.x + r.w / 2 >= img.x ? 1 : -1;
    const shadow = this.track(this.scene.add.rectangle(img.x + FX.shadowDx, img.y + FX.shadowDy, img.displayWidth, img.displayHeight, 0x000000, 0.3).setOrigin(0.5));
    this.layer.moveBelow<Phaser.GameObjects.GameObject>(shadow, img);
    const landAngle = r.angle ?? 0;
    img.setAngle(landAngle + dir * tilt);
    await this.tween({
      targets: img, x: r.x + r.w / 2, y: r.y + r.h / 2, displayWidth: r.w, displayHeight: r.h, angle: landAngle, duration: ms, ease: 'Cubic.easeOut',
      onUpdate: () => { if (shadow.active) { shadow.setPosition(img.x + FX.shadowDx, img.y + FX.shadowDy); shadow.setDisplaySize(img.displayWidth, img.displayHeight); } },
    });
    if (shadow.active) this.remove(shadow);
    if (img.active) { img.setAngle(landAngle); img.setDisplaySize(r.w, r.h); }
  }

  /**
   * 접촉 순간: 카드를 아주 짧게 키웠다 되돌리고(크기 변화), 작은 충격 고리를 퍼뜨린다(연출 줄이기에서는 고리 없음).
   * strength 1이 일반 내기, 폭탄은 더 크게(주황 충격파). 크기는 r로 정확히 복원한다.
   */
  async impact(img: Phaser.GameObjects.Image, r: Rect, strength = 1) {
    const s = 1 + (FX.impactScale - 1) * strength;
    if (!this.settings.reduced) this.ring(r.x + r.w / 2, r.y + r.h * 0.8, Math.max(r.w, r.h) * 0.6 * strength, strength > 1 ? 0xf0923a : 0xffe6a6, strength > 1 ? 5 : 3);
    await this.tween({ targets: img, displayWidth: r.w * s, displayHeight: r.h * s, duration: this.settings.ms(FX.impact) / 2, yoyo: true, ease: 'Quad.easeOut' });
    if (img.active) img.setDisplaySize(r.w, r.h);
  }
  /** 충격 고리: 얇은 원이 퍼지며 사라진다. 기다리지 않는다. */
  ring(cx: number, cy: number, radius: number, color = 0xffe6a6, width = 3) {
    const c = this.track(this.scene.add.circle(cx, cy, radius * 0.4).setStrokeStyle(width, color).setAlpha(0.9));
    void this.tween({ targets: c, radius, alpha: 0, duration: this.settings.ms(FX.impactRing), ease: 'Quad.easeOut' }).then(() => { if (c.active) this.remove(c); });
  }
  /** 쪽: 맞은 두 패 사이의 짧은 금빛 섬광(가는 띠 + 작은 고리). 패를 가리는 큰 폭발은 없다. 연출 줄이기에서는 생략. */
  flash(a: Rect, b: Rect) {
    if (this.settings.reduced) return;
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const len = Math.max(24, Math.hypot(bx - ax, by - ay)), ang = Math.atan2(by - ay, bx - ax);
    const bar = this.track(this.scene.add.rectangle((ax + bx) / 2, (ay + by) / 2, len + a.w * 0.6, 6, 0xffe6a6, 0.95).setRotation(ang));
    void this.tween({ targets: bar, scaleY: 0.2, alpha: 0, duration: this.settings.ms(FX.flash), ease: 'Quad.easeOut' }).then(() => { if (bar.active) this.remove(bar); });
    this.ring((ax + bx) / 2, (ay + by) / 2, a.w * 0.5, 0xffd36a, 2);
  }
  /** 쓸: 바닥에서 획득 칸으로 가는 얇은 초록빛 궤적. 기다리지 않는다. 연출 줄이기에서는 생략. */
  trail(from: Rect, to: Rect) {
    if (this.settings.reduced) return;
    const ax = from.x + from.w / 2, ay = from.y + from.h / 2, bx = to.x + to.w / 2, by = to.y + to.h / 2;
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
    const line = this.track(this.scene.add.rectangle(ax, ay, len, 3, 0x7fe0a8, 0.75).setOrigin(0, 0.5).setRotation(ang).setScale(0, 1));
    void this.tween({ targets: line, scaleX: 1, duration: this.settings.ms(FX.trail) * 0.5, ease: 'Quad.easeOut' })
      .then(() => this.tween({ targets: line, alpha: 0, duration: this.settings.ms(FX.trail) * 0.5 }))
      .then(() => { if (line.active) this.remove(line); });
  }

  /** 뒷면 → 앞면 뒤집기(가로 축 압축 후 복원). 절반 지점에서 앞면 텍스처로 바꾸므로 그 전에는 앞면이 보이지 않는다. 끝나면 가로 배율을 정확히 복원한다. */
  async flipTo(img: Phaser.GameObjects.Image, card: Card, total: number = this.settings.ms(FX.flip)) {
    const sx = img.scaleX, half = total / 2;
    await this.tween({ targets: img, scaleX: 0, duration: half, ease: 'Sine.easeIn' });
    if (!img.active) return;
    img.setTexture(cardTextureKey(card.id));
    await this.tween({ targets: img, scaleX: sx, duration: half, ease: 'Sine.easeOut' });
    if (img.active) img.scaleX = sx;
  }

  /** 금색 테두리를 잠깐 깜빡여 강조. */
  async highlight(rects: Rect[], ms: number = this.settings.ms(FX.highlight), color = 0xe0b64f) {
    const rings = rects.map(r => this.track(this.scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w + 6, r.h + 6).setAngle(r.angle ?? 0).setStrokeStyle(4, color).setAlpha(0)));
    await this.tween({ targets: rings, alpha: 1, duration: ms / 2, yoyo: true, ease: 'Sine.easeInOut' });
    rings.forEach(r => this.remove(r));
  }

  /** 붓터치 모양: 가로로 긴 거친 다각형(고정 시드 흔들림이라 모양이 매번 같다). */
  private brush(cx: number, cy: number, w: number, h: number, fill: number, alpha: number, edge: number, seed = 7) {
    const g = this.scene.add.graphics();
    const pts: { x: number; y: number }[] = [];
    const n = 18;
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const jitter = 0.86 + rnd() * 0.28;
      pts.push({ x: Math.cos(a) * (w / 2) * jitter, y: Math.sin(a) * (h / 2) * jitter });
    }
    g.fillStyle(fill, alpha); g.fillPoints(pts, true);
    g.lineStyle(2, edge, 0.6); g.strokePoints(pts, true);
    g.setPosition(cx, cy);
    return this.track(g);
  }

  /**
   * 사건 글자 배너: 큰 붓글씨 + 짧은 붓터치 배경. 작게 시작 → 빠르게 커짐 → 살짝 돌아옴 → 짧게 유지 → 사라짐.
   * 여러 개는 호출 순서대로 await 되어 겹치지 않는다. shakeText면 유지 중 글자만 좌우로 짧게 떨린다(뻑).
   */
  async banner(text: string, cx: number, cy: number, ms: number = FX.bannerShort, o: { style?: BannerStyle; size?: number; shakeText?: boolean } = {}) {
    const dur = this.settings.bannerMs(ms), st = BANNER[o.style ?? 'ink'];
    const size = o.size ?? 64;
    const t = this.track(this.scene.add.text(cx, cy, text, { fontFamily: BRUSH_FONT, fontSize: size, color: st.color, stroke: st.stroke, strokeThickness: Math.round(size / 8), fontStyle: 'bold' }).setOrigin(0.5));
    const bw = Math.max(200, t.width + size * 1.1), bh = size * 1.55;
    const bg = this.brush(cx, cy + size * 0.06, bw, bh, st.fill, st.fillAlpha, st.edge, text.length * 13 + size);
    this.layer.moveBelow<Phaser.GameObjects.GameObject>(bg, t);
    const targets = [bg, t];
    for (const x of targets) { x.setAlpha(0); x.setScale(0.3); }
    const inMs = this.settings.ms(FX.bannerIn), settleMs = this.settings.ms(FX.bannerSettle), outMs = Math.min(FX.bannerOut, dur * 0.4);
    await this.tween({ targets, alpha: 1, scaleX: 1.14, scaleY: 1.14, duration: inMs, ease: 'Quad.easeOut' });
    await this.tween({ targets, scaleX: 1, scaleY: 1, duration: settleMs, ease: 'Quad.easeInOut' });
    const hold = Math.max(0, dur - inMs - settleMs - outMs);
    if (o.shakeText && !this.settings.reduced && hold > 60) await this.tween({ targets: t, x: cx + 4, duration: 40, yoyo: true, repeat: Math.min(5, Math.floor(hold / 80)), ease: 'Sine.easeInOut' });
    else if (hold > 0) await this.wait(hold);
    await this.tween({ targets, alpha: 0, duration: outMs, ease: 'Sine.easeIn' });
    this.remove(bg); this.remove(t);
  }

  /** 점수 변화: "+2"/"−1" 글자가 (x, y)에서 위로 떠오르며 사라지고, 숫자 글자를 잠깐 키운다. originX 1이면 x를 오른쪽 끝으로(점수 배지 왼쪽 바깥). 기다리지 않는다. */
  scorePulse(target: Phaser.GameObjects.Text | undefined, x: number, y: number, delta: number, originX = 0, text?: string) {
    const t = this.track(this.scene.add.text(x, y, text ?? `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, { fontFamily: FONT, fontSize: 22, color: delta > 0 ? '#f2c45a' : '#e09a9a', stroke: '#1a120c', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(originX, 0.5));
    void this.tween({ targets: t, y: y - 18, alpha: 0, duration: this.settings.ms(FX.scorePulse) * 3, delay: 80, ease: 'Quad.easeOut' }).then(() => { if (t.active) this.remove(t); });
    if (target?.active) void this.tween({ targets: target, scaleX: 1.15, scaleY: 1.15, duration: this.settings.ms(FX.scorePulse) / 2, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** 화면 흔들림(폭탄). 연출 줄이기에서는 하지 않는다. 최대 FX.shake. */
  shakeScreen(ms: number = FX.shake, amp: number = FX.shakeAmp) {
    if (this.settings.reduced) return;
    this.scene.cameras.main.shake(Math.min(ms, FX.shake), amp);
  }

  /**
   * 상대 말풍선: 미리 비워 둔 자리(zone)에 잠깐 보였다 사라진다. 흐름을 멈추지 않는다. 새 말풍선이 오면 이전 것을 바로 지운다.
   * 자리 폭을 넘는 대사는 글자를 줄이지 않고 폭에 맞춰 두 줄로 접는다(높이 zone.h → 최대 SPEECH.maxH, 자리 위쪽에 맞춰 패널 안에 머무름). 오른쪽 경계(점수 배지 왼쪽) 밖으로 나가지 않는다.
   */
  speech(text: string, zone: Rect) {
    this.clearBubble();
    const t = this.scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: 15, color: '#1a120c', fontStyle: 'bold', wordWrap: { width: zone.w - 24 } }).setOrigin(0, 0.5);
    const h = Math.min(SPEECH.maxH, Math.max(zone.h, t.height + 8)), y = zone.y + h / 2;
    t.setY(y);
    const w = Math.min(zone.w, t.width + 24);
    const x = zone.x + zone.w - w; // 오른쪽 정렬(초상화 반대쪽, 말꼬리는 왼쪽), 오른쪽 끝은 zone 안
    t.setX(x + 12);
    const bg = this.scene.add.rectangle(x, y, w, h, 0xf6eedb, 0.97).setOrigin(0, 0.5).setStrokeStyle(1, 0x9c2f3a);
    const tail = this.scene.add.triangle(x - 9, y, 0, 6, 10, 0, 10, 12, 0xf6eedb).setOrigin(0, 0.5);
    const objs = [bg, tail, t];
    for (const o of objs) { o.setAlpha(0); this.track(o); }
    void this.tween({ targets: objs, alpha: 1, duration: 120 });
    const timer = this.scene.time.delayedCall(FX.bubble, () => { void this.tween({ targets: objs, alpha: 0, duration: 160 }).then(() => objs.forEach(o => { if (o.active) this.remove(o); })); this.bubble = undefined; });
    this.bubble = { objs, timer };
  }
  private clearBubble() {
    if (!this.bubble) return;
    this.bubble.timer.remove(false);
    for (const o of this.bubble.objs) if (o.active) this.remove(o);
    this.bubble = undefined;
  }

  /** 진행 중인 모든 트윈을 멈추고 스프라이트·배너·말풍선을 지운다. 새 판·씬 종료 시 호출. */
  clear() {
    this.clearBubble();
    for (const tw of this.tweens) tw.remove();
    this.tweens.clear();
    for (const o of this.objects) o.destroy();
    this.objects.clear();
  }
}
