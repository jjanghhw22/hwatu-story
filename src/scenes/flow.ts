// 씬 사이의 흐름(지도 ↔ 이야기 ↔ 대결). 씬은 키 문자열로 서로를 시작하며, 이 모듈이 넘길 데이터 형태를 정한다.
import type Phaser from 'phaser';
import { type Chapter, type ChapterId, type Scene, chapterLabel } from '../story/chapters';
import type { OpponentId } from '../story/opponents';
import { PLACES, type PlaceId, isPlaceReady } from '../story/places';
import { completeChapter, loadProgress, saveProgress } from '../story/progress';
import type { SerinEventId } from '../story/serin';
import type { SkillId } from '../story/skills';
import type { ErrandId } from '../story/errands';
import { BIG_TABLE, BIG_TABLE_INTERLUDE, type BigRound } from '../story/bigtable';
import type { GateNo } from '../story/gates';
import { serinRoute } from '../story/gates';
import { ENDING_TITLES, type EndingId, endingScenes, recordEnding } from '../story/endings';
import { chapterById } from '../story/chapters';

/** 대결 화면 시작 데이터. scenario는 개발용 고정 패 구성(그대로 유지). stake는 1점당 판돈(원), placeId는 승수 집계용. */
export type TableLaunch = {
  scenario?: string; chapterId?: ChapterId; opponentId?: OpponentId; practice?: boolean; stake?: number; placeId?: PlaceId;
  /** 4장 심부름 대결(물건 찾기): 이기면 심부름 완료. */
  errand?: ErrandId;
  /** 6장 큰 판: 몇 번째 판(1·2). 판돈은 표시만 하고 돈은 움직이지 않는다(noPayout). */
  bigRound?: BigRound; noPayout?: boolean;
  /** 기술 배우기 대결(7장 박 기사 → 간파): 이기면 그 기술을 배운다. */
  lesson?: SkillId;
  /** 10장 초대전 번호(1 민정호 · 2 차유라 · 3 구상만). */
  gate?: GateNo;
  /** 11장 마지막 선택에서 '고' → 무진 4단계 추가 승부. */
  kingFinal?: boolean;
};
/** 이야기 화면 시작 데이터. 마지막 장면 뒤 onDone이 다음 단계로 보낸다. */
export type StoryLaunch = { label: string; scenes: Scene[]; onDone: (scene: Phaser.Scene) => void };
/** 여정 지도 시작 데이터: 방금 끝낸 장의 보상, 안내 창, 돈 변화 표시, 서린 사건 선택, 바로 열 장소 모달. */
export type JourneyLaunch = {
  chapterDone?: ChapterId; reward?: SkillId; unlocked?: PlaceId[];
  notice?: { title: string; lines: string[] };
  moneyDelta?: number;
  serinChoice?: SerinEventId;
  openPlace?: PlaceId;
  /** 돌아오자마자 집 휴식 전환을 실행(6장 그날 밤 비닐봉지 장면 뒤). */
  doRest?: boolean;
  /** 4장 심부름 선택(가게 비운 사람 돕기). */
  errandChoice?: ErrandId;
  /** 10장 끝: 백무진의 자리 제안(받아들임 = 엔딩 C / 마지막 판 요구 = 11장). */
  kingChoice?: boolean;
  /** 11장 승리 뒤 마지막 선택(스톱 = 엔딩 A / 고 = 추가 승부). */
  finalChoice?: boolean;
  /** 10장 서린 관계 분기 선택 창. */
  routeChoice?: boolean;
};

export const SCENE_KEYS = { boot: 'boot', journey: 'journey', story: 'story', table: 'table' } as const;

export function goJourney(scene: Phaser.Scene, data: JourneyLaunch = {}) { scene.scene.start(SCENE_KEYS.journey, data); }
export function playStory(scene: Phaser.Scene, label: string, scenes: Scene[], onDone: StoryLaunch['onDone']) {
  const data: StoryLaunch = { label, scenes, onDone };
  scene.scene.start(SCENE_KEYS.story, data);
}
export function startTable(scene: Phaser.Scene, launch: TableLaunch) { scene.scene.start(SCENE_KEYS.table, launch); }

