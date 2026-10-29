// 챕터·장면 데이터(바이블 4·5절). 프롤로그와 1장은 대사 전부, 2장 이후는 제목·장소·상대·보상·잠금만(대사는 자리 표시 한두 줄).
// 글자·이름·수치는 바이블의 것을 그대로 쓴다. 컷 그림 경로는 적어 두되 파일이 없으면 어두운 패널 + 글자로 표시한다(F1에서는 그림 파일 없음).
import type { CharacterId } from '../character.ts';
import type { PlaceId } from './places.ts';
import type { ItemId } from './items.ts';
import type { OpponentId } from './opponents.ts';
import type { SkillId } from './skills.ts';
import { FATHER_TEACH_FOLD } from './lines.ts';

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
  /** 장을 끝내면 켜지는 플래그(눈썰미 강화, 동전 상점 해금, 압류 동결, 그날 밤 잠금 등). */
  setFlags?: string[];
  /** 장을 끝내면 가방에 들어오는 물건. */
  rewardItems?: Partial<Record<ItemId, number>>;
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
  {
    id: 'ch4', no: 4, title: '시장에서는 웃는 사람이 무섭다', cover: `${STORY_ASSET_DIR}/cover-ch4.png`, place: 'market', unlocks: ['harbor'], opponentId: 'bokhee', rewardSkill: 'lookAway', focusMaxAfter: 120,
    setFlags: ['eye+'],
    scenes: {
      before: [
        cut('ch4-market.png', '장부의 다음 흔적. 복희에게 사진 속 인물을 듣는다.'),
        line('bokhee', '밥은 먹었니?'),
        line('player', '먹었습니다.'),
        line('bokhee', '거짓말도 못하네. 그러니까 패도 그렇게 내지.'),
      ],
      after: [
        cut('ch4-photo.png', '사진의 나머지 — 대식, 아버지, 항구의 문씨(태오 아버지), 호텔의 백무진, 얼굴 접힌 사람.'),
        line('bokhee', '네 아버지는 왕을 이기려던 사람이 아니야.'),
        line('player', '그럼요?'),
        line('bokhee', '왕이 만들어지는 걸 도왔지.'),
        cut('ch4-crack.png', '믿음에 첫 금. 아버지는 돈을 빌려준 사람이 아니라 자기 때문에 돈을 잃은 사람들을 찾아다녔다.'),
      ],
    },
  },
  {
    id: 'ch5', no: 5, title: '친구라고 부르는 남자', cover: `${STORY_ASSET_DIR}/cover-ch5.png`, place: 'harbor', unlocks: [], opponentId: 'bonggu', rewardSkill: 'swap',
    setFlags: ['taeoh.coin', 'home.newFurniture'], rewardItems: { luckyCoin: 1 },
    scenes: {
      before: [
        cut('ch5-harbor.png', '항구의 큰 판. 태오가 길을 열어 준다.'),
        line('taeoh', '우리도 대충 친구 하면 되겠네.'),
        cut('ch5-manner.png', '큰 판 예절, 위험한 자리 회피. 태오가 옆에서 한 판에 한 번 대신 쳐 준다.'),
      ],
      after: [
        line('taeoh', '이번에 따면 네 아버지 빚 같은 건 신경도 안 써도 돼.'),
        cut('ch5-no.png', '서린도 대식도 가지 말라고 한다.'),
        cut('ch5-kid.png', '도윤은 둘 다 자신을 어린애로 본다고 생각한다.'),
        cut('ch5-go.png', '그리고 간다.'),
      ],
    },
  },
  {
    id: 'ch6', no: 6, title: '이기고도 빚지는 밤', cover: `${STORY_ASSET_DIR}/cover-ch6.png`, place: 'harbor', unlocks: [], opponentId: 'highroller',
    setFlags: ['debt.frozen', 'night.ch6'],
    scenes: {
      before: [cut('ch6-bigtable.png', '익명의 고액 판 상대 2명 연속. 판이 크고 눈이 많다.')],
      after: [
        cut('ch6-settle.png', '정산. 태오가 보증한 판돈 일부가 도윤 명의 대여금으로 처리돼 있다. 우승금은 동결, 참가자들은 둘이 한패라 믿는다.'),
        cut('ch6-gone.png', '태오는 사라졌다.'),
        cut('ch6-barber.png', '대성이발관.'),
        line('player', '알았죠? 이런 판인 거.'),
        line('barber', '네 아버지 때도 말렸어.'),
        line('player', '말리기만 했어요? 그때도?'),
        line('barber', '그때 내가 판을 깔았으니까!'),
        cut('ch6-truth.png', '대식은 아버지의 조력자였다. 두 사람은 백무진을 위해 사람들을 큰 판으로 끌어들였다.'),
      ],
    },
  },
  {
    id: 'ch7', no: 7, title: '편의점 뒷문', cover: `${STORY_ASSET_DIR}/cover-ch7.png`, place: 'store', unlocks: ['billiards'], opponentId: 'sangcheol',
    scenes: {
      before: [
        cut('ch7-papers.png', '서린의 빚 서류. 같은 금액, 날짜마다 바뀌는 채권자.'),
        cut('ch7-trace.png', '영수증·통화 기록·납부 내역, 그리고 판에서 가져온 단서. 하나의 이름으로 모인다 — 백운레저.'),
        line('seorin', '네가 돈을 아무리 따도 저쪽이 장부를 고치면 끝이잖아.'),
        cut('ch7-goal.png', '목표가 바뀐다. 아버지, 빚의 원본 기록, 백무진이 자기 편에게도 숨긴 돈의 흐름.'),
      ],
      after: [
        cut('ch7-backdoor.png', '편의점 뒷문. 뱀눈이 서류 봉투를 내려놓는다.'),
        line('seorin', '오늘은 돈 안 가져와도 돼. 잠깐 앉아 있다 가.'),
      ],
    },
  },
  {
    id: 'ch8', no: 8, title: '돌아온 친구', cover: `${STORY_ASSET_DIR}/cover-ch8.png`, place: 'billiards', unlocks: ['hotel'], opponentId: 'taeoh',
    scenes: {
      before: [
        cut('ch8-billiards.png', '당구장. 태오가 큐대를 내려놓는다.'),
        line('taeoh', '때릴 거면 왼쪽은 피해. 거긴 이미 맞았어.'),
        cut('ch8-debt.png', '태오는 백무진에게 아버지 빚이 잡혀 있었다.'),
        line('player', '넌 친구도 팔고 돈도 못 받았네.'),
        line('taeoh', '그러게. 장사를 참 못해.'),
        cut('ch8-stake.png', '돈 대신 출입증과 정산 자료를 건 한 판.'),
      ],
      after: [
        line('player', '아버지는 살아 있어?'),
        line('taeoh', '호텔에 있어. 그런데 네가 생각하는 모습은 아닐 거야.'),
      ],
    },
  },
  {
    id: 'ch9', no: 9, title: '흰 방의 아버지', cover: `${STORY_ASSET_DIR}/cover-ch9.png`, place: 'hotel', unlocks: [], opponentId: 'father', rewardSkill: 'fold', focusMaxAfter: 140,
    setFlags: ['ch9.files'],
    scenes: {
      before: [
        cut('ch9-room.png', '창문이 열리지 않는 방. 아버지는 백무진의 옛 거래 기록을 정리하고 있다.'),
        line('father', '누가 여기 오랬어?'),
        line('player', '아버지는 맨날 오지 말래. 묻지 말래. 기다리래. 그럼 나는 뭘 알아야 하는데?'),
        line('father', '내가 남들 돈 잃게 만든 건 맞다.'),
        line('player', '그럼 왜 나한테는 한 번도 말 안 했어요?'),
        line('father', '네가 나를 좋아했으니까.'),
      ],
      after: [
        line('father', '한 판 지는 게 무서우면, 결국 다 잃을 때까지 앉아 있게 된다.'),
        cut('ch9-files.png', '자료 일부를 받았다. 마지막 기록은 백무진 개인 금고. 초대전을 통과해야 한다.'),
      ],
    },
  },
  {
    id: 'ch10', no: 10, title: '왕의 식탁', cover: `${STORY_ASSET_DIR}/cover-ch10.png`, place: 'hotel', unlocks: [], opponentId: 'jeongho',
    scenes: {
      before: [
        cut('ch10-barber.png', '초대전 전날 밤. 대식이 이발소 열쇠를 내민다.'),
        line('barber', '이발소를 담보로 잡아라. 판돈이 모자라면 그걸로 해.'),
        line('player', '이번에는 아무도 집 걸지 마요.'),
        cut('ch10-hotel.png', '백운호텔 초대전. 문지기 셋을 차례로 넘어야 한다. 판 사이에는 나가서 쉬어도 된다.'),
      ],
      after: [],
    },
  },
  {
    id: 'ch11', no: 11, title: '왕이 없는 밤', cover: `${STORY_ASSET_DIR}/cover-ch11.png`, place: 'hotel', unlocks: [], opponentId: 'mujin',
    scenes: {
      before: [cut('ch11-table.png', '왕의 식탁. 백무진이 맞은편에 앉는다. 판은 한 번, 그러나 판이 끝나지 않고 단계가 바뀐다.')],
      after: [line('mujin', '한 번 더.'), cut('ch11-voice.png', '처음으로 큰 목소리.'), line('mujin', '이번엔 네가 원하는 거 전부.')],
    },
  },
  { id: 'epilogue', no: 12, title: '머리 자르는 날', cover: `${STORY_ASSET_DIR}/cover-epilogue.png`, place: 'barber', unlocks: [],
    scenes: { before: placeholder('이번에는 집에 돌아왔다. (다음 단계)'), after: [] } },
];

