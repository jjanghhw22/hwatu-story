# 제3자 저작물 고지 (THIRD PARTY NOTICES)

## 화투 카드 도안

- 원작: Marcus Richert, based on artwork by Louie Mantia, Jr.
- SVG 최적화: Spenĉjo
- 출처: https://commons.wikimedia.org/wiki/File:Hwatu_overview.svg
- 라이선스: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/
- 사용 파일: `hwatu-overview.svg`(원본, 프로젝트 루트), `public/assets/cards/card-00.png` ~ `card-47.png`, `public/assets/cards/back.png`, `public/assets/cards/cards.json`

### 이 프로젝트에서 수행한 분리·변환 내용
1. 원본 SVG(1326×732)를 수정하지 않고 그대로 읽어 `@resvg/resvg-js`로 3배 크기(3978×2196)로 래스터화했습니다.
2. 원본 안의 카드 테두리 도형(`id="a"`, 중심 기준 103.2×168.2)이 놓인 48개 위치를 기준으로 각 카드를 310×505 PNG로 잘라냈습니다. 도안은 카드별 그룹이 아니라 전체 좌표계에 그려져 있어, 동일 간격이 아닌 실제 테두리 좌표(12열×4행, 열 x = 51.6 … 1273.6, 행 y = 84.1 … 647.6)를 사용했습니다.
3. 원본의 카드 안쪽은 검은 윤곽선만 있고 채움이 없어(흰 종이 위에 놓이는 전제), 렌더 전에 각 카드 안쪽 크기(90.6×153.8)의 흰 사각형을 도안 뒤에 끼워 넣었습니다. 그림과 글씨는 변경하지 않았습니다.
4. 원본은 일본식 월 순서(11월=비, 12월=오동)이고 월 안의 카드 순서도 이 프로젝트의 데이터(광·띠·피·피 등)와 다르므로, 인덱스가 아니라 그림 내용 기준으로 이 프로젝트의 카드 ID(11월=오동, 12월=비)에 연결했습니다. 연결표는 `public/assets/cards/cards.json`과 `tools/split-cards.mjs`의 `MAP`에 있습니다.
5. 뒷면 `back.png`는 원본의 테두리 도형(`id="a"`) 모양만 가져와 안쪽을 진한 붉은색으로 채운 파생 도안입니다. 원본에는 뒷면 도안이 없습니다.
6. 재생성: 프로젝트 루트에서 `node tools/split-cards.mjs`.

위 파생물(잘라낸 PNG, 뒷면)은 원본과 같은 CC BY-SA 4.0 조건으로 제공합니다.

## 게임 크레딧 문구
화투 도안: Marcus Richert, based on artwork by Louie Mantia, Jr.; SVG optimization by Spenĉjo. Source: Wikimedia Commons (Hwatu overview.svg). Licensed under CC BY-SA 4.0. 변경 내용: 전체 도안을 48장 PNG로 분리, 흰 바탕 추가, 뒷면 도안 추가.

## 엔진·라이브러리
- Phaser 3 (MIT) — https://phaser.io
- @resvg/resvg-js (MPL-2.0, 개발 도구로만 사용) — https://github.com/thx/resvg-js

## 글꼴
- 나눔고딕(NanumGothic-Regular.ttf, NanumGothic-Bold.ttf), 나눔붓(NanumBrushScript-Regular.ttf)
- 저작권: (c) 2010 NHN Corporation. SIL Open Font License 1.1 — 전문은 `public/assets/fonts/OFL.txt`
- 출처: https://github.com/google/fonts/tree/main/ofl (nanumgothic, nanumbrushscript)
- 사용: 화면 본문(나눔고딕), 사건 배너 붓글씨(나눔붓). 수정 없이 로컬 포함(`index.html` @font-face).

## 캐릭터 그림
- `public/assets/characters/barber-neutral.png`(이발소 주인), `public/assets/characters/hero-neutral.png`(나). 각 1199×1312, 투명 배경 PNG, 기본 표정 한 장씩.
- 출처: 프로젝트 소유자가 제작·승인해 제공한 2D 캐릭터(2026-10-28). 별도 라이선스 표기 없음 — 외부 배포 전 저작권·사용 조건을 소유자가 확인할 것.
- 사용: `src/character.ts`의 `portraits.normal`로 연결, 정보 패널의 작은 원형 초상화에 얼굴·어깨 부분만 잘라 표시. 파일 자체는 수정하지 않았다(처음 저장된 파일명 `publicassetscharacters…png.png`만 요청된 이름으로 바꿈).

## 아직 없는 자산(자리 표시로 대신)
- 캐릭터 표정 그림(놀람·당황·기쁨·패배): `src/character.ts`의 `portraits`에 표정별 파일 경로를 적으면 교체된다. 지금은 기본 표정 그림 + 표정 배지로 대신한다.
- 상대 음성(쪽·싹쓸이·따닥·폭탄·고·스톱): `src/ui/voice.ts`의 `register`로 연결한다. 현재는 무음(브라우저 TTS를 쓰지 않는다).
- 참고로 본 `사진/` 폴더의 스크린샷은 외부 상용 게임의 화면이라 어떤 자산도 가져오지 않았다(구성 참고만).
