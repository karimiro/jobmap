/**
 * Morocco Job Map — Scraper
 * Scrapes: Rekrute, MarocAnnonces, Alwadifa, Anapec
 * Stores normalized jobs in SQLite (data/jobs.db)
 *
 * Run: node scripts/scrape.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Cities + matching
// ---------------------------------------------------------------------------
const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, "cities.json"), "utf8"));

// small towns / common variants that map to a main city
const EXTRA_ALIASES = {
  casablanca: ["mohammedia", "المحمدية", "ain sebaa", "عين السبع", "ain harrouda", "aïn sebaâ", "casa"],
  sale: ["temara", "temarra", "skhirate", "تمارة", "الصخيرات"],
  settat: ["berrechid", "برشيد", "had soualem", "حد سوال"],
  kenitra: ["bouknadel", "بوقنادل"],
  agadir: ["inezgane", "إنزكان", "ait melloul", "أيت ملول", "dcheira", "دشيرة"],
  tanger: ["gzenaya", "gzinaya"],
  tetouan: ["martil", "امطل", "مارتيل"],
  oujda: ["berkane", "بركان"],
  marrakech: ["sidi ghanem", "سيدي غانم"],
};

function norm(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "")
    .trim();
}

// cityId → array of normalized match tokens
const CITY_TOKENS = new Map(
  CITIES.map((c) => {
    const tokens = [norm(c.nameFr), norm(c.nameAr)];
    for (const a of EXTRA_ALIASES[c.id] ?? []) tokens.push(norm(a));
    return [c.id, tokens];
  })
);

function matchCity(text) {
  if (!text) return null;
  const t = norm(text);
  if (!t) return null;
  for (const [cityId, tokens] of CITY_TOKENS) {
    for (const tok of tokens) {
      if (tok && t.includes(tok)) return cityId;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deadlines (application closing dates)
// Moroccan posts write dates like "26 نونبر 2026" or "26/11/2026" next to
// keywords such as "آخر أجل" / "إلى غاية" / "dépôt des candidatures" / "تمديد"
// ---------------------------------------------------------------------------
const AR_MONTHS = {
  "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4, "ماي": 5,
  "يونيو": 6, "يونيوز": 6, "يوليوز": 7, "يوليو": 7, "غشت": 8, "أغسطس": 8,
  "اغسطس": 8, "شتنبر": 9, "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10,
  "نونبر": 11, "نوفمبر": 11, "دجنبر": 12, "ديسمبر": 12,
};
const FR_MONTHS = {
  janvier: 1, fevrier: 2, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, "août": 8, septembre: 9, octobre: 10, novembre: 11,
  decembre: 12, "décembre": 12,
};
const MONTH_NAME_RE =
  "(يناير|فبراير|مارس|أبريل|ابريل|ماي|يونيو|يونيوز|يوليوز|يوليو|غشت|أغسطس|اغسطس|شتنبر|سبتمبر|أكتوبر|اكتوبر|نونبر|نوفمبر|دجنبر|ديسمبر|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)";

function isoFrom(year, month, day) {
  const y = +year, mo = +month, d = +day;
  if (y < 2025 || y > 2035 || !mo || mo > 12 || !d || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateIn(text) {
  // "26 نونبر 2026" / "26 novembre 2026"
  let m = text.match(new RegExp(`(\\d{1,2})\\s*(?:هو|للترشيح)?\\s*${MONTH_NAME_RE}\\s+(\\d{4})`, "i"));
  if (m) {
    const mo = AR_MONTHS[m[2]] ?? FR_MONTHS[m[2].toLowerCase()];
    const iso = mo && isoFrom(m[3], mo, m[1]);
    if (iso) return iso;
  }
  // "26/11/2026" (day first, Moroccan style)
  m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return isoFrom(m[3], m[2], m[1]);
  return null;
}

// Find the application deadline inside a listing block, if any.
// Keyword tiers (most → least reliable): "آخر أجل"-style, "إيداع/تقديم",
// then "تمديد" (extension posts list the new final date — take the latest).
function extractDeadline(text) {
  if (!text) return null;
  const t = text.replace(/&#039;/g, "'").replace(/&amp;/g, "&");

  const hard = /(آخر\s*أجل|اخر\s*اجل|آخر\s*موعد|اخر\s*موعد|إلى\s*غاية|إلى\s*غاية|jusqu'?au|jusqu'?à|date\s*limite|closing\s*date)/gi;
  let m = hard.exec(t);
  if (m) return parseDateIn(t.slice(m.index, m.index + 150));

  const deposit = /(إيداع|dépôt|تقديم)/gi;
  m = deposit.exec(t);
  if (m) return parseDateIn(t.slice(m.index, m.index + 150));

  const extended = /(تمديد|prolongation|prorogation)/gi;
  m = extended.exec(t);
  if (m) {
    const seg = t.slice(m.index, m.index + 400);
    const all = [
      ...seg.matchAll(
        new RegExp(`(\\d{1,2})\\s*(?:هو|للترشيح)?\\s*${MONTH_NAME_RE}\\s+(\\d{4})|(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})`, "gi")
      ),
    ];
    let best = null;
    for (const a of all) {
      const iso = a[2]
        ? isoFrom(a[3], AR_MONTHS[a[2]] ?? FR_MONTHS[a[2].toLowerCase()], a[1])
        : isoFrom(a[6], a[5], a[4]);
      if (iso && (!best || iso > best)) best = iso;
    }
    return best;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------
async function fetchText(url, charset = "utf-8") {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "fr,ar;q=0.9,en;q=0.5" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (charset === "utf-8") return res.text();
  const buf = Buffer.from(await res.arrayBuffer());
  return new TextDecoder(charset).decode(buf);
}

// ---------------------------------------------------------------------------
// Rekrute — private sector jobs (rich data)
// ---------------------------------------------------------------------------
async function scrapeRekrute() {
  const jobs = [];
  const html = await fetchText("https://www.rekrute.com/offres-emploi-maroc.html");
  const re = /<a class='titreJob' href="\/offre-emploi-(.+?)\.html">\s*([^<]+?)\s*<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    const full = m[2].replace(/&amp;/g, "&").replace(/&#039;/g, "'");
    const id = (slug.match(/(\d+)$/) || [])[1];
    if (!id) continue;
    // title | city format
    const parts = full.split("|").map((p) => p.trim());
    const title = parts[0] ?? full;
    let cityText = (parts[1] ?? "").replace(/\(Maroc\)/i, "").trim();
    // company from slug: ...-recrutement-{company}-{city}-{id}
    let org = "";
    const recIdx = slug.indexOf("recrutement-");
    if (recIdx >= 0) {
      const tail = slug.slice(recIdx + "recrutement-".length).replace(/-\d+$/, "");
      const segs = tail.split("-");
      if (segs.length > 1) {
        org = segs.slice(0, -1).join(" ");
        cityText = cityText || segs[segs.length - 1];
      }
    }
    const url = `https://www.rekrute.com/offre-emploi-${slug}.html`;
    jobs.push({
      source: "rekrute",
      source_id: id,
      title,
      org: org || "—",
      city: cityText,
      sector: "private",
      type: "Offre d'emploi",
      posted: new Date().toISOString().slice(0, 10),
      url,
    });
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// MarocAnnonces — category 309 (Offres d'emploi)
// ---------------------------------------------------------------------------
async function scrapeMarocAnnonces() {
  const jobs = [];
  for (const pge of [1, 2]) {
    const url = `https://www.marocannonces.com/maroc/categorie/309/Emploi/Offres-emploi.html${pge > 1 ? `?pge=${pge}` : ""}`;
    let html;
    try {
      html = await fetchText(url);
    } catch (e) {
      console.warn(`  marocannonces page ${pge}: ${e.message}`);
      continue;
    }
    const re = /href="(categorie\/309\/[^"]*\/annonce\/(\d+)\/[^"]+\.html)"/g;
    let m;
    while ((m = re.exec(html))) {
      const [, href, id] = m;
      // title is in the link's title attribute or inner text; look backwards for title="..."
      const before = html.slice(Math.max(0, m.index - 200), m.index);
      const titleMatch = before.match(/title="([^"]+)"/);
      let title = titleMatch ? titleMatch[1] : href.split("/").pop().replace(/\.html$/, "").replace(/-/g, " ");
      title = title.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&eacute;/g, "é").trim();
      // find the closest location span after the link (same item block)
      const after = html.slice(m.index, m.index + 1500);
      const locMatch = after.match(/<span class="location">([^<]*)<\/span>/);
      const cityText = locMatch ? locMatch[1].trim() : "";
      // date nearby
      const dateMatch = after.match(/(\d{4}-\d{2}-\d{2})/);
      const posted = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
      jobs.push({
        source: "marocannonces",
        source_id: id,
        title,
        org: "—",
        city: cityText,
        sector: "private",
        type: "Offre d'emploi",
        posted,
        url: `https://www.marocannonces.com/maroc/${href}`,
      });
    }
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Alwadifa — public (مباريات) + private
// ---------------------------------------------------------------------------
const stripTags = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, "é")
    .replace(/\s+/g, " ")
    .trim();

// city names (Arabic longest-first) + French names, all in one regex
const CITY_WORDS_RE = new RegExp(
  [
    ...CITIES.map((c) => c.nameAr).sort((a, b) => b.length - a.length),
    ...CITIES.map((c) => c.nameFr),
  ]
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g"
);

async function scrapeAlwadifa() {
  const jobs = [];
  const boards = [
    { path: "/offre/public", sector: "public", type: "Concours" },
    { path: "/offre/prive", sector: "private", type: "Offre" },
  ];
  for (const board of boards) {
    let html;
    try {
      html = await fetchText(`https://www.alwadifa-maroc.com${board.path}`);
    } catch (e) {
      console.warn(`  alwadifa ${board.path}: ${e.message}`);
      continue;
    }
    // main listing items: <h2 ...><a href="/offre/show/id/N">TITLE</a>...
    const re = /<h2[^>]*>\s*<a[^>]*href="(\/offre\/show\/id\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const [, href, id, rawTitle] = m;
      const title = stripTags(rawTitle);
      if (title.length < 40) continue; // nav/menu links are short
      // description follows in .content-description — useful for city detection
      const after = html.slice(m.index, m.index + 2500);
      const descMatch = after.match(/content-description[\s\S]{0,300}?<p>([\s\S]{0,500}?)<\/p>/);
      const desc = descMatch ? stripTags(descMatch[1]) : "";
      const cityMatch =
        title.match(CITY_WORDS_RE)?.[0] ?? desc.match(CITY_WORDS_RE)?.[0] ?? "";
      const dateMatch = after.match(/(\d{4}-\d{2}-\d{2})/);
      jobs.push({
        source: "alwadifa",
        source_id: `${board.sector}-${id}`,
        title,
        org: "",
        city: cityMatch,
        sector: board.sector,
        type: board.type,
        posted: dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10),
        deadline: extractDeadline(title + " " + stripTags(after)),
        url: `https://www.alwadifa-maroc.com${href}`,
      });
    }
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Anapec — offers (data embedded in Livewire snapshots)
// ---------------------------------------------------------------------------
function deepFindJobs(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) deepFindJobs(x, out);
    return;
  }
  if ("intitule_poste" in node && node.intitule_poste) {
    out.push(node);
    return;
  }
  for (const v of Object.values(node)) deepFindJobs(v, out);
}

async function scrapeAnapec() {
  const html = await fetchText("https://anapec.ma/chercheurs/offres");
  const re = /wire:snapshot="([^"]+)"/g;
  const rawJobs = [];
  let m;
  while ((m = re.exec(html))) {
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
    try {
      const json = JSON.parse(decoded);
      deepFindJobs(json, rawJobs);
    } catch {
      /* ignore */
    }
  }
  const seen = new Set();
  const jobs = [];
  for (const j of rawJobs) {
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    // company sometimes embedded in the logo filename
    let org = "—";
    if (j.entreprise && j.entreprise.includes("/")) {
      const fname = j.entreprise.split("/").pop();
      if (fname && !/^(logo|0|1|2|3|4|5|6|7|8|9)/i.test(fname) && fname.includes("-") && fname.endsWith(".jpg")) {
        org = fname.replace(/\.jpe?g$/i, "").trim();
      }
    }
    const dmy = j.date_offre; // "11-11-2026"
    let posted = new Date().toISOString().slice(0, 10);
    const dm = (dmy || "").match(/(\d{2})-(\d{2})-(\d{4})/);
    if (dm) posted = `${dm[3]}-${dm[2]}-${dm[1]}`;
    jobs.push({
      source: "anapec",
      source_id: String(j.id),
      title: String(j.intitule_poste).trim(),
      org,
      city: String(j.lieu_travail || "").trim(),
      sector: "private",
      type: "Offre d'emploi",
      deadline: extractDeadline([j.date_expiration, j.date_limite, j.cloture].filter(Boolean).join(" ")),
      posted,
      url: `http://www.anapec.org/sigec-app-rv/fr/entreprises/bloc_offre_home/${j.id}/display`,
    });
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "jobs.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    key TEXT PRIMARY KEY,
    source TEXT,
    source_id TEXT,
    title TEXT,
    org TEXT,
    city TEXT,
    city_id TEXT,
    sector TEXT,
    type TEXT,
    posted TEXT,
    deadline TEXT,
    url TEXT,
    first_seen TEXT
  );
  CREATE TABLE IF NOT EXISTS seen_urls (
    url_hash TEXT PRIMARY KEY
  );