/** 장의 대결: before 장면 → 대결(판돈 0). skipStory면 바로 대결. 6장은 큰 판 1판째(판돈 20만 표시, 돈 변동 없음). */
export function startChapterMatch(scene: Phaser.Scene, c: Chapter, skipStory = false) {
  const launch: TableLaunch = c.id === 'ch6'
    ? { chapterId: c.id, opponentId: c.opponentId, practice: false, stake: BIG_TABLE.stakeShown, noPayout: true, bigRound: 1, placeId: c.place }
    : { chapterId: c.id, opponentId: c.opponentId, practice: false, stake: 0, placeId: c.place };
  if (skipStory) startTable(scene, launch);
  else playStory(scene, chapterLabel(c), c.scenes.before, s => startTable(s, launch));
}
/** 장의 대결 승리 뒤: after 장면 → 진행 저장(보상·해금·다음 장) → 지도(보상 창). 새로 열린 곳은 구현된 장소만 알린다. */
export function finishChapterWin(scene: Phaser.Scene, c: Chapter, extra: { prefix?: Scene[]; flags?: string[] } = {}) {
  playStory(scene, chapterLabel(c), [...(extra.prefix ?? []), ...c.scenes.after], s => {
    const before = loadProgress();
    let after = completeChapter(before, c);
    for (const f of extra.flags ?? []) after = { ...after, flags: { ...after.flags, [f]: true } };
    saveProgress(after);
    goJourney(s, { chapterDone: c.id, reward: c.rewardSkill, unlocked: after.unlockedPlaces.filter(p => !before.unlockedPlaces.includes(p) && isPlaceReady(p)) });
  });
}
/** 큰 판 다음 판: 짧은 컷 → 같은 설정으로 2판째. */
export function nextBigTable(scene: Phaser.Scene, launch: TableLaunch, round: BigRound) {
  playStory(scene, '큰 판', BIG_TABLE_INTERLUDE, s => startTable(s, { ...launch, bigRound: round }));
}
/** 4장 심부름 대결(건어물 상인, 판돈 0). */
export function startErrandMatch(scene: Phaser.Scene, errand: ErrandId) { startTable(scene, { practice: false, opponentId: 'merchant', stake: 0, placeId: 'market', errand }); }
/**
 * 엔딩 재생: 엔딩 장면(+ A는 에필로그 전체, B는 짧은 에필로그) + 크레딧 → 진행 저장(엔딩 플래그, 이야기 끝) → 지도.
 * A·B는 11장 완료로, C는 10장에서 바로 끝난다. 엔딩 뒤에도 모든 장소의 일반 대결은 열려 있다.
 */
export function playEnding(scene: Phaser.Scene, id: EndingId) {
  const p0 = loadProgress();
  const scenes = endingScenes(id, p0, serinRoute(p0));
  playStory(scene, ENDING_TITLES[id], scenes, s => {
    let p = loadProgress();
    if (id !== 'C') p = completeChapter({ ...p, chapterId: 'ch11' }, chapterById('ch11'));
    saveProgress(recordEnding(p, id));
    goJourney(s, { notice: { title: `${ENDING_TITLES[id]} 달성`, lines: ['이야기가 끝났다. 지도에서 일반 대결은 계속할 수 있고, 장면은 다시 볼 수 있다.'] } });
  });
}
/** 기술 배우기 대결(판돈 0). */
export function startLessonMatch(scene: Phaser.Scene, opponentId: OpponentId, lesson: SkillId) { startTable(scene, { practice: false, opponentId, stake: 0, lesson }); }
/** 연습 대결(돈·진행 없음, 집중력은 소모). */
export function startPractice(scene: Phaser.Scene, opponentId: OpponentId) { startTable(scene, { practice: true, opponentId, stake: 0 }); }
/** 일반 대결: 장소의 판돈(1점당)으로 익명 상대와. 입장 조건은 호출하는 쪽(지도)이 확인한다. */
export function startNormalMatch(scene: Phaser.Scene, placeId: PlaceId) { startTable(scene, { practice: false, opponentId: 'stranger', stake: PLACES[placeId].stakePerPoint, placeId }); }
