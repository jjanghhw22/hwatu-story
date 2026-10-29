// 상대 프로필(바이블 1·6절). 판단 정책(초보/전략/쉬움)은 기존 순수 모듈(beginner.ts, ai.ts)과 래퍼(policies.ts)를 쓰고, 성격은 키워드와 몇 가지 필드로 적는다.
// F2에서 동작하는 성격: 마 사장의 도발(taunt + taunts, 화면이 taunt.ts로 처리). 역정보·속공·봉쇄 등은 F3 이후.
import { type Opponent, STRATEGIC } from '../ai.ts';
import { BEGINNER } from '../beginner.ts';
import type { CharacterId } from '../character.ts';
import { BARBER_LINES, type DialogSet } from '../dialog.ts';
import { BOKHEE_LINES, FATHER_LINES, JEONGHO_LINES, MA_LINES, MA_TAUNTS, MUJIN_LINES, SANGCHEOL_LINES, SANGMAN_LINES, SILENT_LINES, TAEOH_LINES, YURA_BLUFF, YURA_LINES } from './lines.ts';
import type { BluffLines } from './bluff.ts';
import type { CheatSpec } from './cheat.ts';
import { conservativePolicy, provokedPolicy } from './policies.ts';
import { EASY } from './policies.ts';

export type OpponentId = 'barber' | 'bamcha' | 'ma' | 'bokhee' | 'bonggu' | 'stranger' | 'merchant' | 'courier' | 'highroller' | 'sangcheol' | 'taeoh' | 'father' | 'jeongho' | 'yura' | 'sangman' | 'mujin';
/** beginner: 초보 정책(항상 스톱). strategic: 전략 정책. easy: 초보·전략 50:50 래퍼(일반 상대). */
export type OpponentPolicy = 'beginner' | 'strategic' | 'easy';
/** 성격 키워드(바이블 6절). 동작은 이후 단계. */
export type Trait = '초보' | '도발' | '역정보' | '속공' | '중상' | '속임수' | '학습' | '조급유도' | '보수' | '봉쇄' | '적응';

export type OpponentProfile = {
  id: OpponentId;
  characterId: CharacterId;
  policy: OpponentPolicy;
  traits: Trait[];
  /** 이 상대와 싸울 때 플레이어의 집중력 최대치(바이블 6절). 없으면 진행 상태의 값. */
  focusMax?: number;
  /** 도발형: 고/스톱 창 직전 말풍선으로 고를 유도하고, 응하면 고/스톱 정책이 공격적으로 바뀐다(policies.provokedPolicy). */
  taunt?: boolean;
  /** 도발 말풍선 목록(lines.ts). */
  taunts?: readonly string[];
  /** 속임수형(뱀눈·백무진): 상대 차례마다 perTurn 확률로 손패 1장을 더미 윗장과 바꾼다(판당 maxPerMatch회). 간파로 잡을 수 있다. */
  cheat?: CheatSpec;
  /** 학습형(태오): 같은 기술 두 번 쓰면 잠그고, 3턴 연속 같은 분류를 먹으면 저지를 강화한다. */
  learner?: boolean;
  /** 아버지: 내 실제 손패의 월을 짚는 말풍선(이 상대만 비공개 정보 허용), 접기 가르치기, 7점이면 거의 항상 고(최대 eagerGo고). */
  readsHand?: boolean; teachesFold?: boolean; eagerGo?: number;
  /** 보수형(민정호): 고/스톱 가능하면 항상 스톱, 저지 ×1.3·박 완화 ×2. */
  conservative?: boolean;
  /** 역정보 말풍선 묶음(없으면 복희 것). */
  bluffLines?: BluffLines;
  /** 차유라: 자기 차례 이 확률로 가짜 흔들기 예고(말풍선 + 종소리만). */
  fakeShake?: number;
  /** 구상만: 판당 봉쇄 횟수(내 기술 처음 N번 무효, 집중력은 소모). */
  blocks?: number;
  /** 백무진: 한 판 안에서 3단계(king.ts). */
  king?: boolean;
  /** 역정보형: 상대 차례 시작 때 이 확률로 실제 상태의 반대를 말한다(0~1). 없으면 말풍선 없음. */
  bluff?: number;
  /** 속공형: 내 턴 생각 시간 제한(ms). 없으면 제한 없음. */
  turnLimitMs?: number;
  /** 눈썰미 배율(0.5~2.0): 의심도 상승폭 = 기본값 × sharpness. 0이면 오르지 않는다(연습·이야기 판). */
  sharpness: number;
  /** 상대 소지금(원, 표시용. 바이블 분위기대로 임의 값). 없으면 일반 상대 = 내 소지금의 1.5배. 승패로 저장하지 않는다. */
  money?: number;
  /** 상대가 패를 고르는 데 보이는 시간(ms). 연출 줄이기에서는 절반. */
  thinkMs: number;
  /** 상황별 대사(lines.ts). 장대식은 dialog.ts의 BARBER_LINES. */
  lines: DialogSet;
  /** 바이블의 한 줄 설명. */
  note: string;
};

const strategic = (id: OpponentId, characterId: CharacterId, traits: Trait[], sharpness: number, note: string, extra: Partial<OpponentProfile> = {}): OpponentProfile =>
  ({ id, characterId, policy: 'strategic', traits, sharpness, thinkMs: 400, lines: SILENT_LINES, note, ...extra });

