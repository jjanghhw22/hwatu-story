# 에셋 명세 (assets_spec)

디자인 개편 단계마다 추가로 필요한 그림·소리 에셋을 여기에 적는다. 각 항목은 파일 경로, 크기(px), 형식, 쓰이는 화면, 자리 표시 대체물을 함께 적는다.
토큰·서체는 에셋이 아니라 코드다: 색·글자 스타일은 `src/ui/theme.ts`, 공통 부품은 `src/ui/components.ts`, 웹폰트(Noto Serif KR·Noto Sans KR)는 `index.html`의 Google Fonts 로드를 보라.

## 1단계 — 디자인 토큰·공통 컴포넌트 (v0.27, 요청 13)

추가할 에셋 없음.

## 2단계 — 프롤로그 4컷·1장 커버 (요청 15)

파일이 생길 때까지 게임은 theme panel 색 배경 + 글자 연출로 대체한다(의도된 폴백, 재요청 없음).
**2026-11-06 반영(hwatu_assets_2nd.zip):** prologue-1~4 들어옴. cover-*.png는 아직 없음(타이틀 박스는 chapter_key가 대신하므로 cover는 사실상 chapter_key 폴백용).

| 파일 | 크기(px) | 투명배경 | 내용 |
| --- | --- | --- | --- |
| `public/assets/story/prologue-1.png` | 720×480 | 아니오 | 프롤로그 1컷 — 밤, 걸려 온 전화 한 통 |
| `public/assets/story/prologue-2.png` | 720×480 | 아니오 | 프롤로그 2컷 — 아버지의 수선집 앞(셔터 내려감) |
| `public/assets/story/prologue-3.png` | 720×480 | 아니오 | 프롤로그 3컷 — 쌓인 독촉장과 멈춘 재봉틀 |
| `public/assets/story/prologue-4.png` | 720×480 | 아니오 | 프롤로그 4컷 — 가방을 메고 고향 거리로 들어서는 도윤 뒷모습 |
| `public/assets/story/cover-ch1.png` | 720×240 | 아니오 | 1장 커버 — 대성이발관 외관, 비 갠 오후, 간판과 회전등 |

## 3단계 — 대국 화면 HUD (요청 16)

그림이 생길 때까지 전부 theme 색 사각형·원 플레이스홀더로 그린다(지금 코드가 그 상태).

| 파일 | 크기(px) | 투명배경 | 내용 |
| --- | --- | --- | --- |
| `public/assets/ui/portrait_opp_{상대id}.png` | 128×128 | 예 | 대국 화면 상대 초상(원형 마스크로 잘림, 얼굴 중심 정사각) — 상대별 1장: barber·bamcha·ma·bokhee·bonggu·highroller·sangcheol·taeoh·father·jeongho·mujin·stranger·merchant·courier |
| `public/assets/ui/icon_skill_eye.png` | 64×64 | 예 | 기술 아이콘 — 눈썰미(치켜뜬 눈) |
| `public/assets/ui/icon_skill_calmface.png` | 64×64 | 예 | 기술 아이콘 — 태연한 얼굴(무표정 가면) |
| `public/assets/ui/icon_skill_lookaway.png` | 64×64 | 예 | 기술 아이콘 — 시선 돌리기(곁눈질 화살표) |
| `public/assets/ui/icon_skill_swap.png` | 64×64 | 예 | 기술 아이콘 — 바꿔치기(소매 속 카드) |
| `public/assets/ui/icon_brace.png` | 64×64 | 예 | 손목 보호대 오버레이 — 손 기술 제한 구간에 기술 아이콘 위를 덮는 붕대 감은 손목 |
| `public/assets/ui/icon_fold.png` | 48×48 | 예 | 접기(기권) 버튼 아이콘 — 엎어 놓은 패 |

## 4단계 — 대화·컷씬 연출 리뉴얼 (요청 17)

파일이 생길 때까지: 컷은 theme panel 폴백, 표정은 기본(neutral) 초상으로 대신한다. 이미 있는 초상 15장(`characters/*-neutral.png`)은 여기 다시 올리지 않는다.
**2026-11-06 반영:** ch1-barber(원명 ch1-receipt에서 복사)·ch1-lock·ch1-blanket 들어옴. ch1-box와 ch2~ch11 컷은 아직 없음. ch1-hand.png(화투 쥔 손)는 대응하는 cut() 참조가 없어 미사용 대기.
표정 그림은 파일을 넣은 뒤 `src/character.ts`의 `portraits`에 경로 한 줄을 추가해야 적용된다(없는 표정은 neutral로 자동 대체).

