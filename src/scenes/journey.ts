// 여정 지도 씬. 상단 day·소지금·압류 예고, 가운데 장소 노드(그림 없이 원과 이름, 세로 지그재그), 아래 메뉴.
// 노드를 누르면 그 장소의 행동 메뉴(모달). 진행 상태는 src/story/progress.ts가 읽고 쓴다.
import Phaser from 'phaser';
import { SCENARIOS } from '../scenarios';
import { CHAPTERS, type Chapter, chapterById, chapterLabel, placeOpensLabel } from '../story/chapters';
import { PLACES, PLACE_IDS, type PlaceId } from '../story/places';
import { type Progress, SEIZURE_NOTICE, currentChapter, formatManWon, formatWon, isChapterDone, loadProgress, resetProgress, rest, saveProgress } from '../story/progress';
import { SKILLS } from '../story/skills';
import { FxSettings } from '../ui/fx';
import { BUILD_TAG, CREDITS, NOT_IMPLEMENTED, RULES } from '../ui/infoTexts';
import { DESIGN, JOURNEY, MARGIN, journeyNodes } from '../ui/layout';
import { type ModalButton, type ModalLine, drawModal } from '../ui/modals';
import { SoundFx } from '../ui/sound';
import { COLORS, FONT, type UI, box, button, label, panel } from '../ui/widgets';
import { type JourneyLaunch, SCENE_KEYS, goJourney, playStory, startChapterMatch, startPractice, startTable } from './flow';

type Modal = 'none' | 'place' | 'menu' | 'rules' | 'credits' | 'devinfo' | 'scenarios' | 'reward' | 'box';
/** 노드 색: 열린 곳은 어두운 녹색 + 황동, 잠긴 곳은 회색. */
const NODE = { open: 0x15302a, openEdge: 0xb08d4a, locked: 0x1c1c1a, lockedEdge: 0x444039, lockedText: '#6f6a60', link: 0x7a6236 } as const;

