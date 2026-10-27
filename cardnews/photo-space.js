#!/usr/bin/env node
// 사진 카드의 글자 자리(위쪽)가 비어 있는지 점수로 확인 — 사진 고를 때 사용
// 카드에 보이는 대로 사진을 자른 뒤(1080×1350, cover) 글자가 올라가는 영역의 '디테일'을 잼
// (흐리게 한 사진과의 차이 = 하늘 그라데이션은 무시하고 사물 윤곽·무늬만 남김)
//   점수 낮을수록 비어 있음. 기준: 20 미만 좋음 / 20~60 눈으로 확인 / 60 이상 글자가 사물과 겹침
//   점수는 참고용 — 매끈한 사물(예: 단색 배터리)은 낮게 나올 수 있으니 최종 판단은 눈으로
//
// 사용법: node cardnews/photo-space.js <사진...> [--position=center|top|bottom]
// ImageMagick(convert) 필요

const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const position = (args.find(a => a.startsWith("--position=")) || "--position=center").split("=")[1];
const files = args.filter(a => !a.startsWith("--"));
const GRAVITY = { center: "center", top: "north", bottom: "south" };

// 카드 1080×1350 중 제목·설명이 들어가는 y 150~650 영역
const TEXT_AREA = "1080x500+0+150";

if (!files.length || !GRAVITY[position]) {
  console.error("사용법: node cardnews/photo-space.js <사진...> [--position=center|top|bottom]");
  process.exit(1);
}

for (const file of files) {
  const mean = execFileSync("convert", [
    file, "-resize", "1080x1350^", "-gravity", GRAVITY[position], "-extent", "1080x1350",
    "-gravity", "northwest", "-crop", TEXT_AREA, "+repage",
    "-colorspace", "gray", "-resize", "216x100!",
    "(", "+clone", "-blur", "0x10", ")", "-compose", "difference", "-composite",
    "-format", "%[fx:mean*1000]", "info:",
  ]).toString();
  const score = Number(mean);
  const verdict = score < 20 ? "좋음" : score < 60 ? "확인" : "겹침";
  console.log(`${score.toFixed(1).padStart(5)}  ${verdict}  ${file}`);
}
