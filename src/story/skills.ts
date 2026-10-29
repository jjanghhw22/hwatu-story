// 기술 데이터(바이블 3절, 8개). 이번 단계(F1)에서 동작하는 것은 눈썰미(eye) 하나이며 나머지는 데이터만 있다.
// 규칙 엔진은 기술을 모른다. 화면 계층이 집중력을 차감하고 공개 정보를 읽거나 정해진 동작을 요청한다.
export type SkillId = 'eye' | 'calmFace' | 'lookAway' | 'swap' | 'readThrough' | 'fold' | 'handSwap' | 'memory';
export type SkillKind = 'honest' | 'cheat';

export type Skill = {
  id: SkillId;
  name: string;
  /** 좁은 버튼용 짧은 이름. */
  short: string;
  /** 집중력 비용. */
  cost: number;
  /** 사용 시 오르는 의심도(정직 기술은 0). */
  suspicion: number;
  kind: SkillKind;
  /** 효과(바이블 표의 게임 용어 그대로). */
  desc: string;
  /** 얻는 곳. */
  source: string;
  /** 판당 사용 횟수. 바이블이 눈썰미만 "판당 2회"를 명시하고 나머지는 1회로 둔다(이후 단계에서 조정). */
  usesPerMatch: number;
  /** 희귀 기술(서린 사건으로만 열림). */
  rare?: boolean;
};

export const SKILLS: Record<SkillId, Skill> = {
  eye: { id: 'eye', name: '눈썰미', short: '눈썰미', cost: 20, suspicion: 0, kind: 'honest', desc: '더미 윗장 1장 보기(강화 시 2장, 판당 2회)', source: '1장 대식', usesPerMatch: 2 },
  calmFace: { id: 'calmFace', name: '태연한 얼굴', short: '태연', cost: 25, suspicion: 0, kind: 'honest', desc: '의심도 −30, 다음 상대 도발 1회 무효', source: '3장 마 사장', usesPerMatch: 1 },
  lookAway: { id: 'lookAway', name: '시선 돌리기', short: '시선', cost: 20, suspicion: 0, kind: 'honest', desc: '상대 손패의 월 3개 힌트 + 이번 턴 상대 역정보 무시 + 이 판의 다음 상대 말풍선에 (거짓)/(참) 표시', source: '4장 복희', usesPerMatch: 1 },
  swap: { id: 'swap', name: '바꿔치기', short: '바꿔', cost: 35, suspicion: 25, kind: 'cheat', desc: '내 손패 1장을 더미 윗장과 교환. 성공률 70%(행운의 동전으로 상승), 실패 시 의심도 +40', source: '5장 태오', usesPerMatch: 1 },
  readThrough: { id: 'readThrough', name: '간파', short: '간파', cost: 15, suspicion: 0, kind: 'honest', desc: '다음 상대 차례를 지켜본다. 그 차례에 속임수가 일어나면 2.5초 안에 "잡기"(상대 들통 → 판 몰수 승리)', source: '7장 서린 인맥(박 기사)', usesPerMatch: 2 },
  fold: { id: 'fold', name: '접기', short: '접기', cost: 30, suspicion: 0, kind: 'honest', desc: '내 차례에 그 판을 접는다: 상대 승리, 상대 기본 점수 그대로(최소 없음, 고·박·배수 없음). 상대가 고 중이면 못 쓴다', source: '9장 아버지', usesPerMatch: 1 },
  handSwap: { id: 'handSwap', name: '손바꿈', short: '손바꿈', cost: 45, suspicion: 45, kind: 'cheat', desc: '상대 손패 1장을 무작위로 내 손패 1장과 교환', source: '서린 4% 사건 → 고물상 삼촌 대결', usesPerMatch: 1, rare: true },
  memory: { id: 'memory', name: '기억력', short: '기억', cost: 40, suspicion: 0, kind: 'honest', desc: '더미 아래 3장 순서를 판 시작 시 확인', source: '서린 1% 사건 → 시장 노인', usesPerMatch: 1, rare: true },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const isSkillId = (v: unknown): v is SkillId => typeof v === 'string' && v in SKILLS;