`);

// migration: add deadline column to older databases
try {
  db.exec("ALTER TABLE jobs ADD COLUMN deadline TEXT");
} catch {
  /* column already exists */
}

function normTitleKey(title, city, sector) {
  return norm(`${title}|${city}|${sector}`);
}

// cross-source duplicate detection via title+city+sector
const dupKey = new Set();
{
  const rows = db.prepare("SELECT title, city_id, sector FROM jobs").all();
  for (const r of rows) dupKey.add(normTitleKey(r.title, r.city_id ?? "", r.sector));
}

function upsert(j) {
  const cityId = matchCity(j.city);
  const key = `${j.source}:${j.source_id}`;
  const dkey = normTitleKey(j.title, cityId ?? "", j.sector);
  const insert = db.prepare(`
    INSERT INTO jobs (key, source, source_id, title, org, city, city_id, sector, type, posted, deadline, url, first_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET title=excluded.title, org=excluded.org, city=excluded.city, posted=excluded.posted, deadline=excluded.deadline
  `);
  if (dupKey.has(dkey) && !db.prepare("SELECT 1 FROM jobs WHERE key = ?").get(key)) {
    // duplicate job already listed from another source
    return 0;
  }
  dupKey.add(dkey);
  insert.run(
    key,
    j.source,
    j.source_id,
    j.title,
    j.org,
    j.city,
    cityId,
    j.sector,
    j.type,
    j.posted,
    j.deadline ?? null,
    j.url,
    new Date().toISOString().slice(0, 10)
  );
  return 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const report = {};
  const sources = [
    ["rekrute", scrapeRekrute],
    ["marocannonces", scrapeMarocAnnonces],
    ["alwadifa", scrapeAlwadifa],
    ["anapec", scrapeAnapec],
  ];
  for (const [name, fn] of sources) {
    process.stdout.write(`→ scraping ${name}… `);
    try {
      const raw = await fn();
      let added = 0;
      for (const j of raw) added += upsert(j);
      const withCity = raw.filter((j) => matchCity(j.city)).length;
      report[name] = { scraped: raw.length, withCity, added };
      console.log(`${raw.length} jobs (${withCity} with city, ${added} new)`);
    } catch (e) {
      report[name] = { error: e.message };
      console.log(`ERROR: ${e.message}`);
    }
  }

  const counts = db.prepare("SELECT source, COUNT(*) n FROM jobs GROUP BY source").all();
  const total = db.prepare("SELECT COUNT(*) n FROM jobs").get().n;
  console.log("\n=== DB totals ===");
  for (const c of counts) console.log(`  ${c.source}: ${c.n}`);
  console.log(`  TOTAL: ${total}`);
  fs.writeFileSync(
    path.join(DATA_DIR, "last-run.json"),
    JSON.stringify({ at: new Date().toISOString(), report, total }, null, 2)
  );
}

main();
