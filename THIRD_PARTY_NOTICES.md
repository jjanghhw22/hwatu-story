# 제3자 저작물 고지 (THIRD PARTY NOTICES)

## 화투 카드 그림 (v0.26부터)

- 골목간판풍 화투 48장 + 뒷면: 프로젝트 소유자가 제작해 제공(2026-10-30, 원본 1024×1536 PNG 48장). 제3자 저작물이 아닙니다.
- 사용 파일: `public/assets/cards/card-00.png` ~ `card-47.png`(400×600, 256색), `public/assets/cards/back.png`(같은 테두리 + 매화 문양), `public/assets/cards/cards.json`(연결표)
- 변환: `tools/prepare-cards.py`(Pillow). 원본 파일 번호 n(01~48)이 카드 id n−1에 대응(`src/cards.ts` 슬롯 순서와 같음).
- 재생성: `python tools/prepare-cards.py art/cards-src/<압축 푼 폴더> public/assets/cards` (원본은 용량 때문에 저장소에 커밋하지 않음 — `.gitignore`의 `art/`)

## 이전 버전(v0.25 이하)에서 사용한 화투 도안 — 더 이상 게임에 쓰지 않음(이력)

- 원작: Marcus Richert, based on artwork by Louie Mantia, Jr. / SVG 최적화: Spenĉjo
- 출처: https://commons.wikimedia.org/wiki/File:Hwatu_overview.svg — CC BY-SA 4.0
- v0.25까지 `hwatu-overview.svg`를 `tools/split-cards.mjs`로 48장 PNG로 분리해 썼습니다(흰 바탕 추가, 일본식 월 순서를 내용 기준으로 재연결, 붉은 뒷면 파생). 두 파일은 참고용으로 저장소에 남아 있지만 빌드 결과물에는 포함되지 않습니다(`public/` 밖).

## 게임 크레딧 문구
화투 그림: 골목간판풍(소유자 제작). 글꼴·엔진 출처는 아래와 같다.

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
