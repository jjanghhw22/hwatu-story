// 시작 씬: 진행 상태를 읽어 프롤로그(처음) 또는 여정 지도로 보낸다. 화면을 그리지 않는다.
import Phaser from 'phaser';
import { chapterById, chapterLabel } from '../story/chapters';
import { completeChapter, loadProgress, saveProgress } from '../story/progress';
import { SCENE_KEYS, goJourney, playStory } from './flow';

export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE_KEYS.boot); }
  create() {
    const p = loadProgress();
    if (p.chapterId !== 'prologue') { goJourney(this); return; }
    const pro = chapterById('prologue');
    playStory(this, chapterLabel(pro), pro.scenes.before, s => {
      saveProgress(completeChapter(loadProgress(), pro));
      goJourney(s);
    });
  }
}