export class JourneyScene extends Phaser.Scene {
  progress!: Progress;
  layer!: Phaser.GameObjects.Container;
  sfx = new SoundFx(); fxSettings = new FxSettings();
  modal: Modal = 'none'; selected?: PlaceId; launch: JourneyLaunch = {};
  /** 밤 → 아침 전환 중 입력 잠금. */
  busy = false;
  constructor() { super(SCENE_KEYS.journey); }
  init(data: JourneyLaunch = {}) { this.launch = data; this.modal = data.reward || data.chapterDone ? 'reward' : 'none'; this.selected = undefined; this.busy = false; }
  create() {
    this.progress = loadProgress();
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.draw();
  }
  get ui(): UI { return { scene: this, layer: this.layer }; }
  get chapter(): Chapter { return currentChapter(this.progress); }
  isOpen(id: PlaceId) { return this.progress.unlockedPlaces.includes(id); }
  save() { saveProgress(this.progress); }
  draw() {
    this.layer?.destroy(true); this.layer = this.add.container();
    const ui = this.ui, p = this.progress, ch = this.chapter;
    box(ui, 0, 0, DESIGN.width, DESIGN.height, COLORS.bg);
    // 1. 머리: day · 소지금 · 현재 장 · 압류 예고(작게, 붉은 글자) · 집중력
    const H = JOURNEY.header;
    panel(ui, MARGIN, H.y, DESIGN.width - MARGIN * 2, H.h, 'wood');
    label(ui, MARGIN + 24, H.y + 18, `DAY ${p.day}`, 24, COLORS.gold, 200, [0, 0], true);
    label(ui, DESIGN.width - MARGIN - 24, H.y + 18, formatWon(p.money), 24, COLORS.text, 300, [1, 0], true);
    label(ui, MARGIN + 24, H.y + 54, chapterLabel(ch), 14, COLORS.muted, 420, [0, 0]);
    label(ui, DESIGN.width - MARGIN - 24, H.y + 54, `압류 예고 ${formatManWon(SEIZURE_NOTICE)}`, 13, COLORS.bakWarn, 240, [1, 0], true);
    label(ui, MARGIN + 24, H.y + 76, `집중력 ${p.focus}/${p.focusMax}  ·  기술 ${p.skills.length ? p.skills.map(s => SKILLS[s].name).join(', ') : '없음'}`, 13, COLORS.goldDim, 500, [0, 0]);
    // 2. 장소 노드: 세로 지그재그. 이음선 → 원 → 이름 → 잠김 안내. 다음에 가야 할 곳(현재 장의 무대)은 금색 테두리 + ▶
    const pos = journeyNodes(PLACE_IDS.length);
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1], b = pos[i];
      const ln = this.add.line(0, 0, a.x, a.y, b.x, b.y, NODE.link, 0.45).setOrigin(0).setLineWidth(2);
      this.layer.add(ln);
    }
    const r = JOURNEY.node.r;
    PLACE_IDS.forEach((id, i) => {
      const place = PLACES[id], { x, y } = pos[i];
      const open = this.isOpen(id), next = ch.place === id && !isChapterDone(p, ch.id);
      const shadow = this.add.circle(x, y + 3, r + 2, 0x000000, 0.45); this.layer.add(shadow);
      const circle = this.add.circle(x, y, r, open ? NODE.open : NODE.locked).setStrokeStyle(next ? JOURNEY.node.ring : 2, next ? 0xe0b64f : open ? NODE.openEdge : NODE.lockedEdge);
      this.layer.add(circle);
      label(ui, x, y, place.name, place.name.length > 4 ? 15 : 17, open ? COLORS.text : NODE.lockedText, r * 2 - 6, [0.5, 0.5], true);
      if (!open) label(ui, x, y + r + JOURNEY.node.labelGap, placeOpensLabel(place.opensAt) ?? '', 12, NODE.lockedText, 160, [0.5, 0]);
      if (next) label(ui, x - r - 14, y, '▶', 22, COLORS.gold, 40, [1, 0.5], true);
      circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openPlace(id));
    });
    // 3. 아래 메뉴
    const B = JOURNEY.bottom;
    button(ui, MARGIN, DESIGN.height - B.pad - B.h, DESIGN.width - MARGIN * 2, '메뉴', () => this.switchModal('none', 'menu'), this.modal === 'none' && !this.busy, B.h, 20);
    this.drawModals();
  }
  openPlace(id: PlaceId) { if (this.modal !== 'none' || this.busy) return; this.selected = id; this.modal = 'place'; this.draw(); }
  switchModal(from: Modal, to: Modal) { if (this.modal !== from) return; this.modal = to; this.draw(); }
  drawModals() {
    const ui = this.ui, p = this.progress;
    if (this.modal === 'place' && this.selected) {
      const id = this.selected, place = PLACES[id];
      const close: ModalButton = { text: '닫기', onTap: () => this.switchModal('place', 'none') };
      if (!this.isOpen(id)) {
        const at = place.opensAt === 'start' ? undefined : chapterById(place.opensAt);
        drawModal(ui, { title: `${place.name} · 잠김`, alpha: 0.85, lines: [
          { text: at ? `${placeOpensLabel(place.opensAt)}. ${at.no}장 ‘${at.title}’은 다음 단계에서 열립니다.` : '아직 열리지 않았습니다.', size: 16, color: COLORS.text },
          { text: place.actions, size: 13 },
        ], buttons: [close] });
        return;
      }
      const lines: ModalLine[] = [{ text: place.actions, size: 14 }];
      const buttons: ModalButton[] = [];
      if (id === 'barber') {
        const ch1 = chapterById('ch1'), done = isChapterDone(p, 'ch1'), current = p.chapterId === 'ch1';
        buttons.push({ text: '대화(이야기 재생)', onTap: () => {
          if (current) startChapterMatch(this, ch1);
          else playStory(this, chapterLabel(ch1), [...ch1.scenes.before, ...ch1.scenes.after], s => goJourney(s));
        } });
        buttons.push({ text: done ? '대결(1장) · 완료' : '대결(1장)', onTap: () => startChapterMatch(this, ch1, true), enabled: current });
        buttons.push({ text: '연습 대결(무료)', onTap: () => startPractice(this, 'barber') });
      } else if (id === 'home') {
        buttons.push({ text: '휴식 (집중력 회복 · 다음 날)', onTap: () => this.restAtHome() });
        buttons.push({ text: '연습 대결', onTap: () => startPractice(this, 'barber') });
        buttons.push({ text: '아버지 물건 조사', onTap: () => this.switchModal('place', 'box') });
      }
      buttons.push(close);
      drawModal(ui, { title: place.name, alpha: 0.85, lines, buttons });
    }
    if (this.modal === 'box') {
      // 1장 상자 내용(after 첫 컷의 글자 그대로). 1장을 아직 끝내지 않았으면 조사할 것이 없다.
      const ch1 = chapterById('ch1'), first = ch1.scenes.after[0];
      const text = isChapterDone(p, 'ch1') && first.kind === 'cut' ? first.text : '아직 조사할 물건이 없다.';
      drawModal(ui, { title: '아버지 물건', alpha: 0.85, lines: [{ text, size: 17, color: COLORS.text }], buttons: [{ text: '닫기', onTap: () => this.switchModal('box', 'none') }] });
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
        { text: '닫기', onTap: () => this.switchModal('menu', 'none') },
      ] });
    }
    if (this.modal === 'rules') drawModal(ui, { title: '규칙 안내', alpha: 0.92, lines: RULES, buttons: [{ text: '닫기', onTap: () => this.switchModal('rules', 'menu') }] });
    if (this.modal === 'credits') drawModal(ui, { title: '제작자·출처', alpha: 0.92, lines: CREDITS, buttons: [{ text: '닫기', onTap: () => this.switchModal('credits', 'menu') }] });
    if (this.modal === 'devinfo') {
      drawModal(ui, { title: '개발 정보', alpha: 0.92, lines: [
        { text: `빌드 ${BUILD_TAG}  ·  진행 ${p.chapterId} (day ${p.day})  ·  열린 곳 ${p.unlockedPlaces.length}/${PLACE_IDS.length}  ·  장 ${CHAPTERS.length}개`, size: 14, color: COLORS.text },
        { text: `미구현: ${NOT_IMPLEMENTED}. 2장 이후 이야기·기술 7종·아이템·의심도는 데이터만 있음. 컷 그림·인물 그림(장대식·한도윤 외) 없음.`, size: 13 },
        { text: '진행 초기화는 저장(hwatu.progress.v1)을 지우고 프롤로그부터 다시 시작합니다.', size: 13 },
      ], buttons: [
        { text: '진행 초기화', onTap: () => { if (this.modal !== 'devinfo') return; resetProgress(); this.scene.start(SCENE_KEYS.boot); } },
        { text: '시나리오', onTap: () => this.switchModal('devinfo', 'scenarios') },
        { text: '닫기', onTap: () => this.switchModal('devinfo', 'menu') },
      ] });
    }
    if (this.modal === 'scenarios') {
      drawModal(ui, { title: '개발용 시나리오', alpha: 0.92, lines: [{ text: '고정된 패 구성으로 특수 상황을 재현합니다. 선택하면 그 구성으로 대결을 시작합니다.', size: 14 }], buttons: [
        ...SCENARIOS.map(sc => ({ text: sc.title, onTap: () => startTable(this, { scenario: sc.key, opponentId: 'barber' }) })),
        { text: '닫기', onTap: () => this.switchModal('scenarios', 'devinfo') },
      ] });
    }
  }
  /** 집 휴식: 검은 막이 내려오며 "다음 날" → 진행 갱신·저장 → 막이 걷힌다. 전환 중 입력 잠금. */
  restAtHome() {
    if (this.modal !== 'place' || this.busy) return;
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
