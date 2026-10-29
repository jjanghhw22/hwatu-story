// 4장 심부름 셋(바이블 4장): 물건 찾기(상인과 연습 한 판), 가게 비운 사람 돕기(선택지), 연락 끊긴 상인(단서). 복희 대결은 셋을 끝낸 뒤.
import type { Scene } from './chapters.ts';
import { type Progress, setFlag } from './progress.ts';

export type ErrandId = 'find' | 'help' | 'clue';
export type Errand = {
  id: ErrandId;
  title: string;
  /** 진행 방식: 연습 한 판(판돈 0, 이기면 완료) / 선택지 2개 / 단서 장면만. */
  kind: 'match' | 'choice' | 'clue';
  before: Scene[];
  /** 끝난 뒤 한 줄. */
  after: string;
  choice?: { accept: string; decline: string; /** 수락: 하루 경과 + 돈. */ money: number; acceptLine: string; declineLine: string };
};
const cut = (text: string): Scene => ({ kind: 'cut', text });
const line = (speaker: 'bokhee' | 'player' | 'stranger', text: string): Scene => ({ kind: 'line', speaker, text });

export const HELP_MONEY = 30000;
export const ERRANDS: readonly Errand[] = [
  { id: 'find', title: '물건 찾기', kind: 'match',
    before: [cut('복희가 맡긴 물건을 찾으러 건어물 가게로 간다.'), line('stranger', '물건? 한 판 이기면 내주지.')],
    after: '건어물 상인에게서 물건을 받아 복희에게 가져다줬다.' },
  { id: 'help', title: '가게 비운 사람 돕기', kind: 'choice',
    before: [cut('옆 가게 주인이 급히 자리를 비워야 한다며 가게를 봐 달라고 한다.')],
    after: '가게를 봐 주는 일이 정리됐다.',
    choice: { accept: '한 시간 봐 준다', decline: '거절한다', money: HELP_MONEY, acceptLine: '밥값은 해야지. 잘했다.', declineLine: '바쁜가 보네. 그래, 네 일부터 봐.' } },
  { id: 'clue', title: '연락 끊긴 상인', kind: 'clue',
    before: [cut('연락이 끊긴 상인의 가게. 문은 닫혀 있고, 옆집이 말을 보탠다.'), line('stranger', '그 양반, 네 아버지 때문에 돈을 잃은 사람이었다.')],
    after: '그 상인은 아버지 때문에 돈을 잃은 사람이었다.' },
];
export const ERRAND_IDS = ERRANDS.map(e => e.id);
export function errandById(id: ErrandId): Errand { return ERRANDS.find(e => e.id === id)!; }
export const errandFlag = (id: ErrandId) => `errand.${id}`;
export function isErrandDone(p: Progress, id: ErrandId): boolean { return p.flags[errandFlag(id)] === true; }
export function errandsDone(p: Progress): number { return ERRAND_IDS.filter(id => isErrandDone(p, id)).length; }
export function completeErrand(p: Progress, id: ErrandId): Progress { return setFlag(p, errandFlag(id)); }
/** 복희 대결 입장: 심부름 셋 완료 + 4장이 현재 장. */
export function canChallengeBokhee(p: Progress): boolean { return p.chapterId === 'ch4' && errandsDone(p) === ERRAND_IDS.length; }
