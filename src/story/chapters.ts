// 챕터·장면 데이터(바이블 4·5절). 프롤로그와 1장은 대사 전부, 2장 이후는 제목·장소·상대·보상·잠금만(대사는 자리 표시 한두 줄).
// 글자·이름·수치는 바이블의 것을 그대로 쓴다. 컷 그림 경로는 적어 두되 파일이 없으면 어두운 패널 + 글자로 표시한다(F1에서는 그림 파일 없음).
import type { CharacterId } from '../character.ts';
import type { PlaceId } from './places.ts';
import type { OpponentId } from './opponents.ts';
import type { SkillId } from './skills.ts';

export type ChapterId = 'prologue' | 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6' | 'ch7' | 'ch8' | 'ch9' | 'ch10' | 'ch11' | 'epilogue';

/** 이야기 장면 한 칸. cut: 큰 컷(그림이 있으면 그림, 없으면 어두운 패널) + 아래 글자. line: 왼쪽 초상화 + 이름 + 말풍선. */
export type Scene =
  | { kind: 'cut'; image?: string; text: string }
  | { kind: 'line'; speaker: CharacterId; text: string };

export type Chapter = {
  id: ChapterId;
  /** 화면 머리글의 번호. 프롤로그 0, 에필로그 12. */
  no: number;
  title: string;
  /** 무대. 이 장의 대화·대결은 이 장소의 행동 메뉴에서 시작한다. */
  place: PlaceId;
  /** 이 장을 끝내면 열리는 장소. */
  unlocks: PlaceId[];
  opponentId?: OpponentId;
  rewardSkill?: SkillId;
  /** 지도 맨 위 대표 컷 그림 경로(없으면 어두운 패널에 장 제목만). */
  cover?: string;
  /** 승리 후 집중력 최대치(바이블 6절). 없으면 그대로. */
  focusMaxAfter?: number;
  scenes: { before: Scene[]; after: Scene[] };
};

