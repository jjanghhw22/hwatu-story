// 여정 지도 씬. 상단 day·소지금·압류 예고·가방, 가운데 장소 노드(그림 없이 원과 이름, 세로 지그재그), 아래 메뉴.
// 노드를 누르면 그 장소의 행동 메뉴(모달). 진행 상태는 src/story/progress.ts가 읽고 쓰고, 서린 사건은 src/story/serin.ts가 정한다.
import Phaser from 'phaser';
import { seededRng } from '../rng';
import { SCENARIOS } from '../scenarios';
import { CH5_RAMEN_SCENES, CH7_COURIER, CH7_VISITOR, CHAPTERS, type ChapterId, GIFT_SCENES, SERIN_LAST_ITEM, SERIN_ROUTE_ASK, SERIN_ROUTE_REPLY, TAEOH_STAKE_SCENES, type Chapter, NIGHT_CH6_SCENES, type Scene, chapterById, chapterLabel, isChapterImplemented } from '../story/chapters';
import { ERRANDS, type ErrandId, canChallengeBokhee, completeErrand, errandById, errandsDone, isErrandDone } from '../story/errands';
import { FLAGS, type ItemId, itemById, shopItems } from '../story/items';
import { MIN_STAKE_POINTS, PLACES, PLACE_IDS, type PlaceId, canSit, isPlaceReady } from '../story/places';
import { BONGGU_ENTRY_WINS, COUNTERS, MA_ENTRY_WINS, type Progress, SAFETY_NET, TAEOH_STAKED_FLAG, addMoney, canTaeohStake, completeChapter, addToBag, canChallengeBonggu, isDebtFrozen, isNightLocked, winsKey, SEIZURE_NOTICE, bagCount, buyItem, canChallengeMa, counter, currentChapter, equipGear, formatManWon, formatWon, formatWonDelta, isBanned, isChapterDone, loadProgress, resetProgress, rest, saveProgress, setFlag, unequipGear, useItemOnMap } from '../story/progress';
import { GEAR_SLOTS } from '../story/items';
import { CHARM_FLAG, GATES, type GateNo, type SerinRoute, canChallengeGate, ch10Pointer, gateFlag, routeStep, setRoute } from '../story/gates';
import { ENDING_TITLES, endingsSeen, progressAtChapter } from '../story/endings';
import { OPPONENTS } from '../story/opponents';
import { type CharacterId, CHARACTERS } from '../character';
import { loadFailed, noteMissing } from '../ui/missing';
import { type SerinEventId, applyEvent, serinEventById, tierName, visitSerin } from '../story/serin';
import { SKILLS } from '../story/skills';
import { CardFx, FxSettings } from '../ui/fx';
import { BUILD_TAG, CREDITS, NOT_IMPLEMENTED, RULES } from '../ui/infoTexts';
import { DESIGN, JOURNEY, MARGIN, journeyNodes } from '../ui/layout';
import { missingAssets } from '../ui/missing';
import { type ModalButton, type ModalLine, drawModal } from '../ui/modals';
import { SOUND } from '../ui/sound';
import { COLORS, FONT, type UI, box, button, label, panel } from '../ui/widgets';
import { makeButton } from '../ui/components';
import { circlePortraitTexture, preloadPortraits } from '../ui/portrait';
import { COLORS as TOKENS, TEXT_STYLES, colorNum } from '../ui/theme';
import { type JourneyLaunch, SCENE_KEYS, goJourney, playEnding, playStory, startChapterMatch, startErrandMatch, startLessonMatch, startNormalMatch, startPractice, startTable } from './flow';

type Modal = 'kingChoice' | 'finalChoice' | 'routeChoice' | 'jump' | 'jumpConfirm' | 'none' | 'place' | 'menu' | 'rules' | 'credits' | 'devinfo' | 'scenarios' | 'reward' | 'box' | 'shop' | 'bag' | 'notice' | 'choice' | 'noMoney' | 'gear' | 'errands' | 'errandChoice';
const coverKey = (path: string) => `cover:${path}`;
// ---- 지도 리뉴얼(요청 18) 그림 자리: 파일이 생기면 그대로 읽고, 없으면 theme 색 플레이스홀더로 그린다(의도된 폴백, 재요청 없음) ----
const jmapKey = (path: string) => `jmap:${path}`;
const chapterKeyPath = (no: number) => `assets/story/chapter_key_${no}.png`;
const MAP_BG = 'assets/ui/map_paper_bg.png';
const NOTE_ICON = 'assets/ui/icon_note.png';
const LOCK_ICON = 'assets/ui/icon_lock.png';
const ACTION_ICONS = { talk: 'assets/ui/icon_talk.png', match: 'assets/ui/icon_match.png', search: 'assets/ui/icon_search.png' } as const;
type NodeAction = keyof typeof ACTION_ICONS;
/** 행동 아이콘 그림이 없을 때 원 안에 쓰는 글자(대화·대결·조사). */
const ACTION_GLYPH: Record<NodeAction, string> = { talk: '말', match: '판', search: '조' };
const placeIconPath = (id: PlaceId) => `assets/ui/icon_place_${id}.png`;
/** 열린 노드 안 원형 초상: 그 장소의 대표 인물(기존 characters/*-neutral.png 재사용). 그림이 없으면 장소 아이콘 → 장소명 첫 글자. */
const PLACE_CHARACTER: Record<PlaceId, CharacterId> = { barber: 'barber', home: 'father', store: 'seorin', bath: 'ma', market: 'bokhee', harbor: 'bonggu', billiards: 'taeoh', hotel: 'mujin' };
const PREPARING = '다음 이야기는 아직 준비 중';
/** 이야기 연출 데모(요청 17, 개발 정보에서만): 컷 폴백·지문·대사(초상 유/무)·선택지를 한 번에 확인한다. 장 데이터·분기는 건드리지 않는다. */
const UI_DEMO_SCENES: Scene[] = [
  { kind: 'cut', image: 'assets/story/ch1-barber.png', text: '컷 패널 데모 — 그림 파일이 생기면 웹툰 패널로, 없으면 이 패널 폴백으로 나온다.' },
  { kind: 'cut', text: '지문 데모 — 행동 묘사는 초상 없이 화면 가운데에 흐린 기울임꼴로 나온다.' },
  { kind: 'line', speaker: 'seorin', text: '대사 데모. 글이 타자기처럼 나오는 중에 탭하면 전부 표시되고, 한 번 더 탭하면 다음으로 넘어가.' },
  { kind: 'line', speaker: 'courier', text: '초상 그림이 없는 화자는 이렇게 이름표만 나온다.' },
];

