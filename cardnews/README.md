# 이슈한장 카드뉴스 템플릿

JSON 데이터 → 카드 이미지(PNG) — 피드 카드뉴스(1080×1350, 기본) 또는 릴스(1080×1920 + MP4)

## 실행

```bash
# 1) photo 카드의 imageQuery로 Pexels 사진 받기 (JSON에 image·credit이 채워짐)
PEXELS_API_KEY=키 node cardnews/fetch-images.js cardnews/samples/photo-tech.json

# 2) 카드뉴스 이미지 만들기 (Playwright 필요)
node cardnews/render.js cardnews/samples/photo-tech.json out

# 릴스로 만들 때 (ffmpeg 필요)
node cardnews/render.js cardnews/samples/policy.json out --format=reel --video
#   --sec=3          카드 한 장당 노출 시간(초)
#   --bgm=music.mp3  배경음 (저작권 문제 없는 음원만)
```

브라우저 미리보기: `cardnews` 폴더에서 로컬 서버를 띄운 뒤 `template.html` 열기
(예: `npx serve cardnews`). `file://`로 열면 샘플 JSON을 불러오지 못합니다.

## 데이터 구조

| 필드 | 설명 |
|---|---|
| `brand`, `handle`, `date` | 상단 브랜드, 하단 아이디·날짜 |
| `format` | `card`(기본) / `reel` — 명령줄 `--format`이 우선 |
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
| `photo` | `image`(JSON 파일 기준 상대경로 또는 URL), `imageQuery`(Pexels 영문 검색어), `kicker`, `title`, `sub`, `credit` — 사진을 꽉 채우고 위쪽에 핵심 문장만 |

예시: `samples/policy.json`(기본형), `samples/photo-tech.json`(사진형, `fetch-images.js`로 사진을 받은 뒤 렌더링).

사진형 카드에는 상업적으로 써도 되는 사진만 넣고, `credit`에 출처를 적습니다. 직접 받은 사진은 `image`에 경로만 넣으면 됩니다.

텍스트 안에서 `**강조**`는 강조색, `\n`은 줄바꿈.

릴스 형식은 상단 약 250px, 하단 약 470px를 릴스 UI(탭·캡션·버튼)에 가리지 않도록 비워 둡니다.
