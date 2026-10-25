#!/usr/bin/env node
// photo 카드의 imageQuery(영문 검색어)로 Pexels에서 사진을 받아 image·credit을 채움
//
// 사용법:
//   PEXELS_API_KEY=키 node cardnews/fetch-images.js <data.json>
//
// - 사진은 JSON 파일 옆 images/ 폴더에 저장되고, JSON 파일이 갱신됨
// - 이미 image가 있는 카드는 건너뜀 (다시 받으려면 image를 지우고 실행)
// - API 키: https://www.pexels.com/api/ 에서 무료 발급

const fs = require("fs");
const path = require("path");

const API = "https://api.pexels.com/v1/search";
const key = process.env.PEXELS_API_KEY;
const dataPath = process.argv[2];

if (!dataPath || !key) {
  console.error("사용법: PEXELS_API_KEY=키 node cardnews/fetch-images.js <data.json>");
  process.exit(1);
}

async function search(query, orientation) {
  const url = `${API}?${new URLSearchParams({ query, orientation, per_page: "10" })}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels 검색 실패 (${res.status}): ${query}`);
  return (await res.json()).photos;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`사진 다운로드 실패 (${res.status}): ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

(async () => {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const imgDir = path.join(path.dirname(dataPath), "images");
  fs.mkdirSync(imgDir, { recursive: true });

  // 카드뉴스(4:5)·릴스(9:16) 모두 세로라 portrait로 검색
  const used = new Set();
  for (const [i, card] of data.cards.entries()) {
    if (card.type !== "photo" || card.image || !card.imageQuery) continue;

    const photos = await search(card.imageQuery, "portrait");
    const photo = photos.find(p => !used.has(p.id));
    if (!photo) {
      console.warn(`${i + 1}장: "${card.imageQuery}" 검색 결과 없음 — 검색어를 바꿔 보세요`);
      continue;
    }
    used.add(photo.id);

    // 원본은 너무 커서 폭 1600px로 받음
    const file = `pexels-${photo.id}.jpg`;
    await download(`${photo.src.original}?auto=compress&cs=tinysrgb&w=1600`, path.join(imgDir, file));

    card.image = `images/${file}`;
    card.credit = `Photo: ${photo.photographer} / Pexels`;
    card.imageSource = photo.url;
    console.log(`${i + 1}장: ${card.credit} (${photo.url})`);
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`저장: ${dataPath}`);
})().catch(err => {
  console.error("실패:", err.message);
  process.exit(1);
});
