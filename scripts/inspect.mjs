// Inspect Anapec Livewire data + MarocAnnonces detail page structure
import fs from "node:fs";

const html = fs.readFileSync(new URL("./an_offers.html", import.meta.url), "utf8");

// Find wire:snapshot attributes that contain job data
const re = /wire:snapshot="([^"]*)"/g;
let m;
let found = 0;
while ((m = re.exec(html)) && found < 4) {
  const decoded = m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
  try {
    const json = JSON.parse(decoded);
    const s = JSON.stringify(json);
    if (s.includes("ref_offre") || s.includes("job")) {
      console.log("=== SNAPSHOT", found, "len:", s.length, "===");
      console.log(s.slice(0, 1200));
      console.log();
      found++;
    }
  } catch {
    /* not json */
  }
}

// Also check rendered job titles in the HTML
const titles = [...html.matchAll(/<h5[^>]*>\s*<a[^>]*target="_blank">([^<]+)<\/a>/g)].map((x) => x[1]);
console.log("=== RENDERED TITLES ===");
console.log(titles.slice(0, 10).join(" | "));