| 파일 | 크기(px) | 투명배경 | 내용 |
| --- | --- | --- | --- |
| `public/assets/story/ch1-barber.png` | 720×480 | 아니오 | 1장 컷 — 보관증을 들고 대식에게 가는 도윤 |
| `public/assets/story/ch1-lock.png` | 720×480 | 아니오 | 1장 컷 — 보관증을 보고 출입문을 잠그는 대식 |
| `public/assets/story/ch1-blanket.png` | 720×480 | 아니오 | 1장 컷 — 초록 담요를 펴는 손 |
| `public/assets/story/ch1-box.png` | 720×480 | 아니오 | 1장 컷 — 철제 상자(젊은 아버지 사진·수첩·비광 한 장) |
| `public/assets/story/ch2-*.png ~ ch11-*.png, gift-watch.png` (42장) | 720×480 | 아니오 | 2~11장 컷 — 파일명·장면은 `src/story/chapters.ts`의 `cut('파일명', '지문')` 호출 명단이 원본. 생기는 대로 같은 경로에 넣으면 웹툰 패널로 자동 전환 |
| `public/assets/characters/<id>-happy.png` 등 표정 변형(행복·놀람·당황·패배, 필요 인물부터) | neutral 원본과 동일 크기·구도 | 예 | 대화 초상 표정 변형 — 차분한 기본은 기존 neutral, 표정은 같은 인물 같은 구도에서 얼굴만 바뀐 버전 |

## 5단계 — 여정 지도 리뉴얼 (요청 18)

파일이 생길 때까지: 챕터 키는 theme panel 색 + 제목, 지도 배경은 바탕색 그대로, 노드 안은 기존 인물 초상(`characters/*-neutral.png` 재사용), 아이콘은 theme 색 도형 + 글자로 대신한다(의도된 폴백, 재요청 없음).
**2026-11-06 반영:** chapter_key_1~11, map_paper_bg, icon_talk·match·search·lock·note 들어옴(아이콘 5종은 64×64로 와서 명세 크기로 리사이즈). chapter_key_0(프롤로그)·chapter_key_12(에필로그)·icon_place_{id} 8종은 아직 없음. 원본 zip은 `art/hwatu_assets_2nd.zip`.

| 파일 | 크기(px) | 투명배경 | 내용 |
| --- | --- | --- | --- |
| `public/assets/story/chapter_key_{n}.png` (n = 장 번호 0~12, 13장) | 720×240 | 아니오 | 챕터 타이틀 박스 배경 키 일러스트 — 0 프롤로그(봉투), 1~11 각 장 핵심 장면, 12 에필로그(머리 자르는 날). 하단 1/2에 검정 그라데이션과 금색 제목이 얹히므로 주요 피사체는 위쪽에 |
| `public/assets/ui/map_paper_bg.png` | 720×900 | 아니오 | 지도 영역 배경 — 종이 질감 손그림 약도(백운시 거리, 세로 지그재그 경로가 어울리게). 비율 유지로 축소되어 깔린다 |
| `public/assets/ui/icon_place_{장소id}.png` — barber·home·store·bath·market·harbor·billiards·hotel (8종) | 96×96 | 예 | 장소 아이콘 — 노드 안 인물 초상이 없을 때 대신 표시(가위·집·간판·수증기·장바구니·닻·당구공·호텔 열쇠 등 장소 상징) |
| `public/assets/ui/icon_talk.png` | 40×40 | 예 | 행동 아이콘 — 대화(말풍선) |
| `public/assets/ui/icon_match.png` | 40×40 | 예 | 행동 아이콘 — 대결(화투패 두 장) |
| `public/assets/ui/icon_search.png` | 40×40 | 예 | 행동 아이콘 — 조사(돋보기) |
| `public/assets/ui/icon_lock.png` | 40×40 | 예 | 잠긴 노드 자물쇠 |
| `public/assets/ui/icon_note.png` | 48×48 | 예 | DAY 바 '기록 N건' 버튼 옆 수첩 아이콘 |
