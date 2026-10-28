// 장소 데이터(바이블 2절). 여정 지도의 노드이며, 열리는 시점은 챕터 id로 적는다. Phaser에 의존하지 않는다.
import type { ChapterId } from './chapters.ts';

export type PlaceId = 'barber' | 'home' | 'store' | 'bath' | 'market' | 'harbor' | 'billiards' | 'hotel';

export type Place = {
  id: PlaceId;
  name: string;
  /** 할 수 있는 일(바이블 2절 그대로, 안내용 글자). */
  actions: string;
  /** 열리는 시점(바이블 2절 표의 "N장"): 'start'면 처음부터. 실제 해금은 앞 장의 unlocks(또는 집처럼 그 장의 unlocks)로 이뤄지고, 이 값은 "N장에서 열림" 표시와 정합성 검사에 쓴다. */
  opensAt: 'start' | ChapterId;
};

/** 지도 표시 순서(위 → 아래). 이야기 진행 순서와 같다. */
export const PLACES: Record<PlaceId, Place> = {
  barber: { id: 'barber', name: '대성이발관', actions: '기본 기술 습득, 연습 대결, 대식 대화', opensAt: 'start' },
  home: { id: 'home', name: '집', actions: '휴식(집중력 전부 회복, 하루 경과), 기술 장착·장비 2칸, 연습 대결(돈 없음), 아버지 물건 조사(단서)', opensAt: 'ch1' },
  store: { id: 'store', name: '편의점', actions: '회복품·장비 구매, 서린 대화·지원·이벤트, 소문', opensAt: 'ch2' },
  bath: { id: 'bath', name: '목욕탕 뒤', actions: '일반 대결(소액), 마 사장', opensAt: 'ch3' },
  market: { id: 'market', name: '중앙시장', actions: '일반 대결, 심부름, 복희', opensAt: 'ch4' },
  harbor: { id: 'harbor', name: '항구', actions: '일반 대결(고액), 강봉구, 태오', opensAt: 'ch5' },
  billiards: { id: 'billiards', name: '당구장', actions: '태오 재대결', opensAt: 'ch8' },
  hotel: { id: 'hotel', name: '백운호텔', actions: '아버지, 초대전 3문지기, 백무진', opensAt: 'ch9' },
};
export const PLACE_IDS = Object.keys(PLACES) as PlaceId[];
export const isPlaceId = (v: unknown): v is PlaceId => typeof v === 'string' && v in PLACES;