export const STORY_ASSET_DIR = 'assets/story';
const cut = (image: string | undefined, text: string): Scene => ({ kind: 'cut', image: image ? `${STORY_ASSET_DIR}/${image}` : undefined, text });
const line = (speaker: CharacterId, text: string): Scene => ({ kind: 'line', speaker, text });
/** 2장 이후 자리 표시(F2~F5에서 바이블 대사로 채운다). */
const placeholder = (text: string): Scene[] => [cut(undefined, text)];

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'prologue', no: 0, title: '봉투', cover: `${STORY_ASSET_DIR}/cover-prologue.png`, place: 'home', unlocks: [],
    scenes: {
      before: [
        cut('prologue-1.png', '전화 한 통.\n“아버님이… 연락이 안 되셔서요.”'),
        cut('prologue-2.png', '압류 예고장이 붙은 집, 다 마른 작업복, 먹다 남긴 반찬.\n떠날 준비를 한 집이 아니다.'),
        cut('prologue-3.png', '식탁 위 봉투: 현금 12만 원, 낡은 이발소 보관증.\n뒷면에 아버지 글씨.\n“머리부터 자르고 와라.”'),
        cut('prologue-4.png', '“사라지면서까지 머리 타령이네.”\n골목 끝, 대성이발관.'),
      ],
      after: [],
    },
  },
  {
    id: 'ch1', no: 1, title: '머리부터 자르고 와라', cover: `${STORY_ASSET_DIR}/cover-ch1.png`, place: 'barber', unlocks: ['home', 'store'], opponentId: 'barber', rewardSkill: 'eye',
    scenes: {
      before: [
        cut('ch1-barber.png', '보관증을 들고 대식에게 간다. 상자를 받으려면 한 판 이겨야 한다.'),
        cut('ch1-lock.png', '대식은 보관증을 보자 출입문부터 잠근다.'),
        line('barber', '그럼 안 온 거구나.'),
        cut('ch1-blanket.png', '초록 담요를 편다.'),
        line('barber', '한 판 이겨. 그러면 준다.'),
      ],
      after: [
        cut('ch1-box.png', '철제 상자 — 젊은 아버지의 사진(다섯 명, 한 명은 얼굴이 접혀 있다), 다섯 이름 수첩, 화투 한 장(12월 비광).'),
        line('barber', '네 아버지, 예전에 패 좀 만졌다.'),
        line('player', '도박꾼이었다고요?'),
        line('barber', '그 말로는 모자라.'),
        line('barber', '돈 따러 가는 놈은 돈만 잃고 끝날 수도 있다. 사람 찾으러 가는 놈은 끝이 없어.'),
      ],
    },
  },
  {
    id: 'ch2', no: 2, title: '새벽 두 시의 편의점', cover: `${STORY_ASSET_DIR}/cover-ch2.png`, place: 'store', unlocks: ['bath'], opponentId: 'bamcha',
    scenes: {
      before: [
        cut('ch2-store.png', '집으로 가는 길에 불 켜진 편의점.'),
        line('seorin', '봉투 필요하세…… 한도윤?'),
        cut('ch2-hair.png', '머리를 보고 웃는다.'),
        line('seorin', '대식 아저씨한테 잘랐지? 아직도 양쪽 길이가 다르네.'),
        cut('ch2-phone.png', '며칠 뒤, 전화기 너머.'),
        line('seorin', '이번 주 안에는 넣을게요. 학교에는 연락하지 마세요.'),
        cut('ch2-bench.png', '편의점 앞 평상의 택시 기사 ‘밤차’.'),
        line('seorin', '저 아저씨 심심해 죽어. 한 판 쳐 줘.'),
      ],
      after: [
        cut('ch2-note.png', '수첩의 첫 이름, 마철수.'),
        line('seorin', '마 사장? 목욕탕 뒤에서 하는 사람.'),
      ],
    },
  },
  {
    id: 'ch3', no: 3, title: '목욕탕 뒤편의 작은 왕', cover: `${STORY_ASSET_DIR}/cover-ch3.png`, place: 'bath', unlocks: ['market'], opponentId: 'ma', rewardSkill: 'calmFace',
    scenes: {
      before: [
        cut('ch3-bath.png', '수첩의 첫 이름. 작은 판에서 이기고, 마 사장의 장부를 본다.'),
        cut('ch3-ma.png', '돈 없는 손님에게 웃으며 자리를 내준다.'),
      ],
      after: [
        cut('ch3-ledger.png', '장부. 아버지는 돈을 빌린 게 아니라 남의 빚을 사들였다.'),
        line('ma', '이상한 사람이었지. 남의 빚을 자기 돈 주고 가져가.'),
        cut('ch3-name.png', '장부에 서린 어머니 이름.'),
        line('ma', '그건 네가 알 일이 아니야.'),
      ],
    },
  },
  { id: 'ch4', no: 4, title: '시장에서는 웃는 사람이 무섭다', cover: `${STORY_ASSET_DIR}/cover-ch4.png`, place: 'market', unlocks: ['harbor'], opponentId: 'bokhee', rewardSkill: 'lookAway', focusMaxAfter: 120,
    scenes: { before: placeholder('장부의 다음 흔적. 복희에게 사진 속 인물을 듣는다. (다음 단계)'), after: placeholder('“네 아버지는 왕을 이기려던 사람이 아니야.” (다음 단계)') } },
  { id: 'ch5', no: 5, title: '친구라고 부르는 남자', cover: `${STORY_ASSET_DIR}/cover-ch5.png`, place: 'harbor', unlocks: [], opponentId: 'bonggu', rewardSkill: 'swap',
    scenes: { before: placeholder('항구의 큰 판. 태오가 길을 열어 준다. (다음 단계)'), after: placeholder('바꿔치기. 의심도 게이지가 처음 보인다. (다음 단계)') } },
  { id: 'ch6', no: 6, title: '이기고도 빚지는 밤', cover: `${STORY_ASSET_DIR}/cover-ch6.png`, place: 'harbor', unlocks: [], opponentId: 'highroller',
    scenes: { before: placeholder('익명의 고액 판 상대 2명 연속. (다음 단계)'), after: placeholder('우승금 동결. 태오는 사라졌다. 돈 목표가 사라진다. (다음 단계)') } },
  { id: 'ch7', no: 7, title: '편의점 뒷문', cover: `${STORY_ASSET_DIR}/cover-ch7.png`, place: 'store', unlocks: ['billiards'], opponentId: 'sangcheol', rewardSkill: 'readThrough',
    scenes: { before: placeholder('수금업자 ‘뱀눈’이 편의점 뒷문으로 온다. (다음 단계)'), after: placeholder('목표가 바뀐다 — 백운레저. (다음 단계)') } },
  { id: 'ch8', no: 8, title: '돌아온 친구', cover: `${STORY_ASSET_DIR}/cover-ch8.png`, place: 'billiards', unlocks: ['hotel'], opponentId: 'taeoh',
    scenes: { before: placeholder('태오 재대결. 출입증과 정산 자료. (다음 단계)'), after: placeholder('“호텔에 있어. 그런데 네가 생각하는 모습은 아닐 거야.” (다음 단계)') } },
  { id: 'ch9', no: 9, title: '흰 방의 아버지', cover: `${STORY_ASSET_DIR}/cover-ch9.png`, place: 'hotel', unlocks: [], opponentId: 'father', rewardSkill: 'fold', focusMaxAfter: 140,
    scenes: { before: placeholder('창문이 열리지 않는 방. 아버지와의 판. (다음 단계)'), after: placeholder('“한 판 지는 게 무서우면, 결국 다 잃을 때까지 앉아 있게 된다.” (다음 단계)') } },
  { id: 'ch10', no: 10, title: '왕의 식탁', cover: `${STORY_ASSET_DIR}/cover-ch10.png`, place: 'hotel', unlocks: [], opponentId: 'jeongho',
    scenes: { before: placeholder('세 문지기 3연전: 민정호·차유라·구상만. (다음 단계)'), after: placeholder('백무진 등장. 왕좌 제안. (다음 단계)') } },
  { id: 'ch11', no: 11, title: '왕이 없는 밤', cover: `${STORY_ASSET_DIR}/cover-ch11.png`, place: 'hotel', unlocks: [], opponentId: 'mujin',
    scenes: { before: placeholder('백무진. 3단계 한 판. (다음 단계)'), after: placeholder('“한 번 더.” 고 / 스톱. (다음 단계)') } },
  { id: 'epilogue', no: 12, title: '머리 자르는 날', cover: `${STORY_ASSET_DIR}/cover-epilogue.png`, place: 'barber', unlocks: [],
    scenes: { before: placeholder('이번에는 집에 돌아왔다. (다음 단계)'), after: [] } },
];

