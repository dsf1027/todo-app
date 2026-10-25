#!/usr/bin/env node
// photo 카드의 imageQuery(영문 검색어)로 무료 사진을 받아 image·credit을 채움
//
// 사용법 (키가 있는 쪽을 씀, 둘 다 있으면 Pixabay):
//   PIXABAY_API_KEY=키 node cardnews/fetch-images.js <data.json>
//   PEXELS_API_KEY=키  node cardnews/fetch-images.js <data.json>
//
// - 사진은 JSON 파일 옆 images/ 폴더에 저장되고, JSON 파일이 갱신됨
// - 이미 image가 있는 카드는 건너뜀 (다시 받으려면 image를 지우고 실행)
// - 키 발급: https://pixabay.com/api/docs/ , https://www.pexels.com/api/

const fs = require("fs");
const path = require("path");

// 카드뉴스(4:5)·릴스(9:16) 모두 세로라 세로 사진으로 검색
const providers = {
  pixabay: {
    key: process.env.PIXABAY_API_KEY,
    async search(query) {
      const params = new URLSearchParams({
        key: this.key, q: query, image_type: "photo", orientation: "vertical",
        safesearch: "true", per_page: "20",
      });
      const res = await fetch(`https://pixabay.com/api/?${params}`);
      if (!res.ok) throw new Error(`Pixabay 검색 실패 (${res.status}): ${query}`);
      return (await res.json()).hits.map(h => ({
        id: `pixabay-${h.id}`,
        // Pixabay는 이미지 직접 링크(핫링크)를 허용하지 않아 반드시 내려받아 씀
        download: h.largeImageURL,
        credit: `Photo: ${h.user} / Pixabay`,
        page: h.pageURL,
      }));
    },
  },
  pexels: {
    key: process.env.PEXELS_API_KEY,
    async search(query) {
      const params = new URLSearchParams({ query, orientation: "portrait", per_page: "10" });
      const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
        headers: { Authorization: this.key },
      });
      if (!res.ok) throw new Error(`Pexels 검색 실패 (${res.status}): ${query}`);
      return (await res.json()).photos.map(p => ({
        id: `pexels-${p.id}`,
        // 원본은 너무 커서 폭 1600px로 받음
        download: `${p.src.original}?auto=compress&cs=tinysrgb&w=1600`,
        credit: `Photo: ${p.photographer} / Pexels`,
        page: p.url,
      }));
    },
  },
};

const dataPath = process.argv[2];
const provider = Object.values(providers).find(p => p.key);

if (!dataPath || !provider) {
  console.error("사용법: PIXABAY_API_KEY=키 (또는 PEXELS_API_KEY=키) node cardnews/fetch-images.js <data.json>");
  process.exit(1);
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

  const used = new Set();
  for (const [i, card] of data.cards.entries()) {
    if (card.type !== "photo" || card.image || !card.imageQuery) continue;

    const photo = (await provider.search(card.imageQuery)).find(p => !used.has(p.id));
    if (!photo) {
      console.warn(`${i + 1}장: "${card.imageQuery}" 검색 결과 없음 — 검색어를 바꿔 보세요`);
      continue;
    }
    used.add(photo.id);

    const file = `${photo.id}.jpg`;
    await download(photo.download, path.join(imgDir, file));

    card.image = `images/${file}`;
    card.credit = photo.credit;
    card.imageSource = photo.page;
    console.log(`${i + 1}장: ${card.credit} (${photo.page})`);
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`저장: ${dataPath}`);
})().catch(err => {
  console.error("실패:", err.message);
  process.exit(1);
});