export const CHAPTER_IDS = CHAPTERS.map(c => c.id);
/** 이야기·대결이 실제로 구현된 장. 그 뒤 장의 무대는 지도에서 잠긴 채 보인다(보정: 다음 목적지 ▶는 집에). */
export const IMPLEMENTED_CHAPTERS: readonly ChapterId[] = ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9', 'ch10', 'ch11'];
/** 6장 그날 밤 집 장면(비닐봉지): 휴식 직전 1회. */
export const NIGHT_CH6_SCENES: Scene[] = [
  cut('ch6-bag.png', '문 앞 비닐봉지. 삼각김밥 둘, 생수.'),
  line('seorin', '먹고 화내. 굶으면 판단부터 이상해져.'),
];
/** 7장: 승리 방법별 한 줄(잡기로 이기면 원본, 그냥 이기면 사본). */
export const CH7_ORIGINAL: Scene[] = [line('seorin', '원본이야.')];
export const CH7_COPY: Scene[] = [line('seorin', '사본뿐이네. 그래도 이름은 다 있어.')];
/** 8장: 승리 뒤 선택별 한두 줄. */
export const CH8_ACCEPT: Scene[] = [line('player', '받아들일게.'), line('taeoh', '…고맙다. 한 판에 한 번은 내가 칠게.')];
export const CH8_DECLINE: Scene[] = [line('player', '자료만 줘.'), line('taeoh', '그래. 그게 맞겠지.')];
/** 9장: 접었을 때(아버지가 처음으로 고개를 끄덕인다) / 이겼을 때. */
export const CH9_FOLD: Scene[] = [cut('ch9-nod.png', '아버지가 처음으로 고개를 끄덕인다.')];
export const CH9_WIN: Scene[] = [line('father', '…이겼네. 그럼 됐다.')];
/** 10장: 문지기 셋을 다 이기면 백무진 등장(바이블 대사 전부) → 선택. */
export const MUJIN_APPEAR: Scene[] = [
  cut('ch10-mujin.png', '비싼 옷, 작은 목소리. 사람들이 먼저 눈치를 본다.'),
  line('mujin', '네 아버지는 일을 잘했는데, 끝에 가서 마음이 약해졌어.'),
  line('player', '나한테는 뭘 시키려고요?'),
  line('mujin', '아무것도. 네가 이기는 모습만 보여주면 돼. 그러면 사람들은 자기들도 이길 수 있다고 믿거든.'),
];
/** 10장 서린의 마지막 상품(편의점 첫 방문). 낡은 회중시계는 9장 뒤에 이미 받았으므로 이번 상품은 부적. */
export const SERIN_LAST_ITEM: Scene[] = [
  cut('ch10-charm.png', '서린이 계산대 밑에서 작은 부적 하나를 꺼낸다.'),
  line('seorin', '환불은 안 돼.'),
  line('player', '아직 얼마인지도 안 물어봤는데?'),
  line('seorin', '그러니까 살아서 가져와. 고장은 봐줄게.'),
];
/** 10장 관계 분기(바이블 8절). */
export const SERIN_ROUTE_ASK: Scene[] = [line('seorin', '너 내가 왜 도와주는지 알았잖아.'), line('player', '알았어. 그래서 고맙기도 했고, 무섭기도 했어.')];
export const SERIN_ROUTE_REPLY = { friend: '그래. 친구로 남자. 그게 제일 오래가.', slow: '천천히 가 보자. 급할 거 없잖아.', distance: '잠깐 거리를 두자. 다 끝나고 다시 얘기해.' } as const;
/** 7장 첫 편의점 방문 앞에 1회: 서린 사건 '수상한 방문객'. */
export const CH7_VISITOR: Scene[] = [cut('ch7-visitor.png', '계산대 너머로 같은 남자가 또 기웃거린다.'), line('seorin', '저 사람 또 왔어.')];
/** 7장 간파 배우기: 서린이 배송 기사를 소개한다. */
export const CH7_COURIER: Scene[] = [line('seorin', '박 기사님, 이 사람 좀 봐 줘요. 손 빠른 사람 잡는 법.'), line('courier', '한 판 치면서 보여 주지. 눈은 손이 아니라 더미를 봐.')];
/** 9장 뒤 첫 편의점 방문: 서린 사건 '오래된 선물'. */
export const GIFT_SCENES: Scene[] = [line('seorin', '이거, 네 아버지가 맡긴 건가 봐.'), cut('gift-watch.png', '낡은 회중시계. 뚜껑 안쪽에 작은 글씨.')];
/** 5장 편의점 앞 컵라면 셋(5장 진행 중 편의점 첫 방문 때 1회). */
export const CH5_RAMEN_SCENES: Scene[] = [
  cut('ch5-ramen.png', '편의점 앞 컵라면 셋.'),
  line('seorin', '저 사람은 웃을 때 대답을 안 해.'),
];
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