/** 의심도 배율(요청 07): 마 사장 0.6, 밤차·일반 0.8, 복희·봉구 1.0, 큰 판 1.5, 뱀눈 1.2, 태오 1.3, 문지기 1.5, 백무진 2.0, 대식·아버지 0. */
export const OPPONENTS: Record<OpponentId, OpponentProfile> = {
  barber: { id: 'barber', characterId: 'barber', policy: 'beginner', traits: ['초보'], sharpness: 0, thinkMs: 400, lines: BARBER_LINES, note: '1장 초보 정책(현재 BEGINNER). 항상 스톱' },
  bamcha: { id: 'bamcha', characterId: 'bamcha', policy: 'beginner', traits: ['초보'], sharpness: 0.8, money: 500000, thinkMs: 400, lines: SILENT_LINES, note: '2장 연습 상대(초보+), 소액' },
  ma: strategic('ma', 'ma', ['도발'], 0.6, '3장. 도발형. 고 유도, 판돈 올리기', { taunt: true, taunts: MA_TAUNTS, lines: MA_LINES, money: 8500000 }),
  bokhee: strategic('bokhee', 'bokhee', ['역정보'], 1.0, '4장. 말풍선 역정보형(bluff 0.6)', { money: 3000000, bluff: 0.6, lines: BOKHEE_LINES }),
  bonggu: strategic('bonggu', 'bonggu', ['속공'], 1.0, '5장. 속공형. 내 턴 8초 제한, 봉구도 빨리 낸다', { turnLimitMs: 8000, money: 40000000, thinkMs: 150 }),
  stranger: { id: 'stranger', characterId: 'stranger', policy: 'easy', traits: ['중상'], sharpness: 0.8, thinkMs: 400, lines: SILENT_LINES, note: '일반 상대(목욕탕 등). 초보·전략 50:50 래퍼로 쉬운 상대. 소지금은 내 소지금의 1.5배' },
  highroller: strategic('highroller', 'stranger', ['중상'], 2.0, '6장 익명의 고액 판 상대(중상). 판이 크고 눈이 많아 의심도가 두 배로 오른다', { money: 120000000 }),
  merchant: { id: 'merchant', characterId: 'merchant', policy: 'easy', traits: ['초보'], sharpness: 0, thinkMs: 400, lines: SILENT_LINES, note: '4장 심부름 상대(건어물 상인). 연습 한 판, 판돈 0' },
  courier: { id: 'courier', characterId: 'courier', policy: 'easy', traits: ['초보'], sharpness: 0, thinkMs: 400, lines: SILENT_LINES, note: '7장 간파를 가르치는 배송 기사(연습 한 판)' },
  sangcheol: strategic('sangcheol', 'sangcheol', ['속임수'], 1.2, '7장. 속임수형(차례마다 35%, 판당 3회). 간파로 잡으면 판 몰수', { money: 12000000, cheat: { perTurn: 0.35, maxPerMatch: 3 }, lines: SANGCHEOL_LINES }),
  taeoh: strategic('taeoh', 'taeoh', ['학습'], 1.3, '8장. 학습형: 같은 기술 두 번이면 잠금, 연속 같은 분류는 저지 강화', { money: 2000000, learner: true, lines: TAEOH_LINES }),
  father: strategic('father', 'father', ['조급유도'], 0, '9장. 7점이면 거의 항상 고(최대 3고), 손패 읽기, 접기를 가르친다', { readsHand: true, teachesFold: true, eagerGo: 3, lines: FATHER_LINES }),
  jeongho: strategic('jeongho', 'jeongho', ['보수'], 1.5, '10장. 보수형: 고/스톱 가능하면 항상 스톱, 저지 ×1.3·박 완화 ×2', { money: 50000000, conservative: true, lines: JEONGHO_LINES }),
  yura: strategic('yura', 'yura', ['역정보'], 1.5, '10장. 역정보 0.8 + 가짜 흔들기 예고 25%', { money: 50000000, bluff: 0.8, bluffLines: YURA_BLUFF, fakeShake: 0.25, lines: YURA_LINES }),
  sangman: strategic('sangman', 'sangman', ['봉쇄'], 1.5, '10장. 봉쇄형: 내 기술 처음 3번 무효(집중력은 소모)', { money: 50000000, blocks: 3, lines: SANGMAN_LINES }),
  mujin: strategic('mujin', 'mujin', ['적응'], 2.0, '11장. 한 판 안에서 3단계(견제 → 흔들기 → 왕의 손)', { money: 300000000, king: true, lines: MUJIN_LINES }),
};
export const OPPONENT_IDS = Object.keys(OPPONENTS) as OpponentId[];
export const isOpponentId = (v: unknown): v is OpponentId => typeof v === 'string' && v in OPPONENTS;

/** 프로필 → 판단 정책 객체. 규칙·판단 로직은 기존 모듈 그대로. 도발 래퍼는 화면이 판 상태(provoked)를 넘겨 씌운다. */
export function resolveOpponent(p: OpponentProfile): Opponent {
  const base = p.policy === 'beginner' ? BEGINNER : p.policy === 'easy' ? EASY : STRATEGIC;
  // 조급 유도(아버지): 7점이면 거의 항상 고, 최대 eagerGo고
  if (p.conservative) return conservativePolicy(base);
  return p.eagerGo ? provokedPolicy(base, () => true, p.eagerGo) : base;
}
