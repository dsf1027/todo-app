# 이슈한장 카드뉴스 템플릿

JSON 데이터 → 카드 이미지(1080×1920 PNG) → 릴스용 MP4

## 실행

```bash
# Playwright, ffmpeg 필요
node cardnews/render.js cardnews/samples/policy.json out --video
#   --sec=3          카드 한 장당 노출 시간(초)
#   --bgm=music.mp3  배경음 (저작권 문제 없는 음원만)
```

브라우저 미리보기: `cardnews` 폴더에서 로컬 서버를 띄운 뒤 `template.html` 열기
(예: `npx serve cardnews`). `file://`로 열면 샘플 JSON을 불러오지 못합니다.

## 데이터 구조

| 필드 | 설명 |
|---|---|
| `brand`, `handle`, `date` | 상단 브랜드, 하단 아이디·날짜 |
| `category` | `economy`(초록) / `policy`(파랑) / `tech`(보라) — 강조색 결정 |
| `sample` | `true`면 "샘플 데이터" 배지 표시 |
| `cards[]` | 카드 목록, `type`별 필드는 아래 |

| type | 필드 |
|---|---|
| `cover` | `kicker`, `title`, `sub` |
| `what` | `label`, `title`, `points[]` |
| `numbers` | `label`, `stat`, `statCaption`, `bars[] {name, value, display, highlight}`, `note` |
| `impact` | `label`, `title`, `who`, `result`, `detail` |
| `action` | `label`, `title`, `steps[]` |
| `outro` | `label`, `sources[] {name, date, title}`, `cta`, `disclaimer` |
| `photo` | `image`(JSON 파일 기준 상대경로 또는 URL), `kicker`, `title`, `sub`, `credit` — 이미지를 꽉 채우고 위쪽에 핵심 문장만 |

예시: `samples/policy.json`(기본형), `samples/photo-tech.json`(사진형). 사진형 예시의 이미지는 직접 그린 샘플 일러스트(SVG)입니다.

사진형 카드에는 출처를 밝힐 수 있고 상업적으로 써도 되는 이미지만 넣으세요. `credit`에 출처를 적습니다.

텍스트 안에서 `**강조**`는 강조색, `\n`은 줄바꿈.

상단 약 250px, 하단 약 470px는 릴스 UI(탭·캡션·버튼)에 가리지 않도록 비워 둡니다.
