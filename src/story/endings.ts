// 엔딩 3종·에필로그·크레딧(바이블 11장·에필로그). 엔딩 A만 에필로그 전체, B는 짧은 에필로그, C는 에필로그 없음. 순수 데이터·함수.
import type { CharacterId } from '../character.ts';
import { CHAPTERS, type ChapterId, type Scene } from './chapters.ts';
import { type SerinRoute } from './gates.ts';
import { type Progress, completeChapter, initialProgress, setFlag } from './progress.ts';

export type EndingId = 'A' | 'B' | 'C';
const cut = (text: string): Scene => ({ kind: 'cut', text });
const line = (speaker: CharacterId, text: string): Scene => ({ kind: 'line', speaker, text });

export const ENDING_TITLES: Record<EndingId, string> = { A: '엔딩 A · 아버지 데리러 왔습니다', B: '엔딩 B · 왕좌', C: '엔딩 C · 문이 닫힌 이발소' };
/** 엔딩 본 장면. A: 스톱(기본), B: 고(왕좌), C: 10장에서 자리를 받아들임. */
export const ENDING_SCENES: Record<EndingId, Scene[]> = {
  A: [line('player', '다음 사람 기다리세요.'), line('mujin', '왕이 되러 온 거 아니었나?'), line('player', '아버지 데리러 왔습니다.')],
  B: [cut('왕좌. 판은 이제 도윤의 것이다.'), cut('새 얼굴들이 도윤의 자리를 둘러싼다.'), cut('아버지는 조사에 협조하고 피해를 정리한다. 집에는 아무도 없다.'), cut('이번에도 집에 돌아오지 못했다.')],
  C: [cut('쉬운 왕좌. 사람들을 큰 판으로 끌어들이는 자리.'), cut('이발소 문이 닫혀 있다.')],
};
/**
 * 에필로그(엔딩 A만, 바이블 그대로): 아버지 → 대식 → 복희 → 태오(수락: 시장 배송 / 거절: 항구를 떠남) → 서린 복학 → 편의점 봉투 → 이발소 → "이번에는 집에 돌아왔다."
 * 봉투: route 'slow'이고 호감 ≥ 12면 영화표, 아니면 손편지(friend·slow) / 작별 선물(distance). 세 갈래 모두 같은 길이(4장면)로 실패처럼 보이지 않게.
 */
export const MOVIE_AFFINITY = 12;
export type Envelope = 'movie' | 'letter' | 'farewell';
export function envelopeOf(route: SerinRoute, affinity: number): Envelope { return route === 'slow' && affinity >= MOVIE_AFFINITY ? 'movie' : route === 'distance' ? 'farewell' : 'letter'; }
const ENVELOPE: Record<Envelope, Scene[]> = {
  movie: [line('seorin', '토요일 비워 놔.'), line('player', '이번엔 누구 삼촌인데?'), line('seorin', '이번엔 삼촌 없어.'), cut('영화표 두 장.')],
  letter: [cut('봉투 안에 손편지 한 장.'), line('seorin', '말로 하면 웃을 것 같아서.'), line('player', '…고마워.'), cut('손편지를 접어 주머니에 넣는다.')],
  farewell: [cut('봉투 안에 작은 작별 선물.'), line('seorin', '멀리 가도 밥은 먹고 다녀.'), line('player', '너도.'), cut('작은 열쇠고리 하나.')],
};
export function epilogueScenes(route: SerinRoute, affinity: number, taeohAccepted: boolean): Scene[] {
  return [
    cut('에필로그 · 머리 자르는 날'),
    cut('아버지는 집으로 돌아오지만 조사에 협조하고 피해를 정리한다.'),
    cut('대식은 이발소를 연다.'),
    cut('복희는 반찬값을 올렸다가 싸운다.'),
    cut(taeohAccepted ? '태오는 시장 배송을 시작한다.' : '태오는 항구를 떠난다.'),
    cut('서린은 복학 신청서를 쓴다.'),
    cut('편의점. 서린이 봉투 하나를 내민다.'),
    ...ENVELOPE[envelopeOf(route, affinity)],
    line('barber', '이번엔 어떻게 잘라?'),
    line('player', '양쪽 똑같이요.'),
    cut('밖에서 서린이 웃는다. 화면이 어두워진다.'),
    cut('이번에는 집에 돌아왔다.'),
  ];
}
/** 크레딧(간단히 컷으로 넘김). */
export const CREDITS_SCENES: Scene[] = [
  cut('마지막 패\n— 왕이 없는 밤 —'),
  cut('기획·이야기: jjanghhw22\n구현: Claude Code'),
  cut('화투 도안: Marcus Richert (based on artwork by Louie Mantia, Jr.)\nWikimedia Commons, CC BY-SA 4.0'),
  cut('글꼴: 나눔고딕·나눔붓 (NHN Corporation, SIL OFL 1.1)\n엔진: Phaser 3 (MIT)'),
  cut('플레이해 주셔서 고맙습니다.'),
];
/** 엔딩 전체 장면: A = 본 장면 + 에필로그 + 크레딧, B = 본 장면(짧은 에필로그 포함) + 크레딧, C = 본 장면 + 크레딧(에필로그 없음). */
export function endingScenes(id: EndingId, p: Progress, route: SerinRoute): Scene[] {
  const epi = id === 'A' ? epilogueScenes(route, p.serin.affinity, p.flags['taeoh.accepted'] === true) : [];
  return [...ENDING_SCENES[id], ...epi, ...CREDITS_SCENES];
}
export const endingFlag = (id: EndingId) => `ending.${id}`;
export function endingsSeen(p: Progress): EndingId[] { return (['A', 'B', 'C'] as EndingId[]).filter(id => p.flags[endingFlag(id)]); }
/** 엔딩을 기록하고 이야기를 끝낸다(현재 장 = 에필로그). 엔딩 뒤에도 모든 장소의 일반 대결은 그대로 열려 있다. */
export function recordEnding(p: Progress, id: EndingId): Progress { return { ...setFlag(p, endingFlag(id)), chapterId: 'epilogue' }; }

/** 개발용 장 바로가기: 그 장 시작 상태(앞 장을 모두 완료한 진행)를 만든다. 돈은 시작 돈 + 장마다 10만 원(시연용). */
export function progressAtChapter(id: ChapterId): Progress {
  let p = initialProgress();
  for (const c of CHAPTERS) {
    if (c.id === id) break;
    p = completeChapter({ ...p, chapterId: c.id }, c);
    p = { ...p, money: p.money + 100000 };
  }
  return { ...p, chapterId: id };
}
