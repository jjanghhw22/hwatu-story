// 여정 지도 씬. 상단 day·소지금·압류 예고·가방, 가운데 장소 노드(그림 없이 원과 이름, 세로 지그재그), 아래 메뉴.
// 노드를 누르면 그 장소의 행동 메뉴(모달). 진행 상태는 src/story/progress.ts가 읽고 쓰고, 서린 사건은 src/story/serin.ts가 정한다.
import Phaser from 'phaser';
import { seededRng } from '../rng';
import { SCENARIOS } from '../scenarios';
import { CH5_RAMEN_SCENES, CH7_COURIER, CH7_VISITOR, CHAPTERS, GIFT_SCENES, type Chapter, NIGHT_CH6_SCENES, chapterById, chapterLabel, isChapterImplemented, placeOpensLabel } from '../story/chapters';
import { ERRANDS, type ErrandId, canChallengeBokhee, completeErrand, errandById, errandsDone, isErrandDone } from '../story/errands';
import { FLAGS, type ItemId, itemById, shopItems } from '../story/items';
import { PLACES, PLACE_IDS, type PlaceId, canSit, isPlaceReady } from '../story/places';
import { BONGGU_ENTRY_WINS, COUNTERS, MA_ENTRY_WINS, type Progress, addMoney, addToBag, canChallengeBonggu, isDebtFrozen, isNightLocked, winsKey, SEIZURE_NOTICE, bagCount, buyItem, canChallengeMa, counter, currentChapter, equipGear, formatManWon, formatWon, formatWonDelta, isBanned, isChapterDone, loadProgress, resetProgress, rest, saveProgress, setFlag, unequipGear, useItemOnMap } from '../story/progress';
import { GEAR_SLOTS } from '../story/items';
import { noteMissing } from '../ui/missing';
import { type SerinEventId, applyEvent, serinEventById, tierName, visitSerin } from '../story/serin';
import { SKILLS } from '../story/skills';
import { CardFx, FxSettings } from '../ui/fx';
import { BUILD_TAG, CREDITS, NOT_IMPLEMENTED, RULES } from '../ui/infoTexts';
import { DESIGN, JOURNEY, MARGIN, journeyNodes } from '../ui/layout';
import { missingAssets } from '../ui/missing';
import { type ModalButton, type ModalLine, drawModal } from '../ui/modals';
import { SoundFx } from '../ui/sound';
import { COLORS, FONT, type UI, box, button, label, panel } from '../ui/widgets';
import { type JourneyLaunch, SCENE_KEYS, goJourney, playStory, startChapterMatch, startErrandMatch, startLessonMatch, startNormalMatch, startPractice, startTable } from './flow';

type Modal = 'none' | 'place' | 'menu' | 'rules' | 'credits' | 'devinfo' | 'scenarios' | 'reward' | 'box' | 'shop' | 'bag' | 'notice' | 'choice' | 'noMoney' | 'gear' | 'errands' | 'errandChoice';
/** 노드 색: 열린 곳은 어두운 녹색 + 황동, 잠긴 곳은 회색, 오늘 출입 금지(들통)는 붉은 테두리. */
const NODE = { open: 0x15302a, openEdge: 0xb08d4a, locked: 0x1c1c1a, lockedEdge: 0x444039, lockedText: '#6f6a60', link: 0x7a6236, banned: 0xc0392b } as const;
const coverKey = (path: string) => `cover:${path}`;
const PREPARING = '다음 이야기는 아직 준비 중';

