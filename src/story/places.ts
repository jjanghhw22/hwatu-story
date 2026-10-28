// 장소 데이터(바이블 2절). 여정 지도의 노드이며, 열리는 시점은 챕터 id로 적는다. Phaser에 의존하지 않는다.
import { type ChapterId, isChapterImplemented } from './chapters.ts';

export type PlaceId = 'barber' | 'home' | 'store' | 'bath' | 'market' | 'harbor' | 'billiards' | 'hotel';

export type Place = {
  id: PlaceId;
  name: string;
  /** 할 수 있는 일(바이블 2절 그대로, 안내용 글자). */
  actions: string;
  /** 일반 대결 판돈: 최종 점수 1점당 원(바이블 3절 "돈"). 0이면 돈을 걸지 않는다(이발소·집). */
  stakePerPoint: number;
  /** 열리는 시점(바이블 2절 표의 "N장"): 'start'면 처음부터. 실제 해금은 앞 장의 unlocks(또는 집처럼 그 장의 unlocks)로 이뤄지고, 이 값은 "N장에서 열림" 표시와 정합성 검사에 쓴다. */
  opensAt: 'start' | ChapterId;
};

/** 지도 표시 순서(위 → 아래). 이야기 진행 순서와 같다. */
export const PLACES: Record<PlaceId, Place> = {
  barber: { id: 'barber', name: '대성이발관', actions: '기본 기술 습득, 연습 대결, 대식 대화', stakePerPoint: 0, opensAt: 'start' },
  home: { id: 'home', name: '집', actions: '휴식(집중력 전부 회복, 하루 경과), 기술 장착·장비 2칸, 연습 대결(돈 없음), 아버지 물건 조사(단서)', stakePerPoint: 0, opensAt: 'ch1' },
  store: { id: 'store', name: '편의점', actions: '회복품·장비 구매, 서린 대화·지원·이벤트, 소문', stakePerPoint: 0, opensAt: 'ch2' },
  bath: { id: 'bath', name: '목욕탕 뒤', actions: '일반 대결(소액), 마 사장', stakePerPoint: 10000, opensAt: 'ch3' },
  market: { id: 'market', name: '중앙시장', actions: '일반 대결, 심부름, 복희', stakePerPoint: 20000, opensAt: 'ch4' },
  harbor: { id: 'harbor', name: '항구', actions: '일반 대결(고액), 강봉구, 태오', stakePerPoint: 50000, opensAt: 'ch5' },
  billiards: { id: 'billiards', name: '당구장', actions: '태오 재대결', stakePerPoint: 0, opensAt: 'ch8' },
  hotel: { id: 'hotel', name: '백운호텔', actions: '아버지, 초대전 3문지기, 백무진', stakePerPoint: 200000, opensAt: 'ch9' },
};
export const PLACE_IDS = Object.keys(PLACES) as PlaceId[];
export const isPlaceId = (v: unknown): v is PlaceId => typeof v === 'string' && v in PLACES;
/** 장소의 이야기가 구현됐는지(열리는 장이 구현된 장인지). 진행 데이터상 열렸어도 구현 전이면 지도에서 잠긴 채 "N장에서 열림"으로 보인다. */
export function isPlaceReady(id: PlaceId): boolean { const at = PLACES[id].opensAt; return at === 'start' || isChapterImplemented(at); }
/** 일반 대결 입장 조건: 소지금이 판돈 × 7 이상(판돈 0이면 항상). */
export const MIN_STAKE_POINTS = 7;
export function canSit(money: number, stakePerPoint: number): boolean { return stakePerPoint <= 0 || money >= stakePerPoint * MIN_STAKE_POINTS; }
