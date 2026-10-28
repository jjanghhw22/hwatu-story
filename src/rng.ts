// 재현 가능한 난수(mulberry32). AI 판단용 난수와 덱 셔플용 난수는 서로 다른 인스턴스를 쓴다.
export type Rng = () => number;

/** seed로 고정된 0 이상 1 미만의 난수 생성기. 같은 seed면 같은 수열. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 이상 n 미만의 정수. */
export function pickIndex(rng: Rng, n: number): number {
  if (n <= 0) throw new RangeError('빈 목록에서 고를 수 없습니다.');
  return Math.min(n - 1, Math.floor(rng() * n));
}
