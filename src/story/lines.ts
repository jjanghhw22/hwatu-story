// 상대별 말풍선 데이터. dialog.ts(DialogPolicy·BARBER_LINES)는 고치지 않고, 여기의 DialogSet을 DialogPolicy에 넣어 쓴다.
import type { DialogSet } from '../dialog.ts';

/** 말하지 않는 상대. */
export const SILENT_LINES: DialogSet = { playerJjok: [], playerSseul: [], playerBomb: [], playerCombo: [], aiPpeok: [], playerGo: [], playerWin: [], aiWin: [], draw: [] };

/** 마 사장(3장, 도발형). 판 결과 대사만 두고 나머지는 도발 말풍선(MA_TAUNTS)으로 말한다. */
export const MA_LINES: DialogSet = {
  ...SILENT_LINES,
  playerGo: ['그래, 그게 한기석 아들이지.'],
  playerWin: ['오늘은 네가 가져가라. 장부는 저기 있다.'],
  aiWin: ['돈 없는 손님은 언제든 환영이야.'],
  draw: ['싱겁네. 한 판 더 하지.'],
};
/**
 * 마 사장 도발(바이블 3장: 도윤이 7점을 넘으면 고를 유도). 고/스톱 창이 뜨기 직전에 하나를 띄운다.
 * 첫 두 줄은 바이블·요청문 문장, 나머지 둘은 같은 결(아버지 이름을 걸어 고를 부추김)로 보탰다.
 */
export const MA_TAUNTS: readonly string[] = [
  '한기석 아들이 이렇게 겁이 많았나?',
  '여기서 접으면 네 아버지랑 똑같지.',
  '만 원짜리 판에서 손이 떨리면 어디 가서 치겠어.',
  '네 아버지는 7점에서 멈추는 사람이 아니었어.',
];