export class JourneyScene extends Phaser.Scene {
  progress!: Progress;
  layer!: Phaser.GameObjects.Container;
  sfx = SOUND; fxSettings = new FxSettings(); fx!: CardFx;
  modal: Modal = 'none'; selected?: PlaceId; launch: JourneyLaunch = {};
  /** 안내 창 내용(사건 결과·아이템 사용 등). */
  notice: { title: string; lines: string[] } = { title: '', lines: [] };
  /** 선택이 있는 서린 사건(교재비). */
  choiceEvent?: SerinEventId;
  /** 돈이 모자라 못 앉는 장소. */
  noMoneyPlace?: PlaceId;
  /** 밤 → 아침 전환 중 입력 잠금. */
  busy = false;
  /** 장 바로가기 대상(확인 창). */
  jumpTo?: ChapterId;
  /** 선택이 있는 심부름(가게 비운 사람 돕기). */
  errandChoice?: ErrandId;
  constructor() { super(SCENE_KEYS.journey); }
  init(data: JourneyLaunch = {}) {
    this.launch = data; this.selected = data.openPlace; this.busy = false; this.choiceEvent = data.serinChoice;
    this.errandChoice = data.errandChoice;
    this.modal = data.kingChoice ? 'kingChoice' : data.finalChoice ? 'finalChoice' : data.routeChoice ? 'routeChoice' : data.reward || data.chapterDone ? 'reward' : data.serinChoice ? 'choice' : data.errandChoice ? 'errandChoice' : data.notice ? 'notice' : data.openPlace ? 'place' : 'none';
    if (data.notice) this.notice = data.notice;
  }
  /** 현재 장 대표 컷(없으면 theme panel 색 폴백). 읽기 실패는 조용히 기록하고, 이미 실패한 키는 다시 요청하지 않는다(요청 15). */
  preload() {
    const c = currentChapter(loadProgress());
    if (c.cover) { const k = coverKey(c.cover); if (!this.textures.exists(k) && !loadFailed(k)) this.load.image(k, c.cover); }
    // 요청 18: 챕터 키 일러스트·종이 약도·아이콘. 없으면 theme 폴백으로 그리고, 실패한 키는 다시 요청하지 않는다
    const wants = [chapterKeyPath(c.no), MAP_BG, NOTE_ICON, LOCK_ICON, ...Object.values(ACTION_ICONS), ...PLACE_IDS.map(placeIconPath)];
    for (const path of wants) { const k = jmapKey(path); if (!this.textures.exists(k) && !loadFailed(k)) this.load.image(k, path); }
    preloadPortraits(this.load, PLACE_IDS.map(id => CHARACTERS[PLACE_CHARACTER[id]]));
    this.load.on('loaderror', (file: { key: string; src: string }) => { if (file.key.startsWith('cover:') || file.key.startsWith('jmap:')) noteMissing(file.src, file.key); });
  }
  create() {
    this.progress = loadProgress();
    this.fx = new CardFx(this, this.add.container(), this.fxSettings);
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.sfx.bgm('map'); // 지도 BGM(파일 없으면 무음, 요청 21)
    this.events.once('shutdown', () => this.fx.clear());
    // 개발 진단: 9를 누르면 활성 씬 전체의 텍스트·그림 객체(내용, 월드 좌표, depth)를 콘솔 표로 남긴다.
    // 화면에 설명되지 않는 글자가 보일 때 그 순간 눌러서 어느 씬·어느 객체인지 특정하는 용도(렌더링에는 영향 없음).
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key !== '9') return;
      const rows: { scene: string; kind: string; text: string; x: number; y: number; depth: number; alpha: number }[] = [];
      for (const sc of this.game.scene.getScenes(true)) {
        const walk = (objs: Phaser.GameObjects.GameObject[]) => {
          for (const o of objs) {
            if (o instanceof Phaser.GameObjects.Text) { const m = o.getWorldTransformMatrix(); rows.push({ scene: sc.scene.key, kind: 'text', text: o.text, x: Math.round(m.tx), y: Math.round(m.ty), depth: o.depth, alpha: o.alpha }); }
            else if (o instanceof Phaser.GameObjects.Image) { const m = o.getWorldTransformMatrix(); rows.push({ scene: sc.scene.key, kind: 'image', text: o.texture.key, x: Math.round(m.tx), y: Math.round(m.ty), depth: o.depth, alpha: o.alpha }); }
            if (o instanceof Phaser.GameObjects.Container) walk(o.list);
          }
        };
        walk(sc.children.list as Phaser.GameObjects.GameObject[]);
      }
      console.table(rows);
    });
    this.draw();
    if (this.launch.moneyDelta) this.pulseMoney(this.launch.moneyDelta);
    // 첫 방문 장면(편의점 2장·5장 컵라면, 항구 5장)을 먼저 재생한 뒤 돌아와 행동 메뉴를 연다
    if (this.modal === 'place' && this.selected) this.maybeFirstVisit(this.selected);
    // 6장 그날 밤: 비닐봉지 장면 뒤 바로 휴식 전환
    if (this.launch.doRest) this.runRest();
  }
  get ui(): UI { return { scene: this, layer: this.layer }; }
  get chapter(): Chapter { return currentChapter(this.progress); }
  /** 열린 장소 = 진행에서 해금됐고 그 장의 이야기가 구현된 곳. */
  isOpen(id: PlaceId) { return this.progress.unlockedPlaces.includes(id) && isPlaceReady(id); }
  /** 다음 목적지: 현재 장의 무대. 아직 잠겨 있으면(구현 전) 집. */
  get nextPlace(): PlaceId { const ch = this.chapter; const g = ch10Pointer(this.progress); if (g && this.isOpen(g)) return g; return isChapterImplemented(ch.id) && this.isOpen(ch.place) && !isChapterDone(this.progress, ch.id) ? ch.place : 'home'; }
  get nextIsPreparing() { if (endingsSeen(this.progress).length) return false; return !isChapterImplemented(this.chapter.id) || (this.nextPlace === 'home' && this.chapter.place !== 'home'); }
  save() { saveProgress(this.progress); }
  /** 소지금 변화 "+N원/−N원"을 머리 패널의 소지금 글자 옆에 띄운다. */
  pulseMoney(delta: number) { if (!delta) return; const H = JOURNEY.header; this.fx.scorePulse(undefined, DESIGN.width - MARGIN - 24, H.y + 46, delta, 1, formatWonDelta(delta)); }
  draw() {
    this.layer?.destroy(true); this.layer = this.add.container();
    this.children.bringToTop(this.fx.layer);
    const ui = this.ui, p = this.progress, ch = this.chapter;
    box(ui, 0, 0, DESIGN.width, DESIGN.height, COLORS.bg);
    // 0. 챕터 타이틀 박스(요청 18): 챕터 키 일러스트(chapter_key_{n} → 기존 cover → theme panel 폴백) + 하단 검정 그라데이션(알파 0→0.7) + 제목 h1
    const C = JOURNEY.cover;
    box(ui, 0, C.y, C.w, C.h, colorNum(TOKENS.panel));
    const kk = jmapKey(chapterKeyPath(ch.no)), ck = ch.cover ? coverKey(ch.cover) : undefined;
    const art = this.textures.exists(kk) ? kk : ck && this.textures.exists(ck) ? ck : undefined;
    if (art) {
      const img = this.add.image(C.w / 2, C.y + C.h / 2, art);
      img.setScale(Math.min(C.w / img.width, C.h / img.height)); this.layer.add(img);
    }
    const grad = this.add.graphics(), sh = colorNum(TOKENS.shadow);
    grad.fillGradientStyle(sh, sh, sh, sh, 0, 0, 0.7, 0.7);
    grad.fillRect(0, C.y + C.h - 120, C.w, 120);
    this.layer.add(grad);
    this.layer.add(this.add.text(MARGIN + 8, C.y + C.h - 14, chapterLabel(ch), { ...TEXT_STYLES.h1, wordWrap: { width: C.w - MARGIN * 2 - 16 } }).setOrigin(0, 1));
    // 1. 머리: day · 소지금 · 현재 장 · 압류 예고(작게, 붉은 글자) · 집중력·기술 · 가방 버튼
    const H = JOURNEY.header;
    panel(ui, MARGIN, H.y, DESIGN.width - MARGIN * 2, H.h, 'wood');
    label(ui, MARGIN + 24, H.y + 14, `DAY ${p.day}`, 24, COLORS.gold, 200, [0, 0], true);
    label(ui, DESIGN.width - MARGIN - 24, H.y + 14, formatWon(p.money), 24, COLORS.text, 300, [1, 0], true).setName('money');
    const ends = endingsSeen(p);
    label(ui, MARGIN + 24, H.y + 48, ends.length ? `엔딩 ${ends.join('·')} 달성` : chapterLabel(ch), 14, ends.length ? COLORS.gold : COLORS.muted, 400, [0, 0], ends.length > 0);
    // 6장 뒤: 돈으로는 해결이 안 된다 — 압류 예고 금액 대신 회색 "동결"
    if (isDebtFrozen(p)) label(ui, DESIGN.width - MARGIN - 24, H.y + 44, '압류 예고 · 동결', 13, COLORS.muted, 240, [1, 0], true);
    else label(ui, DESIGN.width - MARGIN - 24, H.y + 44, `압류 예고 ${formatManWon(SEIZURE_NOTICE)}`, 13, COLORS.bakWarn, 240, [1, 0], true);
    label(ui, MARGIN + 24, H.y + 72, `집중력 ${p.focus}/${p.focusMax}  ·  기술 ${p.skills.length ? p.skills.map(s => SKILLS[s].name).join(', ') : '없음'}`, 13, COLORS.goldDim, 420, [0, 0]);
    const bagN = Object.values(p.bag).reduce((s, n) => s + (n ?? 0), 0);
    // 요청 18: '가방 N' → 수첩 아이콘 + '기록 N건'(기능은 그대로 가방 창. 아이콘 그림이 없으면 theme 색 수첩 모양)
    const bx = DESIGN.width - MARGIN - 24 - 110, by = H.y + 64;
    const nk = jmapKey(NOTE_ICON);
    if (this.textures.exists(nk)) this.layer.add(this.add.image(bx - 22, by + 14, nk).setDisplaySize(32, 32));
    else {
      const note = this.add.graphics();
      note.fillStyle(colorNum(TOKENS.panel), 1).fillRoundedRect(bx - 33, by + 1, 22, 26, 3);
      note.lineStyle(1, colorNum(TOKENS.goldDim), 1).strokeRoundedRect(bx - 33, by + 1, 22, 26, 3);
      note.lineStyle(1, colorNum(TOKENS.textDim), 1);
      for (let i = 0; i < 3; i++) note.lineBetween(bx - 29, by + 8 + i * 6, bx - 15, by + 8 + i * 6);
      this.layer.add(note);
    }
    button(ui, bx, by, 110, `기록 ${bagN}건`, () => this.switchModal('none', 'bag'), this.modal === 'none' && !this.busy, 28, 14);
    // 2. 지도(요청 18): 종이 약도 배경(없으면 바탕색 그대로) + goldDim 점선 이음선 + 노드 3상태(현재 120·방문 96·잠김 96)
    const mapTop = H.y + H.h + 8, mapBottom = DESIGN.height - JOURNEY.bottom.h - JOURNEY.bottom.pad * 2;
    const mk = jmapKey(MAP_BG);
    if (this.textures.exists(mk)) {
      const im = this.add.image(DESIGN.width / 2, 0, mk);
      const sc = Math.min(DESIGN.width / im.width, (mapBottom - mapTop) / im.height);
      im.setScale(sc).setY(mapTop + (im.height * sc) / 2);
      this.layer.add(im);
    }
    const pos = journeyNodes(PLACE_IDS.length);
    const links = this.add.graphics();
    links.lineStyle(2, colorNum(TOKENS.goldDim), 0.7);
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1], b = pos[i], len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const dash = 8, gap = 7, n = Math.floor(len / (dash + gap));
      for (let k = 0; k < n; k++) {
        const t0 = (k * (dash + gap)) / len, t1 = (k * (dash + gap) + dash) / len;
        links.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      }
    }
    this.layer.add(links);
    const next = this.nextPlace;
    PLACE_IDS.forEach((id, i) => {
      const place = PLACES[id], { x, y } = pos[i];
      const open = this.isOpen(id), isNext = id === next && open, banned = isBanned(p, id);
      const r = isNext ? JOURNEY.node.rNext : JOURNEY.node.rSmall;
      this.layer.add(this.add.circle(x, y + 3, r + 2, colorNum(TOKENS.shadow), 0.45));
      const circle = this.add.circle(x, y, r, colorNum(open ? TOKENS.panel : TOKENS.bg))
        .setStrokeStyle(banned || isNext ? JOURNEY.node.ring : 2, colorNum(banned ? TOKENS.red : isNext ? TOKENS.gold : TOKENS.panelBorder));
      this.layer.add(circle);
      if (open) this.drawNodeFace(id, x, y, r);
      // 방문함 70%·잠김 35% 밝기: 어둡기 막을 올린다
      if (!isNext) this.layer.add(this.add.circle(x, y, r, colorNum(TOKENS.shadow), open ? 0.3 : 0.65));
      if (!open) this.drawLockIcon(x, y);
      this.layer.add(this.add.text(x, y + r + 6, open ? place.name : '???', { ...TEXT_STYLES.caption, fontSize: 14, color: isNext ? TOKENS.text : TOKENS.textDim, fontStyle: isNext ? 'bold' : 'normal' }).setOrigin(0.5, 0).setName(`place:${id}`));
      if (isNext) {
        this.layer.add(this.add.text(x - r - 12, y, '▶', { ...TEXT_STYLES.h2, fontSize: 22, color: TOKENS.gold }).setOrigin(1, 0.5));
        this.drawNodeActions(id, x, y + r + 28);
        if (id === 'store' && ch10Pointer(p) === 'store') this.layer.add(this.add.text(x, y + r + 76, '서린이 잠깐 들르래.', { ...TEXT_STYLES.caption, fontSize: 12, color: TOKENS.gold }).setOrigin(0.5, 0));
      }
      circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openPlace(id));
    });
    // 3. 아래 메뉴 — 새 디자인 토큰 검증용으로 이 버튼만 components.makeButton(theme.ts)으로 그린다(요청 13)
    const B = JOURNEY.bottom;
    const menu = makeButton(this, MARGIN, DESIGN.height - B.pad - B.h, DESIGN.width - MARGIN * 2, B.h, '메뉴', () => this.switchModal('none', 'menu'));
    menu.setEnabled(this.modal === 'none' && !this.busy);
    this.layer.add(menu.container);
    this.drawModals();
  }
  /** 현재 진행에서 그 장소가 제공하는 행동(대화·대결·조사). 행동 메뉴의 버튼 구성과 같은 기준의 요약. */
  nodeActions(id: PlaceId): NodeAction[] {
    const p = this.progress, out: NodeAction[] = [];
    if (id === 'barber' || id === 'store') out.push('talk');
    const match = id === 'home' ? !isNightLocked(p) : id === 'billiards' ? p.chapterId === 'ch8' : true;
    if (match) out.push('match');
    if (id === 'home' || (id === 'market' && (p.chapterId === 'ch4' || errandsDone(p) > 0))) out.push('search');
    return out;
  }
  /** 현재 노드 아래 행동 아이콘 줄(40×40). 그림이 없으면 theme 색 원 + 글자. */
  drawNodeActions(id: PlaceId, cx: number, topY: number) {
    const acts = this.nodeActions(id), size = 40, gap = 10;
    const total = acts.length * size + (acts.length - 1) * gap;
    acts.forEach((a, i) => {
      const x = cx - total / 2 + size / 2 + i * (size + gap), y = topY + size / 2;
      const ik = jmapKey(ACTION_ICONS[a]);
      if (this.textures.exists(ik)) { this.layer.add(this.add.image(x, y, ik).setDisplaySize(size, size)); return; }
      this.layer.add(this.add.circle(x, y, size / 2 - 2, colorNum(TOKENS.panel)).setStrokeStyle(1, colorNum(TOKENS.goldDim)));
      this.layer.add(this.add.text(x, y, ACTION_GLYPH[a], { ...TEXT_STYLES.caption, fontSize: 14, color: TOKENS.text }).setOrigin(0.5));
    });
  }
  /** 노드 안 그림: 대표 인물 원형 초상 → 장소 아이콘 → 장소명 첫 글자(자리 표시). */
  drawNodeFace(id: PlaceId, x: number, y: number, r: number) {
    const inner = r - 5;
    const key = circlePortraitTexture(this, CHARACTERS[PLACE_CHARACTER[id]], 'normal', inner);
    if (key) { this.layer.add(this.add.image(x, y, key).setDisplaySize(inner * 2, inner * 2)); return; }
    const ik = jmapKey(placeIconPath(id));
    if (this.textures.exists(ik)) { this.layer.add(this.add.image(x, y, ik).setDisplaySize(Math.round(inner * 1.2), Math.round(inner * 1.2))); return; }
    this.layer.add(this.add.text(x, y, PLACES[id].name.slice(0, 1), { ...TEXT_STYLES.h2, fontSize: Math.round(r * 0.7), color: TOKENS.textDim }).setOrigin(0.5));
  }
  /** 잠김 노드의 자물쇠(40×40). 그림이 없으면 theme 색으로 고리 + 몸통을 그린다. */
  drawLockIcon(x: number, y: number) {
    const lk = jmapKey(LOCK_ICON);
    if (this.textures.exists(lk)) { this.layer.add(this.add.image(x, y, lk).setDisplaySize(40, 40)); return; }
    const g = this.add.graphics();
    g.lineStyle(3, colorNum(TOKENS.textDim), 1);
    g.beginPath(); g.arc(x, y - 6, 8, Math.PI, Math.PI * 2); g.strokePath();
    g.fillStyle(colorNum(TOKENS.textDim), 1).fillRoundedRect(x - 11, y - 6, 22, 16, 3);
    this.layer.add(g);
  }
  openPlace(id: PlaceId) {
    if (this.modal !== 'none' || this.busy) return;
    this.selected = id; this.modal = 'place';
    if (this.isOpen(id) && this.maybeFirstVisit(id)) return;
    this.draw();
  }
  /** 편의점 첫 방문이면 2장 before 장면을 재생하고(캔커피 해금 플래그), 끝나면 편의점 메뉴로 돌아온다. 재생을 시작했으면 true. */
  /**
   * 첫 방문 장면: 편의점(2장 before, 캔커피 해금), 5장 진행 중 편의점(컵라면 셋, 1회), 5장 진행 중 항구(5장 before: 태오 등장). 재생을 시작했으면 true.
   * 장면이 끝나면 그 장소 메뉴로 돌아온다.
   */
  maybeFirstVisit(id: PlaceId): boolean {
    const p = this.progress;
    const play = (flag: string, label: string, scenes: Parameters<typeof playStory>[2], extra: string[] = []) => {
      let q = setFlag(this.progress, flag); for (const f of extra) q = setFlag(q, f);
      this.progress = q; this.save();
      playStory(this, label, scenes, s => goJourney(s, { openPlace: id }));
      return true;
    };
    if (id === 'store' && !p.flags['ch2.visited']) { const c2 = chapterById('ch2'); return play('ch2.visited', chapterLabel(c2), c2.scenes.before, [FLAGS.ch2Talked]); }
    if (id === 'store' && p.chapterId === 'ch5' && !p.flags['ch5.ramen']) return play('ch5.ramen', chapterLabel(chapterById('ch5')), CH5_RAMEN_SCENES);
    if (id === 'harbor' && p.chapterId === 'ch5' && !p.flags['ch5.visited']) { const c5 = chapterById('ch5'); return play('ch5.visited', chapterLabel(c5), c5.scenes.before); }
    // 7장 시작(6장 다음 날 편의점 첫 방문): 서린 사건 '수상한 방문객' → 7장 before(빚 서류·백운레저) → 박 기사 소개
    if (id === 'store' && p.chapterId === 'ch7' && !p.flags['ch7.visited']) {
      const c7 = chapterById('ch7');
      this.progress = { ...p, serin: { ...p.serin, seen: p.serin.seen.includes('visitor') ? p.serin.seen : [...p.serin.seen, 'visitor'] } };
      return play('ch7.visited', chapterLabel(c7), [...CH7_VISITOR, ...c7.scenes.before, ...CH7_COURIER]);
    }
    // 10장 시작(9장 다음 날 호텔): 대식의 담보 제안 장면
    if (id === 'hotel' && p.chapterId === 'ch10' && !p.flags['ch10.visited']) { const c10 = chapterById('ch10'); return play('ch10.visited', chapterLabel(c10), c10.scenes.before); }
    // 10장 중 편의점 첫 방문: 서린의 마지막 상품(서린의 부적)
    if (id === 'store' && p.chapterId === 'ch10' && !p.flags['ch10.charm']) {
      this.progress = addToBag(this.progress, 'serinCharm'); return play('ch10.charm', chapterLabel(chapterById('ch10')), SERIN_LAST_ITEM);
    }
    // 10장 중 편의점 두 번째 방문: 관계 분기(호감 8 이상이면 선택, 아니면 조용히 friend)
    const rs = routeStep(p);
    if (id === 'store' && rs === 'default') { this.progress = setRoute(p, 'friend'); this.save(); }
    if (id === 'store' && rs === 'ask') {
      playStory(this, '편의점', SERIN_ROUTE_ASK, s => goJourney(s, { routeChoice: true }));
      return true;
    }
    // 9장 완료 뒤 첫 편의점 방문: 서린 사건 '오래된 선물'(낡은 회중시계)
    if (id === 'store' && isChapterDone(p, 'ch9') && !p.flags[FLAGS.serinWatch] && !p.flags['gift.played']) {
      this.progress = setFlag(p, 'gift.played'); this.save();
      playStory(this, '편의점 · 오래된 선물', GIFT_SCENES, s => {
        const a = applyEvent(loadProgress(), 'gift'); saveProgress(a.progress);
        goJourney(s, { notice: { title: '오래된 선물', lines: a.notice } });
      });
      return true;
    }
    return false;
  }
  switchModal(from: Modal, to: Modal) { if (this.modal !== from) return; this.modal = to; this.draw(); }
  showNotice(title: string, lines: string[], from: Modal = this.modal) { if (this.modal !== from) return; this.notice = { title, lines }; this.modal = 'notice'; this.draw(); }
  drawModals() {
    const ui = this.ui, p = this.progress;
    const close = (from: Modal, to: Modal = 'none'): ModalButton => ({ text: '닫기', onTap: () => this.switchModal(from, to) });
    if (this.modal === 'place' && this.selected) {
      const id = this.selected, place = PLACES[id];
      if (!this.isOpen(id)) {
        // 요청 18: 잠긴 곳은 지도와 똑같이 이름·열리는 장을 숨긴다
        drawModal(ui, { title: '??? · 잠김', alpha: 0.85, lines: [{ text: '아직 갈 수 없는 곳이다. 이야기가 진행되면 열린다.', size: 16, color: COLORS.text }], buttons: [close('place')] });
        return;
      }
      if (isBanned(p, id)) {
        drawModal(ui, { title: `${place.name} · 출입 금지`, alpha: 0.85, lines: [{ text: '오늘은 못 들어간다. 들통난 날은 하루 쉬어야 한다(집에서 쉬면 다음 날).', size: 16, color: COLORS.text }], buttons: [close('place')] });
        return;
      }
      const lines: ModalLine[] = [];
      const buttons: ModalButton[] = [];
      if (id === 'home' && this.nextIsPreparing) lines.push({ text: PREPARING, size: 16, color: COLORS.gold, bold: true });
      lines.push({ text: place.actions, size: 14 });
      if (id === 'barber') {
        const ch1 = chapterById('ch1'), done = isChapterDone(p, 'ch1'), current = p.chapterId === 'ch1';
        buttons.push({ text: '대화(이야기 재생)', onTap: () => {
          if (current) startChapterMatch(this, ch1);
          else playStory(this, chapterLabel(ch1), [...ch1.scenes.before, ...ch1.scenes.after], s => goJourney(s));
        } });
        buttons.push({ text: done ? '대결(1장) · 완료' : '대결(1장)', onTap: () => startChapterMatch(this, ch1, true), enabled: current });
        buttons.push({ text: '연습 대결(무료)', onTap: () => startPractice(this, 'barber') });
      } else if (id === 'home') {
        if (p.flags['home.newFurniture'] && !p.flags['home.furnitureSeen']) { lines.unshift({ text: '새 가구가 들어왔다. 돈이 생겼다.', size: 16, color: COLORS.gold }); this.progress = setFlag(p, 'home.furnitureSeen'); this.save(); }
        buttons.push({ text: '휴식 (집중력 회복 · 다음 날)', onTap: () => this.restAtHome() });
        // 6장 그날 밤: 연습 대결은 잠긴다(휴식하면 풀림)
        const night = isNightLocked(p);
        buttons.push({ text: night ? '연습 대결 · 오늘은 손이 안 간다' : '연습 대결', onTap: () => startPractice(this, 'barber'), enabled: !night });
        buttons.push({ text: `기술·장비 (장비 ${p.gear.length}/${GEAR_SLOTS})`, onTap: () => this.switchModal('place', 'gear') });
        buttons.push({ text: '아버지 물건 조사', onTap: () => this.switchModal('place', 'box') });
      } else if (id === 'store') {
        const ch2 = chapterById('ch2'), current = p.chapterId === 'ch2';
        lines.push({ text: `하루 첫 방문 호감 +1 — ${p.serin.lastVisitDay >= p.day ? '오늘 들름 ✓' : '오늘 아직'}`, size: 12, color: COLORS.muted });
        lines.push({ text: `서린 호감 ${p.serin.affinity}  ·  방문 ${p.serin.visits}회`, size: 13, color: COLORS.goldDim });
        buttons.push({ text: '서린과 대화', onTap: () => this.talkSerin() });
        buttons.push({ text: '상점', onTap: () => this.switchModal('place', 'shop') });
        buttons.push({ text: current ? '밤차와 한 판 (2장 · 판돈 0)' : '밤차와 한 판 (연습 · 판돈 0)', onTap: () => { if (current) startChapterMatch(this, ch2, true); else startPractice(this, 'bamcha'); } });
        if (p.chapterId === 'ch7') {
          const learned = p.skills.includes('readThrough');
          if (!learned) buttons.push({ text: '박 기사와 한 판 (간파 배우기)', onTap: () => startLessonMatch(this, 'courier', 'readThrough') });
          buttons.push({ text: '뒷문 — 뱀눈 (7장)', onTap: () => startChapterMatch(this, chapterById('ch7'), true), enabled: learned });
        }
      } else if (id === 'bath') {
        const wins = counter(p, COUNTERS.bathWins), ch3 = chapterById('ch3'), done = isChapterDone(p, 'ch3');
        lines.push({ text: `일반 대결 ${wins}승 (마 사장 입장: ${MA_ENTRY_WINS}승)  ·  판돈 1점 ${formatWon(place.stakePerPoint)}`, size: 13, color: COLORS.goldDim });
        buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
        buttons.push({ text: done ? '마 사장과 대결(3장) · 완료' : '마 사장과 대결(3장)', onTap: () => startChapterMatch(this, ch3), enabled: canChallengeMa(p) });
      } else if (id === 'market') {
        const ch4 = chapterById('ch4'), done = isChapterDone(p, 'ch4'), n = errandsDone(p);
        lines.push({ text: `심부름 ${n}/${ERRANDS.length} (복희 입장: 셋 다)  ·  판돈 1점 ${formatWon(place.stakePerPoint)}`, size: 13, color: COLORS.goldDim });
        buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
        buttons.push({ text: `심부름 ${n}/${ERRANDS.length}`, onTap: () => this.switchModal('place', 'errands'), enabled: p.chapterId === 'ch4' || n > 0 });
        buttons.push({ text: done ? '오복희와 대결(4장) · 완료' : '오복희와 대결(4장)', onTap: () => startChapterMatch(this, ch4), enabled: canChallengeBokhee(p) });
      } else if (id === 'harbor') {
        const ch5 = chapterById('ch5'), ch6 = chapterById('ch6'), wins = counter(p, winsKey('harbor'));
        lines.push({ text: `일반 대결 ${wins}승 (봉구 입장: ${BONGGU_ENTRY_WINS}승)  ·  판돈 1점 ${formatWon(place.stakePerPoint)}`, size: 13, color: COLORS.goldDim });
        buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
        buttons.push({ text: isChapterDone(p, 'ch5') ? '강봉구와 대결(5장) · 완료' : '강봉구와 대결(5장)', onTap: () => startChapterMatch(this, ch5, true), enabled: canChallengeBonggu(p) });
        if (p.chapterId === 'ch6' || isChapterDone(p, 'ch6')) buttons.push({ text: isChapterDone(p, 'ch6') ? '큰 판(6장) · 끝남' : '큰 판(6장) · 두 판 연속', onTap: () => startChapterMatch(this, ch6), enabled: p.chapterId === 'ch6' });
      } else if (id === 'billiards') {
        const ch8 = chapterById('ch8'), done = isChapterDone(p, 'ch8');
        buttons.push({ text: done ? '태오와 대결(8장) · 끝남' : '태오와 대결(8장) · 출입증과 정산 자료', onTap: () => startChapterMatch(this, ch8), enabled: p.chapterId === 'ch8' });
      } else if (id === 'hotel') {
        const ch9 = chapterById('ch9'), done = isChapterDone(p, 'ch9');
        if (!done) buttons.push({ text: '흰 방의 아버지(9장)', onTap: () => startChapterMatch(this, ch9), enabled: p.chapterId === 'ch9' });
        // 10장 초대전: 민정호 → 차유라 → 구상만 순서대로 열린다(판 사이에 나가서 쉬어도 된다). 장 대결·판돈 0·미션 있음
        if (p.chapterId === 'ch10' && p.flags[CHARM_FLAG] !== true) lines.push({ text: '초대전은 서린을 만난 뒤에 열린다. (지도의 ▶ 편의점)', size: 13, color: COLORS.goldDim });
        if (p.chapterId === 'ch10') ([1, 2, 3] as GateNo[]).forEach(n => {
          const won = p.flags[gateFlag(n)] === true, name = CHARACTERS[OPPONENTS[GATES[n - 1]].characterId];
          buttons.push({ text: `${won ? '✓ ' : ''}초대전 ${n} — ${name.name} ‘${name.nickname ?? ''}’`, onTap: () => startTable(this, { chapterId: 'ch10', opponentId: GATES[n - 1], practice: false, stake: 0, placeId: 'hotel', gate: n }), enabled: canChallengeGate(p, n) });
        });
        if (p.chapterId === 'ch11') buttons.push({ text: '왕의 식탁 — 백무진(11장)', onTap: () => startChapterMatch(this, chapterById('ch11')) });
        // 엔딩 뒤: 본 엔딩 다시 보기
        for (const e of endingsSeen(p)) buttons.push({ text: `다시 보기 · ${ENDING_TITLES[e]}`, onTap: () => playEnding(this, e) });
        if (place.stakePerPoint > 0) buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
      } else {
        if (place.stakePerPoint > 0) buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
      }
      buttons.push(close('place'));
      const title = id === 'home' && p.flags['home.newFurniture'] ? `${place.name} · 새 가구` : place.name;
      drawModal(ui, { title, alpha: 0.85, lines, buttons });
    }
    if (this.modal === 'kingChoice') {
      drawModal(ui, { title: '왕의 제안', titleColor: COLORS.gold, alpha: 0.9, lines: [{ text: '“네가 이기는 모습만 보여주면 돼.” 자리를 받아들일까, 마지막 판을 요구할까.', size: 18, color: COLORS.text }], buttons: [
        { text: '자리를 받아들인다', onTap: () => { if (this.modal !== 'kingChoice') return; playEnding(this, 'C'); } },
        { text: '마지막 판을 요구한다', onTap: () => this.demandFinal(), fill: 0xe0875a },
      ] });
    }
    if (this.modal === 'finalChoice') {
      // 기존 고/스톱 창 디자인: 고 주황, 스톱 금색
      drawModal(ui, { title: '마지막 선택', alpha: 0.9, lines: [{ text: '“이번엔 네가 원하는 거 전부.”', size: 20, color: COLORS.gold }, { text: '고를 외치면 더 어려운 추가 승부(백무진 4단계). 스톱하면 여기서 끝낸다.', size: 18, color: COLORS.text }], buttons: [
        { text: '고 · 추가 승부', onTap: () => { if (this.modal !== 'finalChoice') return; startTable(this, { chapterId: 'ch11', opponentId: 'mujin', practice: false, stake: 0, placeId: 'hotel', kingFinal: true }); }, fill: 0xe0875a },
        { text: '스톱', onTap: () => { if (this.modal !== 'finalChoice') return; playEnding(this, 'A'); } },
      ] });
    }
    if (this.modal === 'routeChoice') {
      const pick = (r: SerinRoute) => () => { if (this.modal !== 'routeChoice') return; this.progress = setRoute(this.progress, r); this.save(); this.notice = { title: '윤서린', lines: [`“${SERIN_ROUTE_REPLY[r]}”`] }; this.modal = 'notice'; this.draw(); };
      drawModal(ui, { title: '서린', alpha: 0.9, lines: [{ text: '“너 내가 왜 도와주는지 알았잖아.”', size: 18, color: COLORS.gold }], buttons: [
        { text: '친구로 남자', onTap: pick('friend') }, { text: '천천히 가 보자', onTap: pick('slow') }, { text: '잠깐 거리를 두자', onTap: pick('distance') },
      ] });
    }
    if (this.modal === 'jump') {
      const ids = CHAPTERS.filter(c => c.id !== 'prologue' && c.id !== 'epilogue').map(c => c.id);
      drawModal(ui, { title: '장 바로가기(개발용)', alpha: 0.92, lines: [{ text: '그 장 시작 상태로 진행을 덮어씁니다(앞 장 완료·보상 반영).', size: 14 }], buttons: [
        ...ids.map(id => ({ text: chapterLabel(chapterById(id)), onTap: () => { if (this.modal !== 'jump') return; this.jumpTo = id; this.modal = 'jumpConfirm'; this.draw(); } })),
        close('jump', 'devinfo'),
      ] });
    }
    if (this.modal === 'jumpConfirm' && this.jumpTo) {
      const id = this.jumpTo;
      drawModal(ui, { title: '진행을 덮어쓸까요?', alpha: 0.92, lines: [{ text: `지금 진행이 사라지고 ${chapterLabel(chapterById(id))} 시작 상태가 됩니다.`, size: 16, color: COLORS.text }], buttons: [
        { text: '덮어쓴다', onTap: () => { if (this.modal !== 'jumpConfirm') return; saveProgress(progressAtChapter(id)); this.scene.start(SCENE_KEYS.boot); }, fill: 0xe0875a },
        close('jumpConfirm', 'jump'),
      ] });
    }
    if (this.modal === 'errands') {
      // 4장 심부름 셋: 물건 찾기(상인과 한 판), 가게 비운 사람 돕기(선택), 연락 끊긴 상인(단서). 끝낸 것은 비활성
      const buttons: ModalButton[] = ERRANDS.map(e => ({ text: `${isErrandDone(p, e.id) ? '✓ ' : ''}${e.title}${e.kind === 'match' ? ' (한 판)' : e.kind === 'choice' ? ' (선택)' : ' (단서)'}`, enabled: !isErrandDone(p, e.id) && p.chapterId === 'ch4', onTap: () => this.startErrand(e.id) }));
      drawModal(ui, { title: `심부름 ${errandsDone(p)}/${ERRANDS.length}`, alpha: 0.88, lines: [{ text: '복희가 사진 얘기를 하기 전에 시킨 일들. 셋을 끝내면 복희와 한 판.', size: 15, color: COLORS.text }], buttons: [...buttons, close('errands', 'place')] });
    }
    if (this.modal === 'errandChoice' && this.errandChoice) {
      const e = errandById(this.errandChoice), c = e.choice!;
      drawModal(ui, { title: e.title, alpha: 0.88, lines: [{ text: '옆 가게 주인이 급히 자리를 비워야 한다.', size: 16, color: COLORS.text }], buttons: [
        { text: `${c.accept} (하루 지남 · ${formatWonDelta(c.money)})`, onTap: () => this.resolveErrandChoice(true) },
        { text: c.decline, onTap: () => this.resolveErrandChoice(false) },
      ] });
    }
    if (this.modal === 'noMoney' && this.noMoneyPlace) {
      const place = PLACES[this.noMoneyPlace];
      drawModal(ui, { title: '판에 앉을 돈이 없다', alpha: 0.85, lines: [
        { text: `${place.name}은 1점 ${formatWon(place.stakePerPoint)} 판이라 최소 ${formatWon(place.stakePerPoint * MIN_STAKE_POINTS)}이 있어야 앉을 수 있다. 지금 ${formatWon(p.money)}.`, size: 16, color: COLORS.text },
        { text: `소지금 ${formatWon(SAFETY_NET.belowMoney)} 미만일 때 집에서 쉬면, 다음 편의점 방문에서 서린이 야간 근무 식사(+${formatWon(SAFETY_NET.mealMoney)})를 챙겨 준다.`, size: 14 },
      ], buttons: [close('noMoney')] });
    }
    if (this.modal === 'box') {
      const ch1 = chapterById('ch1'), first = ch1.scenes.after[0];
      const text = isChapterDone(p, 'ch1') && first.kind === 'cut' ? first.text : '아직 조사할 물건이 없다.';
      drawModal(ui, { title: '아버지 물건', alpha: 0.85, lines: [{ text, size: 17, color: COLORS.text }], buttons: [close('box')] });
    }
    if (this.modal === 'shop') {
      const items = shopItems(p.flags);
      const buttons: ModalButton[] = items.map(it => ({ text: `${it.name} · ${formatWon(it.price ?? 0)} · 보유 ${bagCount(p, it.id)}`, enabled: p.money >= (it.price ?? 0), onTap: () => this.buy(it.id) }));
      drawModal(ui, { title: '편의점 상점', alpha: 0.85, lines: [{ text: `소지금 ${formatWon(p.money)}`, size: 16, color: COLORS.gold, bold: true }, { text: items.map(it => `${it.name}: ${it.effect}`).join('\n'), size: 13 }], buttons: [...buttons, close('shop', 'place')] });
    }
    if (this.modal === 'gear') {
      // 집에서만: 배운 기술 목록(설명·비용) + 장비 2칸(가방의 장비를 장착/해제). 대결 중에는 바꿀 수 없다(이 창은 지도에서만 열린다)
      const skillText = p.skills.length ? p.skills.map(s => `${SKILLS[s].name}(${SKILLS[s].cost}, 판당 ${SKILLS[s].usesPerMatch}회): ${SKILLS[s].desc}`).join('\n') : '배운 기술 없음';
      const lines: ModalLine[] = [
        { text: skillText, size: 13 },
        { text: `장비 ${p.gear.length}/${GEAR_SLOTS}칸: ${p.gear.length ? p.gear.map(g => itemById(g).name).join(', ') : '없음'}`, size: 15, color: COLORS.gold, bold: true },
      ];
      const buttons: ModalButton[] = [];
      for (const g of p.gear) buttons.push({ text: `해제 · ${itemById(g).name}`, onTap: () => this.toggleGear(g) });
      for (const id of (Object.keys(p.bag) as ItemId[]).filter(x => bagCount(p, x) > 0 && itemById(x).kind === 'gear'))
        buttons.push({ text: `장착 · ${itemById(id).name} — ${itemById(id).effect}`, enabled: p.gear.length < GEAR_SLOTS, onTap: () => this.toggleGear(id) });
      drawModal(ui, { title: '기술·장비', alpha: 0.88, lines, buttons: [...buttons, close('gear', 'place')] });
    }
    if (this.modal === 'bag') {
      const owned = (Object.keys(p.bag) as ItemId[]).filter(id => bagCount(p, id) > 0);
      const buttons: ModalButton[] = owned.map(id => { const it = itemById(id); return { text: `${it.name} ×${bagCount(p, id)}${it.use === 'match' ? ' (대결 중 사용)' : it.use === 'gear' ? ' (집에서 장착)' : it.use === 'map' ? ' · 사용' : ''}`, enabled: it.use === 'map', onTap: () => this.useItem(id) }; });
      drawModal(ui, { title: '가방', alpha: 0.85, lines: [{ text: owned.length ? `집중력 ${p.focus}/${p.focusMax}` : '가방이 비었다.', size: 15, color: COLORS.text }], buttons: [...buttons, close('bag')] });
    }
    if (this.modal === 'notice') drawModal(ui, { title: this.notice.title, alpha: 0.85, lines: this.notice.lines.map(text => ({ text, size: 16, color: COLORS.text })), buttons: [close('notice')] });
    if (this.modal === 'choice' && this.choiceEvent) {
      const ev = serinEventById(this.choiceEvent), ch = ev.choice!;
      drawModal(ui, { title: ev.title, alpha: 0.85, lines: [{ text: `“${ev.quote}”`, size: 17, color: COLORS.gold }, { text: `소지금 ${formatWon(p.money)}`, size: 14 }], buttons: [
        { text: ch.cost > 0 ? `${ch.accept} (${formatWonDelta(-ch.cost)})` : ch.accept, enabled: p.money >= ch.cost, onTap: () => this.resolveChoice('accept') },
        { text: ch.decline, onTap: () => this.resolveChoice('decline') },
      ] });
    }
    if (this.modal === 'reward') {
      const ch = this.launch.chapterDone ? chapterById(this.launch.chapterDone) : undefined;
      const sk = this.launch.reward ? SKILLS[this.launch.reward] : undefined;
      const lines: ModalLine[] = [];
      if (sk) lines.push({ text: `${sk.desc}. 집중력 ${sk.cost}, 판당 ${sk.usesPerMatch}회.`, size: 16, color: COLORS.text });
      if (this.launch.unlocked?.length) lines.push({ text: `새로 열린 곳: ${this.launch.unlocked.map(u => PLACES[u].name).join(', ')}`, size: 15, color: COLORS.gold });
      if (ch) lines.push({ text: `${chapterLabel(ch)} 완료.`, size: 13 });
      drawModal(ui, { title: sk ? `${sk.name}를 배웠다` : ch ? `${ch.title} 완료` : '진행', alpha: 0.85, lines, buttons: [{ text: '확인', onTap: () => this.closeReward() }] });
    }
    if (this.modal === 'menu') {
      const on = this.sfx.enabled, reduced = this.fxSettings.reduced;
      drawModal(ui, { title: '메뉴', lines: [{ text: `소리: ${on ? '켜짐' : '꺼짐'}  ·  연출 줄이기: ${reduced ? '켜짐' : '꺼짐'}` }], buttons: [
        { text: on ? '소리 끄기' : '소리 켜기', onTap: () => { if (this.modal !== 'menu') return; this.sfx.setEnabled(!on); if (!on) this.sfx.play('deal'); this.draw(); } },
        { text: reduced ? '연출 줄이기 끄기' : '연출 줄이기 켜기', onTap: () => { if (this.modal !== 'menu') return; this.fxSettings.setReduced(!reduced); this.draw(); } },
        { text: '규칙 안내', onTap: () => this.switchModal('menu', 'rules') },
        { text: '제작자·출처', onTap: () => this.switchModal('menu', 'credits') },
        { text: '개발 정보', onTap: () => this.switchModal('menu', 'devinfo') },
        close('menu'),
      ] });
    }
    if (this.modal === 'rules') drawModal(ui, { title: '규칙 안내', alpha: 0.92, lines: RULES, buttons: [close('rules', 'menu')] });
    if (this.modal === 'credits') drawModal(ui, { title: '제작자·출처', alpha: 0.92, lines: CREDITS, buttons: [close('credits', 'menu')] });
    if (this.modal === 'devinfo') {
      const missing = missingAssets();
      drawModal(ui, { title: '개발 정보', alpha: 0.92, lines: [
        { text: `빌드 ${BUILD_TAG}  ·  진행 ${p.chapterId} (day ${p.day})  ·  열린 곳 ${p.unlockedPlaces.length}/${PLACE_IDS.length}  ·  장 ${CHAPTERS.length}개  ·  서린 호감 ${p.serin.affinity} pity ${p.serin.pity}`, size: 14, color: COLORS.text },
        { text: `미구현: ${NOT_IMPLEMENTED}. 4장 이후 이야기·기술(눈썰미·태연한 얼굴 외)·장비·의심도는 데이터만.`, size: 13 },
        { text: missing.length ? `읽지 못한 그림(글자 컷·자리 표시로 대신): ${missing.join(', ')}` : '읽지 못한 그림 없음(아직 읽기를 시도하지 않은 파일은 표시되지 않음).', size: 12 },
        { text: '진행 초기화는 저장(hwatu.progress.v1)을 지우고 프롤로그부터 다시 시작합니다.', size: 13 },
      ], buttons: [
        { text: '진행 초기화', onTap: () => { if (this.modal !== 'devinfo') return; resetProgress(); this.scene.start(SCENE_KEYS.boot); } },
        { text: '장 바로가기', onTap: () => this.switchModal('devinfo', 'jump') },
        { text: '시나리오', onTap: () => this.switchModal('devinfo', 'scenarios') },
        { text: '이야기 연출 데모', onTap: () => {
          if (this.modal !== 'devinfo') return;
          const back = (picked: string) => (s: Phaser.Scene) => goJourney(s, { notice: { title: '이야기 연출 데모', lines: [picked] } });
          playStory(this, '연출 데모', UI_DEMO_SCENES, back('끝까지 봤다.'), { prompt: '선택지 데모 — 어느 쪽으로?', options: [
            { text: '정면으로 간다', pick: back('‘정면으로 간다’를 골랐다.') },
            { text: '돌아서 간다', pick: back('‘돌아서 간다’를 골랐다.') },
          ] });
        } },
        close('devinfo', 'menu'),
      ] });
    }
    if (this.modal === 'scenarios') {
      drawModal(ui, { title: '개발용 시나리오', alpha: 0.92, lines: [{ text: '고정된 패 구성으로 특수 상황을 재현합니다. 선택하면 그 구성으로 대결을 시작합니다.', size: 14 }], buttons: [
        ...SCENARIOS.map(sc => ({ text: sc.title, onTap: () => startTable(this, { scenario: sc.key, opponentId: 'barber' }) })),
        close('scenarios', 'devinfo'),
      ] });
    }
  }
  // ---- 행동 ----
  /** 일반 대결: 소지금이 판돈 × 3 미만이면 안내만. 5장 첫 항구 판은 태오가 판돈을 대 준다(지면 손실 0, 이기면 정상 획득). */
  sitNormal(id: PlaceId) {
    if (this.modal !== 'place') return;
    const p = this.progress;
    if (!canSit(p.money, PLACES[id].stakePerPoint)) {
      if (canTaeohStake(p, id)) {
        this.progress = setFlag(p, TAEOH_STAKED_FLAG); this.save();
        playStory(this, chapterLabel(chapterById('ch5')), TAEOH_STAKE_SCENES, s => startTable(s, { practice: false, opponentId: 'stranger', stake: PLACES.harbor.stakePerPoint, placeId: 'harbor', staked: true }));
        return;
      }
      this.noMoneyPlace = id; this.modal = 'noMoney'; this.draw(); return;
    }
    startNormalMatch(this, id);
  }
  buy(id: ItemId) {
    if (this.modal !== 'shop') return;
    const it = itemById(id), next = buyItem(this.progress, id);
    if (!next) return;
    this.progress = next; this.save(); this.draw(); this.pulseMoney(-(it.price ?? 0));
  }
  /** 장비 장착/해제(집). 가방↔장비 칸 사이를 오간다. */
  toggleGear(id: ItemId) {
    if (this.modal !== 'gear') return;
    const next = this.progress.gear.includes(id) ? unequipGear(this.progress, id) : equipGear(this.progress, id);
    if (!next) return;
    this.progress = next; this.save(); this.draw();
  }
  useItem(id: ItemId) {
    if (this.modal !== 'bag') return;
    const r = useItemOnMap(this.progress, id);
    if (!r) return;
    this.progress = r.progress; this.save();
    this.showNotice('가방', [r.note], 'bag');
  }
  /**
   * 서린과 대화: 하루 첫 방문 호감 +1, 하루 1회 사건 추첨(seededRng(day×1000+visits)). 사건 장면은 이야기 씬으로 재생하고,
   * 끝나면 효과를 적용해 안내 창으로 돌아온다(교재비는 선택 창). 사건이 없으면 안내만.
   */
  talkSerin() {
    if (this.modal !== 'place') return;
    const p = this.progress;
    const r = visitSerin(p, seededRng(p.day * 1000 + p.serin.visits));
    this.progress = r.progress; this.save();
    if (!r.event) { this.showNotice('윤서린', ['오늘은 별다른 일이 없다.', r.firstToday ? '호감 +1 (하루 첫 방문)' : '오늘 이미 들렀다.'], 'place'); return; }
    const ev = r.event, tier = r.tier ? tierName(r.tier) : '';
    const rare = this.progress.flags[FLAGS.serinJunk] && !p.flags[FLAGS.serinJunk];
    playStory(this, `편의점 · ${ev.title}`, ev.scenes, s => {
      if (ev.choice) { goJourney(s, { serinChoice: ev.id }); return; }
      const a = applyEvent(loadProgress(), ev.id, 'none');
      saveProgress(a.progress);
      goJourney(s, { notice: { title: ev.title, lines: [...a.notice, ...(tier ? [`답례 등급: ${tier}`] : []), ...(rare ? ['고물상 삼촌을 소개받았다(투시경 해금 예정).'] : [])] }, moneyDelta: a.moneyDelta });
    });
  }
  resolveChoice(choice: 'accept' | 'decline') {
    if (this.modal !== 'choice' || !this.choiceEvent) return;
    const ev = serinEventById(this.choiceEvent);
    const a = applyEvent(this.progress, ev.id, choice);
    this.progress = a.progress; this.save();
    this.choiceEvent = undefined;
    this.notice = { title: ev.title, lines: a.notice }; this.modal = 'notice'; this.draw();
    this.pulseMoney(a.moneyDelta);
  }
  /** 집 휴식: 검은 막이 내려오며 "다음 날" → 진행 갱신·저장 → 막이 걷힌다. 전환 중 입력 잠금. */
  /** 10장 끝: 마지막 판을 요구한다 → 10장 완료(11장으로) → 보상 창. */
  demandFinal() {
    if (this.modal !== 'kingChoice') return;
    this.progress = completeChapter(this.progress, chapterById('ch10')); this.save();
    this.launch = { chapterDone: 'ch10' }; this.modal = 'reward'; this.draw();
  }
  /** 보상 창 닫기: 장 대결 승리로 끝났으면 밤이 지나간다(집 휴식과 같은 효과 + "다음 날" 전환, 6장 제외 — 요청 11-C). */
  closeReward() {
    if (this.modal !== 'reward') return;
    const night = this.launch.nightAfter === true;
    this.launch = { ...this.launch, nightAfter: false };
    this.modal = 'none';
    if (night) this.runRest(); else this.draw();
  }
  /** 심부름 시작: 물건 찾기는 before 장면 → 상인과 한 판(판돈 0), 돕기는 before 장면 → 선택 창, 단서는 장면 → 완료. */
  startErrand(id: ErrandId) {
    if (this.modal !== 'errands') return;
    const e = errandById(id);
    if (e.kind === 'match') { playStory(this, `심부름 · ${e.title}`, e.before, s => startErrandMatch(s, id)); return; }
    if (e.kind === 'choice') { playStory(this, `심부름 · ${e.title}`, e.before, s => goJourney(s, { errandChoice: id })); return; }
    playStory(this, `심부름 · ${e.title}`, e.before, s => {
      saveProgress(completeErrand(loadProgress(), id));
      goJourney(s, { notice: { title: `심부름 · ${e.title}`, lines: [e.after] } });
    });
  }
  /** 가게 봐 주기: 수락이면 하루 지남 + 3만 원, 거절이면 완료만. 복희 대사가 다르다. */
  resolveErrandChoice(accept: boolean) {
    if (this.modal !== 'errandChoice' || !this.errandChoice) return;
    const e = errandById(this.errandChoice), c = e.choice!;
    let q = completeErrand(this.progress, e.id), delta = 0;
    if (accept) { const m = addMoney({ ...q, day: q.day + 1 }, c.money); q = m.progress; delta = m.applied; }
    this.progress = q; this.save(); this.errandChoice = undefined;
    this.notice = { title: `심부름 · ${e.title}`, lines: [accept ? '한 시간이 하루가 됐다. 일당을 받았다.' : '거절했다.', `복희: “${accept ? c.acceptLine : c.declineLine}”`] };
    this.modal = 'notice'; this.draw();
    if (delta) this.pulseMoney(delta);
  }
  restAtHome() {
    if (this.modal !== 'place' || this.busy) return;
    // 6장 그날 밤: 휴식 직전 문 앞 비닐봉지(삼각김밥 2개 + 서린 메시지) 장면 1회, 끝나면 바로 휴식
    if (isNightLocked(this.progress) && !this.progress.flags['ch6.bag']) {
      this.progress = addToBag(setFlag(this.progress, 'ch6.bag'), 'riceBall', 2); this.save();
      playStory(this, chapterLabel(chapterById('ch6')), NIGHT_CH6_SCENES, s => goJourney(s, { doRest: true }));
      return;
    }
    this.runRest();
  }
  runRest() {
    if (this.busy) return;
    this.busy = true; this.modal = 'none'; this.draw();
    const half = Math.round(JOURNEY.nightMs / 2);
    const cover = this.add.rectangle(0, 0, DESIGN.width, DESIGN.height, 0x000000, 0).setOrigin(0).setInteractive().setDepth(1000);
    const text = this.add.text(DESIGN.width / 2, DESIGN.height / 2, '다음 날', { fontFamily: FONT, fontSize: 34, color: COLORS.text, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0).setDepth(1001);
    this.tweens.add({ targets: [cover, text], alpha: 1, duration: half, onComplete: () => {
      this.progress = rest(this.progress); this.save();
      this.draw();
      this.children.bringToTop(cover); this.children.bringToTop(text);
      this.tweens.add({ targets: [cover, text], alpha: 0, duration: half, delay: 150, onComplete: () => { cover.destroy(); text.destroy(); this.busy = false; this.draw(); } });
    } });
  }
}
