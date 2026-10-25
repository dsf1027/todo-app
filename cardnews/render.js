#!/usr/bin/env node
// 카드 데이터(JSON) → PNG 카드 이미지(1080×1920) → (선택) 릴스용 MP4
//
// 사용법:
//   node cardnews/render.js <data.json> [출력폴더] [--video] [--sec=3] [--bgm=음악.mp3]
// 예:
//   node cardnews/render.js cardnews/samples/policy.json out --video

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
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
  console.error("사용법: node cardnews/render.js <data.json> [출력폴더] [--video] [--sec=3] [--bgm=음악.mp3]");
  process.exit(1);
}

async function renderCards(data, dir) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.addInitScript(d => { window.CARD_DATA = d; }, data);
    const templateUrl = "file://" + path.join(__dirname, "template.html") + "?render=1";
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

// 카드 한 장당 sec초씩 보여주는 9:16 MP4 (H.264, 30fps)
function makeVideo(dir, sec, bgm) {
  const out = path.join(dir, "reel.mp4");
  const ffArgs = ["-y", "-framerate", `1/${sec}`, "-i", path.join(dir, "card_%02d.png")];
  if (bgm) ffArgs.push("-i", bgm);
  ffArgs.push(
    "-vf", "scale=1080:1920,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20"
  );
  if (bgm) ffArgs.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  ffArgs.push("-movflags", "+faststart", out);
  execFileSync("ffmpeg", ffArgs, { stdio: "inherit" });
  return out;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  const files = await renderCards(data, outDir);
  console.log(`카드 ${files.length}장 생성: ${outDir}`);

  if (flags.video) {
    const video = makeVideo(outDir, Number(flags.sec) || 3, flags.bgm);
    console.log(`릴스 영상 생성: ${video}`);
  }
})().catch(err => {
  console.error("실패:", err.message);
  process.exit(1);
});