export const CHAPTER_IDS = CHAPTERS.map(c => c.id);
/** 이야기·대결이 실제로 구현된 장. 그 뒤 장의 무대는 지도에서 잠긴 채 보인다(보정: 다음 목적지 ▶는 집에). */
export const IMPLEMENTED_CHAPTERS: readonly ChapterId[] = ['prologue', 'ch1', 'ch2', 'ch3'];
export const isChapterImplemented = (id: ChapterId) => IMPLEMENTED_CHAPTERS.includes(id);
export const isChapterId = (v: unknown): v is ChapterId => typeof v === 'string' && CHAPTERS.some(c => c.id === v);
export function chapterById(id: ChapterId): Chapter { return CHAPTERS.find(c => c.id === id)!; }
/** 다음 장 id. 마지막(에필로그)이면 그대로. */
export function nextChapterId(id: ChapterId): ChapterId { const i = CHAPTERS.findIndex(c => c.id === id); return CHAPTERS[Math.min(i + 1, CHAPTERS.length - 1)].id; }
/** 진행 순서 비교: a가 b보다 앞이면 음수. */
export function chapterOrder(a: ChapterId, b: ChapterId): number { return CHAPTERS.findIndex(c => c.id === a) - CHAPTERS.findIndex(c => c.id === b); }
/** 상단 머리글: "CHAPTER 01 · 머리부터 자르고 와라", 프롤로그·에필로그는 이름으로. */
export function chapterLabel(c: Chapter): string {
  const head = c.id === 'prologue' ? 'PROLOGUE' : c.id === 'epilogue' ? 'EPILOGUE' : `CHAPTER ${String(c.no).padStart(2, '0')}`;
  return `${head} · ${c.title}`;
}
/** 장소가 열리는 장의 번호 글자("1장에서 열림"). 처음부터 열린 곳은 null. */
export function placeOpensLabel(opensAt: 'start' | ChapterId): string | null {
  if (opensAt === 'start') return null;
  const c = chapterById(opensAt);
  return c.id === 'prologue' ? '프롤로그에서 열림' : c.id === 'epilogue' ? '에필로그에서 열림' : `${c.no}장에서 열림`;
}
