// 상대 캐릭터 대사(데이터)와 표시 정책. 화면과 분리된 순수 모듈.
// 매 턴 말하지 않고 사건이 났을 때만, 최소 턴 간격을 지켜 일부만 말한다. 결과 대사는 간격 예외.
import type { Mood } from './character.ts';
import type { Rng } from './rng.ts';

export type DialogEvent = 'playerJjok' | 'playerSseul' | 'playerBomb' | 'playerCombo' | 'aiPpeok' | 'playerGo' | 'playerWin' | 'aiWin' | 'draw';
export type DialogSet = Record<DialogEvent, readonly string[]>;

/** 첫 상대 '이발소 주인'의 상황별 대사. */
export const BARBER_LINES: DialogSet = {
  playerJjok: ['허, 잘 붙네.'],
  playerSseul: ['싹 가져가는구먼.'],
  playerBomb: ['그걸 숨겨 뒀어?'],
  playerCombo: ['오, 제법인데?'],
  aiPpeok: ['아이고, 붙었네.', '허, 이게 붙네.'],
  playerGo: ['배짱은 있구먼.', '더 가겠다고?'],
  playerWin: ['좋아. 다음 얘길 해주지.', '손끝이 제법 살아 있구먼.'],
  aiWin: ['오늘은 여기까지. 또 오게.'],
  draw: ['비겼구먼. 한 판 더 하지.'],
};
/** 사건별 상대 표정. */
export const EVENT_MOOD: Record<DialogEvent, Mood> = {
  playerJjok: 'surprised', playerSseul: 'flustered', playerBomb: 'surprised', playerCombo: 'surprised',
  aiPpeok: 'flustered', playerGo: 'surprised', playerWin: 'defeated', aiWin: 'happy', draw: 'normal',
};
/** 간격 없이 항상 말하는 사건(판 결과). */
const RESULT_EVENTS: readonly DialogEvent[] = ['playerWin', 'aiWin', 'draw'];

export class DialogPolicy {
  /** 마지막으로 말한 턴 번호. 새 판에서 reset(). */
  private lastTurn = -Infinity;
  private lines: DialogSet;
  private minGap: number;
  constructor(lines: DialogSet = BARBER_LINES, minGap = 3) { this.lines = lines; this.minGap = minGap; }
  reset() { this.lastTurn = -Infinity; }
  /**
   * 사건이 났을 때 말할 대사(없으면 null). turn은 GameState.turn. 같은 사건에 여러 대사가 있으면 rng로 하나를 고른다.
   * 직전 대사와의 간격이 minGap 미만이면 결과 대사가 아닌 한 말하지 않는다.
   */
  pick(event: DialogEvent, turn: number, rng: Rng = Math.random): string | null {
    const list = this.lines[event];
    if (!list || list.length === 0) return null;
    if (!RESULT_EVENTS.includes(event) && turn - this.lastTurn < this.minGap) return null;
    this.lastTurn = turn;
    return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  }
}
