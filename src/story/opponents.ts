// 상대 프로필(바이블 1·6절). 판단 정책(초보/전략/쉬움)은 기존 순수 모듈(beginner.ts, ai.ts)과 래퍼(policies.ts)를 쓰고, 성격은 키워드와 몇 가지 필드로 적는다.
// F2에서 동작하는 성격: 마 사장의 도발(taunt + taunts, 화면이 taunt.ts로 처리). 역정보·속공·봉쇄 등은 F3 이후.
import { type Opponent, STRATEGIC } from '../ai.ts';
import { BEGINNER } from '../beginner.ts';
import type { CharacterId } from '../character.ts';
import { BARBER_LINES, type DialogSet } from '../dialog.ts';
import { MA_LINES, MA_TAUNTS, SILENT_LINES } from './lines.ts';
import { EASY } from './policies.ts';

export type OpponentId = 'barber' | 'bamcha' | 'ma' | 'bokhee' | 'bonggu' | 'stranger' | 'highroller' | 'sangcheol' | 'taeoh' | 'father' | 'jeongho' | 'yura' | 'sangman' | 'mujin';
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
  bokhee: strategic('bokhee', 'bokhee', ['역정보'], 1.0, '4장. 말풍선 역정보형', { money: 3000000 }),
  bonggu: strategic('bonggu', 'bonggu', ['속공'], 1.0, '5장. 속공형. 생각 시간 제한', { turnLimitMs: 8000, money: 40000000 }),
  stranger: { id: 'stranger', characterId: 'stranger', policy: 'easy', traits: ['중상'], sharpness: 0.8, thinkMs: 400, lines: SILENT_LINES, note: '일반 상대(목욕탕 등). 초보·전략 50:50 래퍼로 쉬운 상대. 소지금은 내 소지금의 1.5배' },
  highroller: strategic('highroller', 'stranger', ['중상'], 1.5, '6장 익명의 고액 판 상대(중상). 판이 크고 눈이 많아 의심도가 두 배로 오른다', { money: 120000000 }),
  sangcheol: strategic('sangcheol', 'sangcheol', ['속임수'], 1.2, '7장. 속임수형. 의심도 시스템 본격 등장', { money: 12000000 }),
  taeoh: strategic('taeoh', 'taeoh', ['학습'], 1.3, '8장. 도윤의 기술을 알고 견제(학습형)', { money: 2000000 }),
  father: strategic('father', 'father', ['조급유도'], 0, '9장. 도윤의 조급함을 끌어내는 판'),
  jeongho: strategic('jeongho', 'jeongho', ['보수'], 1.5, '10장. 보수형. 7점에 무조건 스톱, 피박 회피 최우선', { money: 50000000 }),
  yura: strategic('yura', 'yura', ['역정보'], 1.5, '10장. 역정보 강화형 + 흔들기 블러핑', { money: 50000000 }),
  sangman: strategic('sangman', 'sangman', ['봉쇄'], 1.5, '10장. 봉쇄형(대결당 3회)', { money: 50000000 }),
  mujin: strategic('mujin', 'mujin', ['적응'], 2.0, '11장. 3단계 적응형', { money: 300000000 }),
};
export const OPPONENT_IDS = Object.keys(OPPONENTS) as OpponentId[];
export const isOpponentId = (v: unknown): v is OpponentId => typeof v === 'string' && v in OPPONENTS;

/** 프로필 → 판단 정책 객체. 규칙·판단 로직은 기존 모듈 그대로. 도발 래퍼는 화면이 판 상태(provoked)를 넘겨 씌운다. */
export function resolveOpponent(p: OpponentProfile): Opponent { return p.policy === 'beginner' ? BEGINNER : p.policy === 'easy' ? EASY : STRATEGIC; }
