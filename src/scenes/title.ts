// 타이틀 화면(요청 20): 게임의 첫 화면. 키 일러스트·로고는 파일이 생기면 그대로 읽고, 없으면 theme 폴백(404 폴백 규칙, missing.ts).
// 버튼을 누른 뒤의 흐름은 기존과 동일하다: boot 씬이 저장 유무로 프롤로그/지도를 가른다 — 이 화면은 그 앞단에 더해진 "화면"일 뿐이다.
import Phaser from 'phaser';
import { version } from '../../package.json';
import { STORAGE_KEY, deserialize, resetProgress } from '../story/progress';
import { makeButton, makeModal } from '../ui/components';
import { FxSettings } from '../ui/fx';
import { SOUND } from '../ui/sound';
import { DESIGN } from '../ui/layout';
import { loadFailed, noteMissing } from '../ui/missing';
import { COLORS, TEXT_STYLES, colorNum } from '../ui/theme';
import { SCENE_KEYS } from './flow';

const KEY_ART = 'assets/ui/title_key.png';
const LOGO = 'assets/ui/logo.png';
const CARD_BACK = 'assets/cards/back.png';
const tKey = (path: string) => `title:${path}`;

/** 저장된 진행이 실제로 읽히는가('이어하기' 표시 기준). 깨진 저장은 없는 것으로 친다. */
function hasSave(): boolean {
  try { const t = localStorage.getItem(STORAGE_KEY); return !!t && deserialize(t) !== null; } catch { return false; }
}

const BTN = { w: 400, h: 56, gap: 16 } as const;
/** 흩날리는 꽃잎 수(성능 상한: 동시 20개 이하). */
const PETALS = 16;
const PETAL_COLORS = [COLORS.gold, COLORS.goldDim, COLORS.red] as const;