/** 장 승리 방식별 after 앞 장면과 플래그: 7장(잡기로 이기면 원본, 아니면 사본), 9장(접으면 끄덕임, 이기면 다른 한 줄). 9장은 접기·승리 모두 완료. */
export function chapterWinVariant(id: ChapterId, how: { caught?: boolean; folded?: boolean; untaught?: boolean; lost?: boolean }): { prefix: Scene[]; flags: string[] } {
  if (id === 'ch7') return how.caught ? { prefix: CH7_ORIGINAL, flags: ['ch7.original'] } : { prefix: CH7_COPY, flags: ['ch7.copy'] };
  if (id === 'ch9') {
    // 판에서 가르칠 순간이 한 번도 안 왔으면 after 앞에 "불리할 땐 접는 거다."로 가르치고 9장을 끝낸다(진행이 막히지 않게, 진 판이어도)
    const teach: Scene[] = how.untaught ? [line('father', FATHER_TEACH_FOLD)] : [];
    if (how.folded) return { prefix: CH9_FOLD, flags: ['ch9.folded'] };
    if (how.lost) return { prefix: teach, flags: ['ch9.taughtAfter'] };
    return { prefix: [...teach, ...CH9_WIN], flags: how.untaught ? ['ch9.won', 'ch9.taughtAfter'] : ['ch9.won'] };
  }
  return { prefix: [], flags: [] };
}
/** 8장 선택: 받아들이면 9장부터 태오 버튼이 다시 생긴다. */
export function ch8Choice(accept: boolean): { prefix: Scene[]; flags: string[] } { return accept ? { prefix: CH8_ACCEPT, flags: ['taeoh.accepted'] } : { prefix: CH8_DECLINE, flags: ['taeoh.declined'] }; }
