// 캐릭터 데이터. 초상화 상태(표정)와 그림 표시 설정을 데이터로 분리해, 그림이 늘어나면 파일 경로와 수치만 바꾸면 된다.
// 이 모듈은 Phaser에 의존하지 않는다(순수 계산은 테스트로 검증).
export type Mood = 'normal' | 'surprised' | 'flustered' | 'happy' | 'defeated';

export type MoodInfo = {
  label: string;
  /** 초상화 옆 작은 배지에 쓰는 글자(표정 그림이 없을 때도 상태가 보이도록 유지). */
  glyph: string;
  /** 상태별 작은 움직임(그림이 있든 없든 동작). */
  motion: 'none' | 'bounce' | 'shake' | 'bob' | 'sink';
  /** 표정으로 머무는 시간(ms). 지나면 평상시로. 0이면 유지. */
  holdMs: number;
};
export const MOODS: Record<Mood, MoodInfo> = {
  normal: { label: '평상시', glyph: '', motion: 'none', holdMs: 0 },
  surprised: { label: '놀람', glyph: '!', motion: 'bounce', holdMs: 2500 },
  flustered: { label: '당황', glyph: '~', motion: 'shake', holdMs: 2500 },
  happy: { label: '기쁨', glyph: '♪', motion: 'bob', holdMs: 2500 },
  defeated: { label: '패배', glyph: '…', motion: 'sink', holdMs: 0 },
};

/**
 * 한 장의 원본 그림을 어느 부분·어떤 크기로 보일지.
 * focus: 표시 영역의 중심에 둘 원본 안의 지점(가로·세로 0~1 비율). zoom: 원본의 짧은 변을 몇 등분한 길이를 표시 영역의 지름(정사각형 한 변)으로 삼을지.
 * 예) zoom 2.3이면 짧은 변의 1/2.3 크기 정사각형을 잘라 보인다. 가로·세로 같은 배율이라 비율이 유지된다.
 */
export type ImageFit = { focus: readonly [number, number]; zoom: number };

export type Character = {
  key: string;
  name: string;
  /** 그림을 읽지 못했을 때 자리 표시 초상화에 쓰는 글자. */
  initial: string;
  /**
   * 표정별 그림 파일(public 기준 경로). 지금은 각 인물의 기본 표정(normal) 한 장뿐이다.
   * 없는 표정은 normal 그림으로 대신하고, normal도 읽지 못하면 자리 표시(실루엣·이니셜)로 돌아간다.
   */
  portraits: Partial<Record<Mood, string>>;
  /** 정보 패널의 작은 원형 초상화: 얼굴과 어깨 중심으로 잘라 보인다. 인물마다 여기서만 조정한다. */
  portraitFit: ImageFit;
  /** 대화창·컷인용 상반신 표시(같은 원본을 넓게). 아직 쓰는 화면은 없고 설정만 분리해 둔다. */
  bustFit: ImageFit;
};

export const CHARACTER_ASSET_DIR = 'assets/characters';

/** 첫 상대. 승인된 2D 기본 표정 한 장(barber-neutral.png). 다른 표정 그림은 아직 없다. */
export const BARBER: Character = {
  key: 'barber', name: '이발소 주인', initial: '이',
  portraits: { normal: `${CHARACTER_ASSET_DIR}/barber-neutral.png` },
  portraitFit: { focus: [0.39, 0.25], zoom: 2.3 },
  bustFit: { focus: [0.5, 0.45], zoom: 1.15 },
};
/** 플레이어. 승인된 2D 기본 표정 한 장(hero-neutral.png). */
export const PLAYER: Character = {
  key: 'player', name: '나', initial: '나',
  portraits: { normal: `${CHARACTER_ASSET_DIR}/hero-neutral.png` },
  portraitFit: { focus: [0.5, 0.255], zoom: 2.2 },
  bustFit: { focus: [0.5, 0.45], zoom: 1.15 },
};

export function portraitTextureKey(c: Character, mood: Mood) { return `portrait-${c.key}-${mood}`; }

/** 표정 그림 키 후보: 요청한 표정 → 기본 표정. 첫 번째로 존재하는 것을 쓴다. */
export function portraitKeyCandidates(c: Character, mood: Mood): string[] {
  const moods: Mood[] = mood === 'normal' ? ['normal'] : [mood, 'normal'];
  return moods.filter(m => c.portraits[m]).map(m => portraitTextureKey(c, m));
}

export type CropRect = { sx: number; sy: number; sw: number; sh: number };

/**
 * 원본 그림(imgW×imgH)에서 잘라낼 정사각형. 한 변은 짧은 변 / zoom이고 focus가 중심에 오되,
 * 원본 밖으로 나가지 않도록 밀어 넣는다(밖으로 나가면 빈 부분이 생기거나 브라우저가 비율을 깨뜨릴 수 있다).
 * 정사각형을 정사각형 표시 영역에 그리므로 가로·세로 배율이 같다 → 얼굴이 찌그러지지 않는다.
 */
export function cropSquare(imgW: number, imgH: number, fit: ImageFit): CropRect {
  const side = Math.min(imgW, imgH) / Math.max(fit.zoom, 1);
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  const sx = clamp(fit.focus[0] * imgW - side / 2, imgW - side);
  const sy = clamp(fit.focus[1] * imgH - side / 2, imgH - side);
  return { sx, sy, sw: side, sh: side };
}
