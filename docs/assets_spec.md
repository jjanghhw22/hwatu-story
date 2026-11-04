# 에셋 명세 (assets_spec)

디자인 개편 단계마다 추가로 필요한 그림·소리 에셋을 여기에 적는다. 각 항목은 파일 경로, 크기(px), 형식, 쓰이는 화면, 자리 표시 대체물을 함께 적는다.
토큰·서체는 에셋이 아니라 코드다: 색·글자 스타일은 `src/ui/theme.ts`, 공통 부품은 `src/ui/components.ts`, 웹폰트(Noto Serif KR·Noto Sans KR)는 `index.html`의 Google Fonts 로드를 보라.

## 1단계 — 디자인 토큰·공통 컴포넌트 (v0.27, 요청 13)

추가할 에셋 없음.

## 2단계 — 프롤로그 4컷·1장 커버 (요청 15)

아직 없는 그림 5장. 파일이 생길 때까지 게임은 theme panel 색 배경 + 글자 연출로 대체한다(의도된 폴백, 재요청 없음).

| 파일 | 크기(px) | 투명배경 | 내용 |
| --- | --- | --- | --- |
| `public/assets/story/prologue-1.png` | 720×480 | 아니오 | 프롤로그 1컷 — 밤, 걸려 온 전화 한 통 |
| `public/assets/story/prologue-2.png` | 720×480 | 아니오 | 프롤로그 2컷 — 아버지의 수선집 앞(셔터 내려감) |
| `public/assets/story/prologue-3.png` | 720×480 | 아니오 | 프롤로그 3컷 — 쌓인 독촉장과 멈춘 재봉틀 |
| `public/assets/story/prologue-4.png` | 720×480 | 아니오 | 프롤로그 4컷 — 가방을 메고 고향 거리로 들어서는 도윤 뒷모습 |
| `public/assets/story/cover-ch1.png` | 720×240 | 아니오 | 1장 커버 — 대성이발관 외관, 비 갠 오후, 간판과 회전등 |
