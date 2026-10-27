#!/usr/bin/env node
// 카드 데이터(JSON) → PNG 카드 이미지 → (선택) 릴스용 MP4
//   --format=card : 피드 카드뉴스 1080×1350 (기본)
//   --format=reel : 릴스 1080×1920, --video 로 MP4까지
//
// 사용법:
//   node cardnews/render.js <data.json> [출력폴더] [--format=card|reel] [--video] [--sec=3] [--bgm=음악.mp3]
// 예:
//   node cardnews/render.js cardnews/samples/photo-tech.json out
//   node cardnews/render.js cardnews/samples/policy.json out --format=reel --video

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? true];
  })
);
const [dataPath, outDir = "out"] = args.filter(a => !a.startsWith("--"));

if (!dataPath) {
  console.error("사용법: node cardnews/render.js <data.json> [출력폴더] [--format=card|reel] [--video] [--sec=3] [--bgm=음악.mp3]");
  process.exit(1);
}

const SIZES = { card: { width: 1080, height: 1350 }, reel: { width: 1080, height: 1920 } };

async function renderCards(data, dir, format) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: SIZES[format] });
    await page.addInitScript(d => { window.CARD_DATA = d; }, data);
    const templateUrl = "file://" + path.join(__dirname, "template.html") + `?render=1&format=${format}`;
    await page.goto(templateUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);

    const error = await page.evaluate(() => document.body.dataset.error);
    if (error) throw new Error(error);

    const cards = await page.$$(".card");
    const files = [];
    for (let i = 0; i < cards.length; i++) {
      const file = path.join(dir, `card_${String(i + 1).padStart(2, "0")}.png`);
      await cards[i].screenshot({ path: file });
      files.push(file);
    }
    return files;
  } finally {
    await browser.close();
  }
}

// --bgm이 없으면 JSON의 mood(serious·calm·positive)에 맞는 곡을 bgm/<mood>/에서 하나 고름
function pickBgm(mood) {
  if (!mood) return null;
  const dir = path.join(__dirname, "bgm", mood);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".m4a")) : [];
  if (!files.length) throw new Error(`mood "${mood}"에 맞는 배경음악이 없습니다: ${dir}`);
  return path.join(dir, files[Math.floor(Math.random() * files.length)]);
}

// 카드 한 장당 sec초씩 보여주는 9:16 MP4 (H.264, 30fps)
function makeVideo(dir, sec, bgm, cardCount) {
  const out = path.join(dir, "reel.mp4");
  const total = sec * cardCount;
  const ffArgs = ["-y", "-framerate", `1/${sec}`, "-i", path.join(dir, "card_%02d.png")];
  if (bgm) ffArgs.push("-i", bgm);
  ffArgs.push(
    "-vf", "scale=1080:1920,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20"
  );
  // 음악은 영상 길이에 맞춰 자르고 앞 0.5초·끝 1.5초 페이드
  if (bgm) ffArgs.push(
    "-af", `afade=t=in:d=0.5,afade=t=out:st=${Math.max(total - 1.5, 0)}:d=1.5`,
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-t", String(total)
  );
  ffArgs.push("-movflags", "+faststart", out);
  execFileSync("ffmpeg", ffArgs, { stdio: "inherit" });
  return out;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  // 사진 카드의 image 경로는 JSON 파일 위치 기준
  data.baseUrl = pathToFileURL(path.resolve(dataPath)).href;
  fs.mkdirSync(outDir, { recursive: true });

  const format = flags.format || data.format || "card";
  if (!SIZES[format]) throw new Error(`알 수 없는 format: ${format}`);
  if (flags.video && format !== "reel") throw new Error("--video 는 --format=reel 일 때만 쓸 수 있습니다");

  const files = await renderCards(data, outDir, format);
  console.log(`카드 ${files.length}장 생성 (${format} ${SIZES[format].width}×${SIZES[format].height}): ${outDir}`);

  if (flags.video) {
    const bgm = flags.bgm || pickBgm(data.mood);
    const video = makeVideo(outDir, Number(flags.sec) || 3, bgm, files.length);
    console.log(`릴스 영상 생성: ${video}${bgm ? ` (배경음악: ${path.basename(bgm)})` : ""}`);
  }
})().catch(err => {
  console.error("실패:", err.message);
  process.exit(1);
});
