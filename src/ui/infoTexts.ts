// 메뉴의 규칙 안내·제작자·개발 정보에 쓰는 글자(대결 화면과 여정 지도가 함께 쓴다). THIRD_PARTY_NOTICES.md와 같은 내용을 유지한다.
import { GO_STOP_THRESHOLD } from '../game';
import type { ModalLine } from './modals';
import { COLORS } from './widgets';

/** 빌드 표식. 메뉴 > 개발 정보에서만 보인다. 규칙·단계가 바뀔 때마다 올린다. */
export const BUILD_TAG = 'v0.23 F4';
/** 미구현 항목. 일반 화면에는 두지 않고 메뉴의 규칙 안내·개발 정보에서만 보여준다. */
export const NOT_IMPLEMENTED = '멍박·총통·첫뻑·연속뻑 미적용';

export const CREDITS: ModalLine[] = [
  { text: '화투 도안', size: 18, color: COLORS.gold },
  { text: '원작: Marcus Richert, based on artwork by Louie Mantia, Jr.\nSVG 최적화: Spenĉjo', size: 15, color: COLORS.text },
  { text: '출처: https://commons.wikimedia.org/wiki/File:Hwatu_overview.svg\n라이선스: CC BY-SA 4.0', size: 13 },
  { text: '· 전체 도안을 48장 PNG로 분리, 흰 바탕 추가, 11월 오동·12월 비 순서로 연결, 붉은 뒷면 추가', size: 13, color: COLORS.text },
  { text: '글꼴', size: 18, color: COLORS.gold },
  { text: '나눔고딕·나눔붓 (NHN Corporation, SIL Open Font License 1.1)\nassets/fonts/OFL.txt', size: 13, color: COLORS.text },
  { text: '엔진: Phaser 3 (MIT). 효과음은 외부 음원 없이 합성. 캐릭터 그림은 소유자 제공(장대식·한도윤 기본 표정), 나머지 인물·컷 그림은 자리 표시. 자세한 내용은 THIRD_PARTY_NOTICES.md.', size: 13 },
];

/** 규칙 안내(메뉴). 플레이에 필요한 요약만. */
export const RULES: ModalLine[] = [
  { text: `기본 점수 ${GO_STOP_THRESHOLD}점부터 고/스톱. 고는 기본 점수가 그때보다 올라야 다시 고를 수 있고, 마지막 행동에서는 고를 할 수 없다. 양쪽 행동이 다 끝나면 나가리.`, size: 15, color: COLORS.text },
  { text: '광 3장 3점(비광 포함 2점)·4장 4점·5장 15점. 열끗·띠 5장부터 1점씩, 고도리 +5, 홍단·청단·초단 +3. 피 10장부터 1점씩(쌍피 2장).', size: 15, color: COLORS.text },
  { text: '쪽·따닥·쓸·폭탄·뻑 회수는 상대 피 1장(자뻑 회수 2장). 피박: 상대 피 1~7장 ×2. 광박: 상대 광 0장 ×2. 고박: 고한 뒤 지면 ×2. 흔들기·폭탄 월마다 ×2.', size: 15, color: COLORS.text },
  { text: '조작: 손패를 누르면 한 장 내기. 폭탄 표시 카드는 세 장 폭탄, 흔들기 표시 카드는 세 장 공개 뒤 한 장 내기. 붉은 기회 패는 손패 없이 더미만 뒤집기. 획득 패를 누르면 크게 본다.', size: 15, color: COLORS.text },
  { text: '기술: 집중력을 써서 쓴다(눈썰미 20 = 더미 윗장 1장 보기, 판당 2회). 집중력은 집에서 쉬면 전부 회복된다. 0이어도 지지 않는다.', size: 15, color: COLORS.text },
  { text: NOT_IMPLEMENTED + '. 보너스 패 없음.', size: 13 },
];