export class JourneyScene extends Phaser.Scene {
  progress!: Progress;
  layer!: Phaser.GameObjects.Container;
  sfx = new SoundFx(); fxSettings = new FxSettings(); fx!: CardFx;
  modal: Modal = 'none'; selected?: PlaceId; launch: JourneyLaunch = {};
  /** 안내 창 내용(사건 결과·아이템 사용 등). */
  notice: { title: string; lines: string[] } = { title: '', lines: [] };
  /** 선택이 있는 서린 사건(교재비). */
  choiceEvent?: SerinEventId;
  /** 돈이 모자라 못 앉는 장소. */
  noMoneyPlace?: PlaceId;
  /** 밤 → 아침 전환 중 입력 잠금. */
  busy = false;
  /** 선택이 있는 심부름(가게 비운 사람 돕기). */
  errandChoice?: ErrandId;
  constructor() { super(SCENE_KEYS.journey); }
  init(data: JourneyLaunch = {}) {
    this.launch = data; this.selected = data.openPlace; this.busy = false; this.choiceEvent = data.serinChoice;
    this.errandChoice = data.errandChoice;
    this.modal = data.reward || data.chapterDone ? 'reward' : data.serinChoice ? 'choice' : data.errandChoice ? 'errandChoice' : data.notice ? 'notice' : data.openPlace ? 'place' : 'none';
    if (data.notice) this.notice = data.notice;
  }
  /** 현재 장 대표 컷(없으면 어두운 패널). 읽기 실패는 조용히 기록. */
  preload() {
    const c = currentChapter(loadProgress());
    if (c.cover && !this.textures.exists(coverKey(c.cover))) this.load.image(coverKey(c.cover), c.cover);
    this.load.on('loaderror', (file: { key: string; src: string }) => { if (file.key.startsWith('cover:')) noteMissing(file.src); });
  }
  create() {
    this.progress = loadProgress();
    this.fx = new CardFx(this, this.add.container(), this.fxSettings);
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.events.once('shutdown', () => this.fx.clear());
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
  get nextPlace(): PlaceId { const ch = this.chapter; return isChapterImplemented(ch.id) && this.isOpen(ch.place) && !isChapterDone(this.progress, ch.id) ? ch.place : 'home'; }
  get nextIsPreparing() { return !isChapterImplemented(this.chapter.id) || (this.nextPlace === 'home' && this.chapter.place !== 'home'); }
  save() { saveProgress(this.progress); }
  /** 소지금 변화 "+N원/−N원"을 머리 패널의 소지금 글자 옆에 띄운다. */
  pulseMoney(delta: number) { if (!delta) return; const H = JOURNEY.header; this.fx.scorePulse(undefined, DESIGN.width - MARGIN - 24, H.y + 46, delta, 1, formatWonDelta(delta)); }
  draw() {
    this.layer?.destroy(true); this.layer = this.add.container();
    this.children.bringToTop(this.fx.layer);
    const ui = this.ui, p = this.progress, ch = this.chapter;
    box(ui, 0, 0, DESIGN.width, DESIGN.height, COLORS.bg);
    // 0. 맨 위 현재 장 대표 컷(640×240): 그림이 있으면 비율 유지로 맞추고, 없으면 어두운 패널에 장 제목만
    const C = JOURNEY.cover, cx0 = (DESIGN.width - C.w) / 2;
    panel(ui, cx0, C.y, C.w, C.h, 'wood');
    const ck = ch.cover ? coverKey(ch.cover) : undefined;
    if (ck && this.textures.exists(ck)) {
      const img = this.add.image(cx0 + C.w / 2, C.y + C.h / 2, ck);
      img.setScale(Math.min((C.w - 16) / img.width, (C.h - 16) / img.height)); this.layer.add(img);
    } else {
      box(ui, cx0 + 8, C.y + 8, C.w - 16, C.h - 16, 0x0b0f0c);
      label(ui, DESIGN.width / 2, C.y + C.h / 2, chapterLabel(ch), 22, COLORS.goldDim, C.w - 48, [0.5, 0.5], true);
    }
    // 1. 머리: day · 소지금 · 현재 장 · 압류 예고(작게, 붉은 글자) · 집중력·기술 · 가방 버튼
    const H = JOURNEY.header;
    panel(ui, MARGIN, H.y, DESIGN.width - MARGIN * 2, H.h, 'wood');
    label(ui, MARGIN + 24, H.y + 14, `DAY ${p.day}`, 24, COLORS.gold, 200, [0, 0], true);
    label(ui, DESIGN.width - MARGIN - 24, H.y + 14, formatWon(p.money), 24, COLORS.text, 300, [1, 0], true).setName('money');
    label(ui, MARGIN + 24, H.y + 48, chapterLabel(ch), 14, COLORS.muted, 400, [0, 0]);
    // 6장 뒤: 돈으로는 해결이 안 된다 — 압류 예고 금액 대신 회색 "동결"
    if (isDebtFrozen(p)) label(ui, DESIGN.width - MARGIN - 24, H.y + 44, '압류 예고 · 동결', 13, COLORS.muted, 240, [1, 0], true);
    else label(ui, DESIGN.width - MARGIN - 24, H.y + 44, `압류 예고 ${formatManWon(SEIZURE_NOTICE)}`, 13, COLORS.bakWarn, 240, [1, 0], true);
    label(ui, MARGIN + 24, H.y + 72, `집중력 ${p.focus}/${p.focusMax}  ·  기술 ${p.skills.length ? p.skills.map(s => SKILLS[s].name).join(', ') : '없음'}`, 13, COLORS.goldDim, 420, [0, 0]);
    const bagN = Object.values(p.bag).reduce((s, n) => s + (n ?? 0), 0);
    button(ui, DESIGN.width - MARGIN - 24 - 110, H.y + 64, 110, `가방 ${bagN}`, () => this.switchModal('none', 'bag'), this.modal === 'none' && !this.busy, 28, 14);
    // 2. 장소 노드: 세로 지그재그. 이음선 → 원 → 이름 → 잠김 안내. 다음 목적지에 금색 테두리 + ▶
    const pos = journeyNodes(PLACE_IDS.length);
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1], b = pos[i];
      this.layer.add(this.add.line(0, 0, a.x, a.y, b.x, b.y, NODE.link, 0.45).setOrigin(0).setLineWidth(2));
    }
    const r = JOURNEY.node.r, next = this.nextPlace;
    PLACE_IDS.forEach((id, i) => {
      const place = PLACES[id], { x, y } = pos[i];
      const open = this.isOpen(id), isNext = id === next, banned = isBanned(p, id);
      this.layer.add(this.add.circle(x, y + 3, r + 2, 0x000000, 0.45));
      const circle = this.add.circle(x, y, r, open ? NODE.open : NODE.locked).setStrokeStyle(isNext || banned ? JOURNEY.node.ring : 2, banned ? NODE.banned : isNext ? 0xe0b64f : open ? NODE.openEdge : NODE.lockedEdge);
      this.layer.add(circle);
      label(ui, x, y, place.name, place.name.length > 4 ? 15 : 17, open ? COLORS.text : NODE.lockedText, r * 2 - 6, [0.5, 0.5], true).setName(`place:${id}`);
      if (!open) label(ui, x, y + r + JOURNEY.node.labelGap, placeOpensLabel(place.opensAt) ?? '', 12, NODE.lockedText, 160, [0.5, 0]);
      if (isNext) label(ui, x - r - 14, y, '▶', 22, COLORS.gold, 40, [1, 0.5], true);
      circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openPlace(id));
    });
    // 3. 아래 메뉴
    const B = JOURNEY.bottom;
    button(ui, MARGIN, DESIGN.height - B.pad - B.h, DESIGN.width - MARGIN * 2, '메뉴', () => this.switchModal('none', 'menu'), this.modal === 'none' && !this.busy, B.h, 20);
    this.drawModals();
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
        const at = place.opensAt === 'start' ? undefined : chapterById(place.opensAt);
        drawModal(ui, { title: `${place.name} · 잠김`, alpha: 0.85, lines: [
          { text: at ? `${placeOpensLabel(place.opensAt)}. ${at.no}장 ‘${at.title}’은 다음 단계에서 열립니다.` : '아직 열리지 않았습니다.', size: 16, color: COLORS.text },
          { text: place.actions, size: 13 },
        ], buttons: [close('place')] });
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
        buttons.push({ text: done ? '흰 방의 아버지(9장) · 끝남' : '흰 방의 아버지(9장)', onTap: () => startChapterMatch(this, ch9), enabled: p.chapterId === 'ch9' });
        if (done) lines.push({ text: '초대전 — 다음 이야기는 아직 준비 중', size: 16, color: COLORS.gold, bold: true });
        if (place.stakePerPoint > 0) buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
      } else {
        if (place.stakePerPoint > 0) buttons.push({ text: `판 치기 (일반 · 1점 ${formatWon(place.stakePerPoint)})`, onTap: () => this.sitNormal(id) });
      }
      buttons.push(close('place'));
      const title = id === 'home' && p.flags['home.newFurniture'] ? `${place.name} · 새 가구` : place.name;
      drawModal(ui, { title, alpha: 0.85, lines, buttons });
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
        { text: `${place.name}은 1점 ${formatWon(place.stakePerPoint)} 판이라 최소 ${formatWon(place.stakePerPoint * 7)}이 있어야 앉을 수 있다. 지금 ${formatWon(p.money)}.`, size: 16, color: COLORS.text },
        { text: '집에서 쉬고 편의점의 서린을 찾아가면 길이 열린다(야간 근무 식사).', size: 14 },
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
      drawModal(ui, { title: sk ? `${sk.name}를 배웠다` : ch ? `${ch.title} 완료` : '진행', alpha: 0.85, lines, buttons: [{ text: '확인', onTap: () => this.switchModal('reward', 'none') }] });
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
        { text: '시나리오', onTap: () => this.switchModal('devinfo', 'scenarios') },
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
  /** 일반 대결: 소지금이 판돈 × 7 미만이면 안내만. */
  sitNormal(id: PlaceId) {
    if (this.modal !== 'place') return;
    if (!canSit(this.progress.money, PLACES[id].stakePerPoint)) { this.noMoneyPlace = id; this.modal = 'noMoney'; this.draw(); return; }
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
