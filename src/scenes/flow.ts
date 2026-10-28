// 씬 사이의 흐름(지도 ↔ 이야기 ↔ 대결). 씬은 키 문자열로 서로를 시작하며, 이 모듈이 넘길 데이터 형태를 정한다.
import type Phaser from 'phaser';
import { type Chapter, type ChapterId, type Scene, chapterLabel } from '../story/chapters';
import type { OpponentId } from '../story/opponents';
import type { PlaceId } from '../story/places';
import { completeChapter, loadProgress, saveProgress } from '../story/progress';
import type { SkillId } from '../story/skills';

/** 대결 화면 시작 데이터. scenario는 개발용 고정 패 구성(그대로 유지). */
export type TableLaunch = { scenario?: string; chapterId?: ChapterId; opponentId?: OpponentId; practice?: boolean };
/** 이야기 화면 시작 데이터. 마지막 장면 뒤 onDone이 다음 단계로 보낸다. */
export type StoryLaunch = { label: string; scenes: Scene[]; onDone: (scene: Phaser.Scene) => void };
/** 여정 지도 시작 데이터: 방금 끝낸 장의 보상 표시. */
export type JourneyLaunch = { chapterDone?: ChapterId; reward?: SkillId; unlocked?: PlaceId[] };

export const SCENE_KEYS = { boot: 'boot', journey: 'journey', story: 'story', table: 'table' } as const;

export function goJourney(scene: Phaser.Scene, data: JourneyLaunch = {}) { scene.scene.start(SCENE_KEYS.journey, data); }
export function playStory(scene: Phaser.Scene, label: string, scenes: Scene[], onDone: StoryLaunch['onDone']) {
  const data: StoryLaunch = { label, scenes, onDone };
  scene.scene.start(SCENE_KEYS.story, data);
}
export function startTable(scene: Phaser.Scene, launch: TableLaunch) { scene.scene.start(SCENE_KEYS.table, launch); }

/** 장의 대결: before 장면 → 대결. */
export function startChapterMatch(scene: Phaser.Scene, c: Chapter, skipStory = false) {
  const launch: TableLaunch = { chapterId: c.id, opponentId: c.opponentId, practice: false };
  if (skipStory) startTable(scene, launch);
  else playStory(scene, chapterLabel(c), c.scenes.before, s => startTable(s, launch));
}
/** 장의 대결 승리 뒤: after 장면 → 진행 저장(보상·해금·다음 장) → 지도(보상 창). */
export function finishChapterWin(scene: Phaser.Scene, c: Chapter) {
  playStory(scene, chapterLabel(c), c.scenes.after, s => {
    const before = loadProgress();
    const after = completeChapter(before, c);
    saveProgress(after);
    goJourney(s, { chapterDone: c.id, reward: c.rewardSkill, unlocked: after.unlockedPlaces.filter(p => !before.unlockedPlaces.includes(p)) });
  });
}
/** 연습 대결(돈·진행 없음, 집중력은 소모). */
export function startPractice(scene: Phaser.Scene, opponentId: OpponentId) { startTable(scene, { practice: true, opponentId }); }
