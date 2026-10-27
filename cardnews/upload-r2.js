#!/usr/bin/env node
// 렌더링한 파일(릴스 MP4 등)을 Cloudflare R2에 올리고 공개 URL을 출력
// 인스타그램 API는 공개 URL에서 영상을 가져가므로 게시 전에 이 단계가 필요함
//
// 사용법:
//   node cardnews/upload-r2.js <파일> [저장 이름]
// 예:
//   node cardnews/upload-r2.js out/reel.mp4                 → reels/20261027-083000-reel.mp4
//   node cardnews/upload-r2.js out/reel.mp4 reels/test.mp4
//
// 필요한 환경변수 (README 참고):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
//
// 추가 패키지 없이 S3 호환 API(서명 V4)로 PUT 한 번만 보냄

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CONTENT_TYPES = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

const sha256 = data => crypto.createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

// S3 서명 V4 — headers의 키는 소문자, path는 이미 인코딩된 값
function signV4({ method, path: urlPath, query = "", headers, payloadHash, accessKeyId, secretAccessKey, region, service = "s3", amzDate }) {
  const date = amzDate.slice(0, 8);
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    method, urlPath, query,
    names.map(n => `${n}:${String(headers[n]).trim()}\n`).join(""),
    signedHeaders, payloadHash,
  ].join("\n");
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const key = ["aws4_request", service, region, date].reduceRight((k, part) => hmac(k, part), "AWS4" + secretAccessKey);
  const signature = crypto.createHmac("sha256", key).update(stringToSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// 경로 조각마다 인코딩 (슬래시는 유지)
const encodeKey = key => key.split("/").map(encodeURIComponent).join("/");

async function upload(file, key, env = process.env) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL })
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`환경변수 없음: ${missing.join(", ")}`);

  const body = fs.readFileSync(file);
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const urlPath = `/${R2_BUCKET}/${encodeKey(key)}`;
  const payloadHash = sha256(body);
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const headers = {
    "content-type": CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  headers.authorization = signV4({
    method: "PUT", path: urlPath, headers, payloadHash, amzDate,
    accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, region: "auto",
  });

  const res = await fetch(`https://${host}${urlPath}`, { method: "PUT", headers, body });
  if (!res.ok) throw new Error(`R2 업로드 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${encodeKey(key)}`;
}

module.exports = { upload, signV4 };

if (require.main === module) {
  const [file, keyArg] = process.argv.slice(2);
  if (!file) {
    console.error("사용법: node cardnews/upload-r2.js <파일> [저장 이름]");
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const key = keyArg || `reels/${stamp}-${path.basename(file)}`;
  upload(file, key)
    .then(url => console.log(url))
    .catch(err => {
      console.error("실패:", err.message);
      process.exit(1);
    });
}