export class TitleScene extends Phaser.Scene {
  private petalLayer!: Phaser.GameObjects.Container;
  constructor() { super(SCENE_KEYS.title); }
  preload() {
    for (const path of [KEY_ART, LOGO, CARD_BACK]) {
      const k = tKey(path);
      if (!this.textures.exists(k) && !loadFailed(k)) this.load.image(k, path);
    }
    this.load.on('loaderror', (file: { key: string; src: string }) => { if (file.key.startsWith('title:')) noteMissing(file.src, file.key); });
  }
  create() {
    const W = DESIGN.width, H = DESIGN.height, cx = W / 2;
    // 첫 입력에서 소리 활성화(브라우저 정책) + 지도 BGM 요청(파일 없으면 무음, 요청 21)
    this.input.on('pointerdown', () => SOUND.unlock());
    SOUND.bgm('map');
    this.add.rectangle(0, 0, W, H, colorNum(COLORS.bg)).setOrigin(0);
    // 1. 배경: 키 일러스트. 없으면 bg색 바탕 + 화투패 뒷면을 크게 흐리게 깐 폴백 연출
    if (this.textures.exists(tKey(KEY_ART))) this.add.image(cx, H / 2, tKey(KEY_ART)).setDisplaySize(W, H);
    else if (this.textures.exists(tKey(CARD_BACK))) {
      const back = this.add.image(cx, H / 2 - 120, tKey(CARD_BACK)).setAlpha(0.16);
      back.setScale((H * 0.62) / back.height);
      try { back.postFX.addBlur(); } catch { /* Canvas 렌더러: postFX 없음 — 낮은 알파만으로 충분 */ }
    }
    // 위에서 아래로 검정 비네트: 상단 0.5 → 중앙 0 → 하단 0.6 (글자 가독성)
    const sh = colorNum(COLORS.shadow);
    const v = this.add.graphics();
    v.fillGradientStyle(sh, sh, sh, sh, 0.5, 0.5, 0, 0); v.fillRect(0, 0, W, H / 2);
    v.fillGradientStyle(sh, sh, sh, sh, 0, 0, 0.6, 0.6); v.fillRect(0, H / 2, W, H / 2);
    // 2. 꽃잎 레이어(로고 아래가 아니라 로고·버튼 '뒤'에 깔리도록 먼저 만든다)
    this.petalLayer = this.add.container();
    if (!new FxSettings().reduced) for (let i = 0; i < PETALS; i++) this.spawnPetal(true);
    // 3. 중앙 하단 로고: logo.png가 없으면 금색 제목 글자 + 부제 한 줄로 대체
    const LOGO_Y = 700;
    if (this.textures.exists(tKey(LOGO))) this.add.image(cx, LOGO_Y, tKey(LOGO)).setDisplaySize(560, 200);
    else {
      this.add.text(cx, LOGO_Y - 18, '타짜: 마지막 패', { ...TEXT_STYLES.h1, fontSize: 54 }).setOrigin(0.5);
      this.add.text(cx, LOGO_Y + 38, '손은 눈보다 빠르다 — 마지막 판', TEXT_STYLES.caption).setOrigin(0.5);
    }
    // 4. 버튼: 저장이 있으면 '이어하기'를 맨 위에(기본 선택), '처음부터'는 항상, '설정'은 빈 틀 모달
    const saved = hasSave();
    const entries: [string, () => void][] = [];
    if (saved) entries.push(['이어하기', () => this.scene.start(SCENE_KEYS.boot)]);
    entries.push(['처음부터', () => (saved ? this.confirmReset() : this.scene.start(SCENE_KEYS.boot))]);
    entries.push(['설정', () => this.openSettings()]);
    let y = 880;
    for (const [text, onTap] of entries) { makeButton(this, (W - BTN.w) / 2, y, BTN.w, BTN.h, text, onTap); y += BTN.h + BTN.gap; }
    // 5. 최하단 버전 표기(package.json version)
    this.add.text(cx, H - 28, `v${version}`, TEXT_STYLES.caption).setOrigin(0.5);
  }
  /** 로고 언저리에 떨어지는 작은 사각형 꽃잎 하나. 다 떨어지면 위에서 다시 태어난다(총수 일정). */
  private spawnPetal(scatter: boolean) {
    const cx = DESIGN.width / 2, zoneW = 620, topY = 460, bottomY = 960;
    const x = cx + (Math.random() - 0.5) * zoneW;
    const y = scatter ? topY + Math.random() * (bottomY - topY) : topY - 30 - Math.random() * 60;
    const size = 5 + Math.random() * 4;
    const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    const r = this.add.rectangle(x, y, size, size * (0.7 + Math.random() * 0.5), colorNum(color), 0.2 + Math.random() * 0.2).setAngle(Math.random() * 360);
    this.petalLayer.add(r);
    const seconds = (bottomY - y) / (36 + Math.random() * 24); // 초당 36~60px — 은은한 낙하
    this.tweens.add({
      targets: r, y: bottomY, x: x + (Math.random() - 0.5) * 100, angle: r.angle + 120 + Math.random() * 240, alpha: 0,
      duration: Math.max(800, seconds * 1000), ease: 'Sine.easeIn',
      onComplete: () => { r.destroy(); if (this.scene.isActive()) this.spawnPetal(false); },
    });
  }
  /** '처음부터'를 저장이 있는 채로 눌렀을 때: 덮어쓰기 확인 모달. */
  private confirmReset() {
    const m = makeModal(this, 480, 230, () => m.close());
    const P = m.panel, mx = P.x + P.w / 2;
    m.container.add(this.add.text(mx, P.y + 46, '처음부터', TEXT_STYLES.h2).setOrigin(0.5));
    m.container.add(this.add.text(mx, P.y + 100, '기존 기록을 지웁니다. 계속할까요?', TEXT_STYLES.body).setOrigin(0.5));
    const bw = 200, bh = 52, by = P.y + P.h - bh - 24;
    m.container.add(makeButton(this, mx - bw - 10, by, bw, bh, '지우고 시작', () => { m.close(); resetProgress(); this.scene.start(SCENE_KEYS.boot); }).container);
    m.container.add(makeButton(this, mx + 10, by, bw, bh, '취소', () => m.close()).container);
  }
  /** 설정 모달: 음량 슬라이더(요청 21 — 마스터 볼륨 0~1, 'hwatu.volume.v1' 저장) + 데이터 초기화 자리(비활성). */
  private openSettings() {
    const m = makeModal(this, 480, 340, () => m.close());
    const P = m.panel;
    m.container.add(this.add.text(P.x + P.w / 2, P.y + 44, '설정', TEXT_STYLES.h2).setOrigin(0.5));
    // 음량 슬라이더: 트랙을 누르거나 끌면 즉시 반영(SOUND.setVolume → master gain + 저장)
    m.container.add(this.add.text(P.x + 32, P.y + 100, '음량', TEXT_STYLES.body).setOrigin(0, 0.5));
    const g = this.add.graphics();
    const tx = P.x + 120, ty = P.y + 100, tw = P.w - 152;
    const drawSlider = () => {
      g.clear();
      g.fillStyle(colorNum(COLORS.panelBorder), 1).fillRoundedRect(tx, ty - 3, tw, 6, 3);
      g.fillStyle(colorNum(COLORS.goldDim), 1).fillRoundedRect(tx, ty - 3, Math.max(6, tw * SOUND.volume), 6, 3);
      g.fillStyle(colorNum(COLORS.gold), 1).fillCircle(tx + tw * SOUND.volume, ty, 10);
    };
    drawSlider();
    m.container.add(g);
    const pct = this.add.text(tx + tw, ty + 26, `${Math.round(SOUND.volume * 100)}%`, TEXT_STYLES.caption).setOrigin(1, 0.5);
    m.container.add(pct);
    const hit = this.add.rectangle(tx - 12, ty - 22, tw + 24, 44, 0x000000, 0.001).setOrigin(0).setInteractive();
    const setFrom = (p: Phaser.Input.Pointer) => {
      SOUND.unlock();
      SOUND.setVolume((p.worldX - tx) / tw);
      drawSlider();
      pct.setText(`${Math.round(SOUND.volume * 100)}%`);
    };
    hit.on('pointerdown', setFrom);
    hit.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) setFrom(p); });
    hit.on('pointerup', () => SOUND.sfx('tap')); // 손을 뗄 때 확인음
    m.container.add(hit);
    // 데이터 초기화 자리(비활성: makeButton disabled = textDim 글자·goldDim 테두리)
    const reset = makeButton(this, P.x + 32, P.y + 160, P.w - 64, 52, '데이터 초기화', () => { /* 다음 단계 */ });
    reset.setEnabled(false);
    m.container.add(reset.container);
    m.container.add(makeButton(this, P.x + 32, P.y + P.h - 76, P.w - 64, 52, '닫기', () => m.close()).container);
  }
}
