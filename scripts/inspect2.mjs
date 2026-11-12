// Inspect Alwadifa listing page: find main job items with title + city
import fs from "node:fs";
const html = fs.readFileSync(new URL("./aw_public.html", import.meta.url), "utf8");

// All links to /offre/show/id with their surrounding context
const re = /<a[^>]*href="(\/offre\/show\/id\/(\d+))"[^>]*>([\s\S]{0,300}?)<\/a>/g;
let m;
let count = 0;
while ((m = re.exec(html)) && count < 8) {
  const text = m[3]
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 15) continue;
  count++;
  console.log(m[1], "=>", text.slice(0, 110));
}

// sample of any title containing a city name (مراكش، الرباط، الدار البيضاء...)
console.log("\n=== titles containing الرباط ===");
const idx = html.indexOf("الرباط");
if (idx >= 0) console.log(html.slice(idx - 300, idx + 100).replace(/\s+/g, " ").slice(0, 400));
