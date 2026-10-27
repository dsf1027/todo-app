# 이슈한장 카드뉴스 템플릿

JSON 데이터 → 카드 이미지(PNG) — 피드 카드뉴스(1080×1350, 기본) 또는 릴스(1080×1920 + MP4)

## 실행

```bash
# 1) photo 카드의 imageQuery로 무료 사진 받기 (JSON에 image·credit이 채워짐)
#    PIXABAY_API_KEY 또는 PEXELS_API_KEY 중 있는 쪽 사용
PIXABAY_API_KEY=키 node cardnews/fetch-images.js cardnews/samples/photo-tech.json

# 2) 카드뉴스 이미지 만들기 (Playwright 필요)
node cardnews/render.js cardnews/samples/photo-tech.json out

# 릴스로 만들 때 (ffmpeg 필요)
node cardnews/render.js cardnews/samples/policy.json out --format=reel --video
#   --sec=3          카드 한 장당 노출 시간(초)
#   --bgm=music.mp3  배경음 (저작권 문제 없는 음원만)
```

## 릴스 영상 올리기 (Cloudflare R2)

인스타그램 API는 공개 URL에서 영상을 가져가므로, 게시 전에 R2에 올려 둡니다.

```bash
node cardnews/upload-r2.js out/reel.mp4      # 공개 URL 출력
```

필요한 환경변수 (GitHub에서는 Settings → Secrets and variables → Actions):

| 이름 | 값 |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 API 토큰 (Object Read & Write, 이 버킷만) |
| `R2_BUCKET` | 버킷 이름 |
| `R2_PUBLIC_URL` | 버킷의 공개 주소 (`https://pub-….r2.dev` 또는 연결한 도메인) |

브라우저 미리보기: `cardnews` 폴더에서 로컬 서버를 띄운 뒤 `template.html` 열기
(예: `npx serve cardnews`). `file://`로 열면 샘플 JSON을 불러오지 못합니다.

## 데이터 구조

| 필드 | 설명 |
|---|---|
| `brand`, `handle`, `date` | 상단 브랜드, 하단 아이디·날짜 |
| `format` | `card`(기본) / `reel` — 명령줄 `--format`이 우선 |
| `category` | `economy`(초록) / `policy`(파랑) / `tech`(보라) — 강조색만 결정 (카드에 분야 표시는 안 함) |
| `sample` | `true`면 "샘플 데이터" 배지 표시 |
| `mood` | 릴스 배경음악 분위기 `serious`(웅장·긴장) / `calm`(차분) / `positive`(밝음) — `--bgm`이 없으면 `bgm/<mood>/`에서 한 곡 사용 |
| `cards[]` | 카드 목록, `type`별 필드는 아래 |

| type | 필드 |
|---|---|
| `cover` | `kicker`, `title`, `sub` |
| `what` | `label`, `title`, `points[]` |
| `numbers` | `label`, `stat`, `statCaption`, `bars[] {name, value, display, highlight}`, `note` |
| `impact` | `label`, `title`, `who`, `result`, `detail` |
| `action` | `label`, `title`, `steps[]` |
| `outro` | `label`, `sources[] {name, date, title}`, `cta`, `disclaimer` |
| `photo` | `image`(JSON 파일 기준 상대경로 또는 URL), `imagePosition`(사진에서 보일 부분, 예: `center top`), `imageQuery`(Pixabay·Pexels 영문 검색어), `kicker`, `title`, `sub`, `credit` — 사진을 꽉 채우고 위쪽 같은 자리에 핵심 문장만 |

예시: `samples/policy.json`(기본형), `samples/photo-tech.json`(사진형, `fetch-images.js`로 사진을 받은 뒤 렌더링).

사진형 카드에는 상업적으로 써도 되는 사진만 넣고, `credit`에 출처를 적습니다. 직접 받은 사진은 `image`에 경로만 넣으면 됩니다.
글자 자리(위쪽)가 비어 있는 사진인지는 `node cardnews/photo-space.js <사진...>`으로 점수를 볼 수 있습니다 (20 미만 좋음, 60 이상 겹침).

텍스트 안에서 `**강조**`는 강조색, `\n`은 줄바꿈.

릴스 형식은 상단 약 250px, 하단 약 470px를 릴스 UI(탭·캡션·버튼)에 가리지 않도록 비워 둡니다.

## 배경음악

`bgm/tracks.json`에 등록한 **퍼블릭 도메인(PD·CC0) 클래식 녹음**만 씁니다. 곡마다 출처(Wikimedia Commons 페이지)와 라이선스를 적어 두었습니다.
`node cardnews/fetch-bgm.js`가 받아서 60초로 잘라 `bgm/<mood>/<id>.m4a`로 저장합니다
(Wikimedia가 일부 네트워크를 막아서 보통은 GitHub Actions의 "배경음악 받기"로 실행).
