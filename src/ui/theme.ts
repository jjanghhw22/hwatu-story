// 디자인 토큰(요청 13): 색·서체·글자 스타일을 한곳에서 정한다. 앞으로 모든 화면은 색·서체를 하드코딩하지 않고 여기서 가져온다.
// 기존 widgets.ts의 COLORS/FONT는 점진 교체 대상 — 새 공통 부품(components.ts)과 새 화면은 이 토큰만 쓴다.
import type Phaser from 'phaser';

export const COLORS = {
  /** 화면 바탕. */
  bg: '#14120E',
  /** 패널 배경과 테두리. */
  panel: '#2A2217', panelBorder: '#4A3C28',
  /** 강조(금)와 그 어두운 단계. */
  gold: '#C9A24B', goldDim: '#8A6F38',
  /** 경고·위험. */
  red: '#C0392B',
  /** 본문 글자와 보조 글자. */
  text: '#E8E0D0', textDim: '#9A8F7A',
  /** 그림자·모달 어둡기. */
  shadow: '#000000',
} as const;

/** '#RRGGBB' 토큰 → Phaser 숫자 색(사각형·Graphics 채움용). */
export const colorNum = (hex: string): number => Number.parseInt(hex.slice(1), 16);

export const FONTS = {
  /** 제목·챕터명·대사 강조. */
  title: '"Noto Serif KR", serif',
  /** 본문·수치·버튼. */
  body: '"Noto Sans KR", sans-serif',
} as const;

/** Phaser Text 스타일. 쓰임: h1 큰 제목, h2 소제목, body 본문·버튼, caption 보조 설명, danger 경고. */
export const TEXT_STYLES = {
  h1: { fontFamily: FONTS.title, fontSize: 36, color: COLORS.gold },
  h2: { fontFamily: FONTS.title, fontSize: 26, color: COLORS.text },
  body: { fontFamily: FONTS.body, fontSize: 20, color: COLORS.text },
  caption: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textDim },
  danger: { fontFamily: FONTS.body, fontSize: 18, color: COLORS.red },
} as const satisfies Record<string, Phaser.Types.GameObjects.Text.TextStyle>;
