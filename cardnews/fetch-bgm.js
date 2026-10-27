#!/usr/bin/env node
// bgm/tracks.json의 퍼블릭 도메인 음원을 받아 릴스용으로 가공
//   → bgm/<mood>/<id>.m4a (60초, AAC 128k 48kHz, 음량 평준화)
//
// 사용법: node cardnews/fetch-bgm.js
// - 이미 있는 파일은 건너뜀 (다시 만들려면 해당 .m4a를 지우고 실행)
// - ffmpeg 필요
// - Wikimedia는 연락처가 담긴 User-Agent를 요구하고, 요청이 많으면 429로 막음

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const BGM_DIR = path.join(__dirname, "bgm");
const LENGTH = 60;
const UA = "CardnewsBgm/1.0 (https://github.com/dsf1027/todo-app)";
const wait = ms => new Promise(r => setTimeout(r, ms));

async function download(url, file) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    if (res.status !== 429 || attempt === 4) throw new Error(`다운로드 실패 (${res.status}): ${url}`);
    await wait(attempt * 15000);
  }
}

(async () => {
  const { tracks } = JSON.parse(fs.readFileSync(path.join(BGM_DIR, "tracks.json"), "utf8"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgm-"));

  for (const t of tracks) {
    const out = path.join(BGM_DIR, t.mood, `${t.id}.m4a`);
    if (fs.existsSync(out)) { console.log(`건너뜀: ${t.id}`); continue; }
    fs.mkdirSync(path.dirname(out), { recursive: true });

    const src = path.join(tmp, t.id + path.extname(new URL(t.url).pathname));
    await download(t.url, src);
    execFileSync("ffmpeg", [
      "-y", "-v", "error", "-ss", String(t.start || 0), "-t", String(LENGTH), "-i", src,
      "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ac", "2", "-ar", "48000",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
    ]);
    console.log(`저장: ${path.relative(process.cwd(), out)} (${t.title} / ${t.license})`);
    await wait(5000);
  }
})().catch(err => {
  console.error("실패:", err.message);
  process.exit(1);
});
