"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { CITIES } from "@/data/cities";
import type { Job, Sector } from "@/data/jobs";

type Filter = "all" | Sector;

// ===== Fuzzy search helpers =====

// Levenshtein distance: how many single-character edits turn `a` into `b`
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Common alternate spellings / short forms people actually type
const ALIASES: Record<string, string[]> = {
  casablanca: ["casa", "casablanca", "dar baida", "aldaralbaidaa", "الدار البيضاء", "دار البيضاء", "الدارالبيضاء", "دربيضاء"],
  rabat: ["rbat", "الرباط", "رباط"],
  marrakech: ["marakesh", "marakech", "marrakesh", "مراكش", "مراكص", "مراكش"],
  fes: ["fez", "فاس", "فإس"],
  tanger: ["tanja", "tangier", "tanger", "طنجة", "طنجه"],
  meknes: ["meknas", "مكناس", "مكنيس"],
  kenitra: ["qnitra", "kénitra", "قنيطرة", "كنيترا"],
  agadir: ["agadir", "agader", "أكادير", "اكادير", "أكاديا"],
  oujda: ["oujda", "وجدة", "وجده"],
  tetouan: ["tetuan", "تطوان", "تيطوان"],
  laayoune: ["el aioun", "laayoune", "العيون", "لايون"],
  dakhla: ["الداخلة", "داخلة"],
  essaouira: ["mogador", "الصويرة", "اسوايرا"],
  safi: ["asfi", "آسفي", "اسفي"],
  eljadida: ["el jadida", "الجديدة", "جديدة"],
  "beni-mellal": ["beni mellal", "بني ملال", "بني ملال"],
  nador: ["الناظور", "ناضور"],
  ouarzazate: ["ouarzazat", "ورزازات", "وارزازات"],
  errachidia: ["erachidia", "الرشيدية", "رشيدية"],
  alhoceima: ["al hoceima", "alhucemas", "الحسيمة", "حسيمة"],
  guelmim: ["guelmime", "كلميم", "كلليم"],
  khouribga: ["خريبكة", "خريبكا"],
  settat: ["سطات", "ستات"],
  sale: ["سلا", "سالا"],
};

function fuzzyThreshold(len: number): number {
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

const FILTERS: { id: Filter; label: string; sub: string; dot: string }[] = [
  { id: "all", label: "الكل", sub: "Tous", dot: "bg-gradient-to-br from-sky-400 to-emerald-400" },
  { id: "private", label: "القطاع الخاص", sub: "Entreprises", dot: "bg-amber-400" },
  { id: "public", label: "القطاع العام", sub: "مباريات · Concours", dot: "bg-emerald-400" },
];

const LS_SAVED = "jobmap.saved";
const LS_SEEN = "jobmap.seen";
const LS_LAST = "jobmap.lastVisit";

// panel ordering: expiring soonest → no deadline (newest posted) → expired last
function sortJobsForPanel(list: Job[]): Job[] {
  const rank = (d: number | null) => (d === null ? 1 : d < 0 ? 2 : 0);
  return [...list].sort((a, b) => {
    const da = daysLeft(a.deadline);
    const dbb = daysLeft(b.deadline);
    const r = rank(da) - rank(dbb);
    if (r !== 0) return r;
    if (da !== null && dbb !== null) return da - dbb;
    return b.posted.localeCompare(a.posted);
  });
}

function markerSize(count: number) {
  return Math.min(46, 20 + count * 4);
}

// ===== Deadlines =====
function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T23:59:59` : iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function frD(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCity, setSelectedCity] = useState<string | null>(() => {
    // shareable links: /?city=rabat opens the map already focused on Rabat
    if (typeof window === "undefined") return null;
    try {
      const c = new URLSearchParams(window.location.search).get("city");
      return c && CITIES.some((x) => x.id === c) ? c : null;
    } catch {
      return null;
    }
  });
  const [mapReady, setMapReady] = useState(false);
  const [query, setQuery] = useState("");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const jobsRef = useRef<Job[]>([]);

  // ===== Saved jobs (⭐) + "new since last visit" — all in localStorage =====
  useEffect(() => {
    try {
      setSavedIds(JSON.parse(localStorage.getItem(LS_SAVED) || "[]"));
      setSeenIds(new Set(JSON.parse(localStorage.getItem(LS_SEEN) || "[]")));
    } catch {}
    if (!localStorage.getItem(LS_LAST)) {
      localStorage.setItem(LS_LAST, String(Date.now()));
      setFirstVisit(true);
    }
  }, []);

  // first visit: seed everything as seen so new badges don't flood the screen
  useEffect(() => {
    if (!firstVisit || jobs.length === 0) return;
    const ids = jobs.map((j) => j.id);
    setSeenIds(new Set(ids));
    try {
      localStorage.setItem(LS_SEEN, JSON.stringify(ids.slice(-3000)));
    } catch {}
    setFirstVisit(false);
  }, [firstVisit, jobs]);

  // when the visitor leaves the page, everything currently loaded becomes "seen"
  useEffect(() => {
    const markSeen = () => {
      try {
        localStorage.setItem(LS_SEEN, JSON.stringify(jobsRef.current.map((j) => j.id).slice(-3000)));
      } catch {}
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") markSeen();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", markSeen);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", markSeen);
    };
  }, []);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // keep the URL in sync so any city view can be shared: /?city=rabat
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (selectedCity) url.searchParams.set("city", selectedCity);
      else url.searchParams.delete("city");
      window.history.replaceState(null, "", url);
    } catch {}
  }, [selectedCity]);

  // when arriving via a job suggestion, scroll to it and highlight it briefly
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => {
      document
        .querySelector(`[data-job-id="${CSS.escape(highlightId)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1300);
    const clear = setTimeout(() => setHighlightId(null), 6000);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [highlightId]);

  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      try {
        localStorage.setItem(LS_SAVED, JSON.stringify(next.slice(0, 500)));
      } catch {}
      return next;
    });

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const newIdsSet = useMemo(() => {
    const cutoff = Date.now() - 3 * 86_400_000;
    return new Set(
      jobs.filter((j) => !seenIds.has(j.id) && (Date.parse(j.posted) || 0) >= cutoff).map((j) => j.id)
    );
  }, [jobs, seenIds]);

  // Load jobs — and re-fetch every 2 minutes so freshly scraped offers appear live
  useEffect(() => {
    let stopped = false;
    const load = () =>
      fetch("/api/jobs")
        .then((r) => r.json())
        .then((d) => {
          if (!stopped) setJobs(d.jobs ?? []);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 2 * 60 * 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    let cancelled = false;

    // Browsers pause rAF (and thus map loading/animations) for hidden windows.
    // Shim BEFORE importing maplibre so its internal frame loop uses the fallback too.
    const w = window as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number };
    const originalRAF = w.requestAnimationFrame.bind(window);
    w.requestAnimationFrame = (cb: (t: number) => void) => {
      if (document.hidden) return window.setTimeout(() => cb(performance.now()), 16);
      return originalRAF(cb);
    };

    (async () => {
      const mod = await import("maplibre-gl");
      const maplibregl = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            basemap: {
              type: "raster",
              tiles: [
                "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              maxzoom: 16,
              attribution: "Tiles © Esri — Source: Esri, HERE, Garmin, FAO, NOAA, USGS",
            },
            morocco: { type: "geojson", data: "/morocco.geojson" },
            mask: { type: "geojson", data: "/morocco-mask.geojson" },
          },
          layers: [
            { id: "bg", type: "raster", source: "basemap" },
            {
              // Hide everything outside Morocco so only Morocco shows
              id: "world-mask",
              type: "fill",
              source: "mask",
              paint: { "fill-color": "#070d14", "fill-opacity": 1 },
            },
            {
              id: "morocco-fill",
              type: "fill",
              source: "morocco",
              paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.07 },
            },
            {
              id: "morocco-line",
              type: "line",
              source: "morocco",
              paint: { "line-color": "#38bdf8", "line-width": 1.4, "line-opacity": 0.75 },
            },
          ],
        },
        center: [-6.9, 31.6],
        zoom: 5.2,
        minZoom: 4.5,
        maxBounds: [-18.5, 20, -0.5, 37.5],
        attributionControl: { compact: true },
        // Full interactivity: mouse, touch, and keyboard
        dragPan: true,
        dragRotate: false,
        scrollZoom: true,
        touchZoomRotate: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: true,
      });
      mapRef.current = map;
      (window as unknown as Record<string, unknown>).__map = map; // debug hook
      map.once("load", () => setMapReady(true));
      map.on("error", (e) => console.error("[maplibre]", e?.error?.message ?? e));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Rebuild city markers when data or filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    (async () => {
      const mod = await import("maplibre-gl");
      const maplibregl = (mod as unknown as { default?: typeof mod }).default ?? mod;
      for (const city of CITIES) {
        const cityJobs = jobs.filter(
          (j) => j.cityId === city.id && (filter === "all" || j.sector === filter)
        );
        if (cityJobs.length === 0) continue;

        const size = markerSize(cityJobs.length);
        const el = document.createElement("div");
        el.className = "city-marker" + (selectedCity === city.id ? " is-selected" : "");
        el.innerHTML = `
          <div class="city-dot" style="--s:${size}px"><span>${cityJobs.length}</span></div>
          <div class="city-name">${city.nameAr}<small>${city.nameFr}</small></div>
        `;
        el.addEventListener("click", () => {
          setSelectedCity(city.id);
          mapRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 8, duration: 900 });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([city.lng, city.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    })();
  }, [jobs, filter, selectedCity, mapReady]);

  const stats = useMemo(() => {
    const visible = jobs.filter((j) => filter === "all" || j.sector === filter);
    const urgent = jobs.filter((j) => {
      const d = daysLeft(j.deadline);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    return {
      total: visible.length,
      private: jobs.filter((j) => j.sector === "private").length,
      public: jobs.filter((j) => j.sector === "public").length,
      urgent,
    };
  }, [jobs, filter]);

  const selected = CITIES.find((c) => c.id === selectedCity) ?? null;
  const selectedJobs = useMemo(() => {
    if (!selected) return [];
    return sortJobsForPanel(
      jobs.filter((j) => j.cityId === selected.id && (filter === "all" || j.sector === filter))
    );
  }, [selected, jobs, filter]);
  const visibleJobs = urgentOnly
    ? selectedJobs.filter((j) => {
        const d = daysLeft(j.deadline);
        return d !== null && d >= 0 && d <= 7;
      })
    : selectedJobs;
  const selectedUrgent = selectedJobs.filter((j) => {
    const d = daysLeft(j.deadline);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  // ===== City search (Arabic + French, typo-tolerant) =====
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents: Agadir == Agadír
      .toLowerCase()
      .replace(/[\u064B-\u0652]/g, "") // strip Arabic diacritics
      .replace(/\s+/g, "") // ignore spaces: الدارالبيضاء == الدار البيضاء
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .trim();

  const suggestions = useMemo(() => {
    const raw = query.trim();
    if (raw.length < 1) return [];
    const q = norm(raw);
    if (!q) return [];
    const thr = fuzzyThreshold(q.length);

    // Build candidate strings per city with a base score per match type
    type Cand = { cityId: string; score: number };
    const best = new Map<string, number>();

    const consider = (cityId: string, score: number) => {
      const cur = best.get(cityId);
      if (cur === undefined || score < cur) best.set(cityId, score);
    };

    for (const c of CITIES) {
      const nameFrN = norm(c.nameFr);
      const nameArN = norm(c.nameAr);
      const regionN = norm(c.region);
      const aliasesN = (ALIASES[c.id] ?? []).map(norm);

      // 0 = exact, 1 = starts with, 2 = contains
      let localBest = Infinity;
      for (const cand of [nameFrN, nameArN, regionN, ...aliasesN]) {
        if (!cand) continue;
        if (cand === q) localBest = Math.min(localBest, 0);
        else if (cand.startsWith(q)) localBest = Math.min(localBest, 1);
        else if (cand.includes(q)) localBest = Math.min(localBest, 2);
        // fuzzy: allow a few wrong letters
        const d = lev(q, cand);
        if (d <= thr) localBest = Math.min(localBest, 3 + d);
      }
      if (localBest < Infinity) consider(c.id, localBest);
    }

    return [...best.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 6)
      .map(([cityId, score]) => ({
        city: CITIES.find((c) => c.id === cityId)!,
        fuzzy: score >= 3,
      }));
  }, [query]);

  // keyword matches inside job titles and organizations: "comptable", "attijari"…
  const jobMatches = useMemo(() => {
    const raw = query.trim();
    if (raw.length < 2) return [];
    const q = norm(raw);
    if (!q) return [];
    const out: { job: Job; score: number }[] = [];
    for (const j of jobs) {
      const t = norm(`${j.title} ${j.org}`);
      let score = Infinity;
      if (t.startsWith(q)) score = 0;
      else if (t.includes(q)) score = 1;
      if (score < Infinity) out.push({ job: j, score });
    }
    return out.sort((a, b) => a.score - b.score).slice(0, 5);
  }, [query, jobs]);

  const goToCity = (city: (typeof CITIES)[number]) => {
    setSelectedCity(city.id);
    setQuery("");
    mapRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 8.5, duration: 1200 });
  };

  // open the job's city, fly there, and highlight the exact job card
  const goToJob = (job: Job) => {
    setQuery("");
    const city = CITIES.find((c) => c.id === job.cityId);
    if (!city) {
      setHighlightId(job.id);
      return;
    }
    setSelectedCity(city.id);
    setShowSaved(false);
    setHighlightId(job.id);
    mapRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 8.5, duration: 1200 });
  };
  // ===== "Use my location" — find the nearest city to the user =====
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoMsg("الموقع غير مدعوم في متصفحك");
      return;
    }
    setGeoMsg("جارٍ تحديد موقعك…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best: (typeof CITIES)[number] | null = null;
        let bestD = Infinity;
        for (const c of CITIES) {
          const d = (c.lat - latitude) ** 2 + (c.lng - longitude) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best) {
          setGeoMsg(null);
          goToCity(best);
        }
      },
      () => setGeoMsg("تعذّر تحديد موقعك — ابحث عن مدينتك يدوياً"),
      { timeout: 10000, maximumAge: 60000 }
    );
    setTimeout(() => setGeoMsg((m) => (m === "جارٍ تحديد موقعك…" ? null : m)), 12000);
  };

  return (
    <div className="min-h-screen bg-[#070d14] text-slate-100" dir="rtl">
      {/* ===== Page header ===== */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070d14]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-extrabold leading-tight md:text-lg">
              خريطة الوظيفة<span className="text-sky-400"> · Maroc</span>
            </h1>
            <p className="hidden text-[10px] text-slate-500 sm:block">
              كل فرص الشغل بالمغرب — على الخريطة
            </p>
          </div>
          <div className="flex gap-1.5">
            <Stat value={stats.total} label="منصب" />
            <Stat value={stats.private} label="خاص" accent="text-amber-400" />
            <Stat value={stats.public} label="عام" accent="text-emerald-400" />
            <Stat value={stats.urgent} label="⏳ قريباً" accent="text-red-400" />
            <Stat value={newIdsSet.size} label="جديد 🆕" accent="text-emerald-300" />
            <button
              onClick={() => setShowSaved((v) => !v)}
              aria-pressed={showSaved}
              title="العروض المحفوظة ⭐"
              className={`rounded-lg border px-2.5 py-1.5 text-center backdrop-blur-md transition ${
                showSaved
                  ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                  : "border-white/10 bg-black/50 text-slate-300 hover:bg-white/10 hover:text-amber-200"
              }`}
            >
              <p className="text-base font-extrabold leading-none">⭐ {savedIds.length}</p>
              <p className="mt-0.5 text-[9px] text-slate-500">محفوظة</p>
            </button>
          </div>
        </div>
      </header>

      {/* ===== Main content ===== */}
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 md:px-6">
        {/* Map card — big rounded box, not fullscreen */}
        <div className="relative h-[72vh] min-h-[540px] overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(14,165,233,0.12)]">
          {/* Map canvas — inline style beats maplibre's own CSS that collapses the container */}
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

          {/* Sector toggle (inside map, top center) */}
          <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
            <div
              className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-md"
              role="tablist"
              aria-label="تصفية حسب القطاع"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-all md:px-5 ${
                    filter === f.id
                      ? "bg-white/10 font-bold text-white shadow-[0_0_24px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/40"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${f.dot}`} />
                  <span className="flex flex-col items-start leading-none">
                    <span>{f.label}</span>
                    <span className="mt-0.5 text-[9px] text-slate-500">{f.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ===== "Where do you live?" city search ===== */}
          <div className="absolute top-[4.6rem] left-1/2 z-20 w-[19rem] -translate-x-1/2 md:top-[4.8rem] md:w-[22rem]">
            <div className="relative">
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (suggestions.length > 0) goToCity(suggestions[0].city);
                    else if (jobMatches.length > 0) goToJob(jobMatches[0].job);
                  }
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder="أين تسكن؟ مدينتك أو نوع الشغل: أكادير / comptable"
                className="w-full rounded-xl border border-white/15 bg-black/65 py-2.5 pe-9 ps-10 text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur-md focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <button
                onClick={useMyLocation}
                aria-label="استخدم موقعي الحالي"
                title="استخدم موقعي الحالي 📍"
                className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-sm transition hover:bg-sky-400/15"
              >
                📍
              </button>

              {/* Suggestions dropdown — cities + keyword job matches */}
              {query.trim().length > 0 && (suggestions.length > 0 || jobMatches.length > 0) && (
                <ul className="absolute top-full z-40 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a1220]/95 shadow-2xl backdrop-blur-lg">
                  {suggestions.length > 0 && (
                    <li className="border-b border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] font-semibold text-sky-300">
                      المدن 🏙️
                    </li>
                  )}
                  {suggestions.some((s) => s.fuzzy) && (
                    <li className="border-b border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] text-slate-500">
                      هل تقصد… ✍️
                    </li>
                  )}
                  {suggestions.map(({ city: c, fuzzy }) => {
                    const n = jobs.filter((j) => j.cityId === c.id).length;
                    return (
                      <li key={c.id} className="border-b border-white/10">
                        <button
                          onClick={() => goToCity(c)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-right transition hover:bg-sky-400/10"
                        >
                          <span>
                            <span className="block text-sm font-bold">
                              {c.nameAr}
                              {fuzzy && <span className="ms-2 text-[9px] font-normal text-amber-400">تصحيح تلقائي</span>}
                            </span>
                            <span className="block text-[10px] text-slate-500">{c.nameFr} · {c.region}</span>
                          </span>
                          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            {n} منصب
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {jobMatches.length > 0 && (
                    <li className="border-b border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] font-semibold text-amber-300">
                      عروض مطابقة 💼
                    </li>
                  )}
                  {jobMatches.map(({ job }) => {
                    const city = CITIES.find((c) => c.id === job.cityId);
                    return (
                      <li key={job.id} className="border-b border-white/10 last:border-0">
                        <button
                          onClick={() => goToJob(job)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-right transition hover:bg-amber-400/10"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold">{job.title}</span>
                            <span className="block truncate text-[10px] text-slate-500">
                              {job.org !== "—" ? `${job.org} · ` : ""}
                              {city ? city.nameAr : "المغرب"}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                            {job.source}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Geolocation message */}
              {geoMsg && (
                <p className="absolute top-full z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0a1220]/95 px-4 py-2 text-center text-xs text-slate-300 backdrop-blur-lg">
                  {geoMsg}
                </p>
              )}
            </div>
          </div>

          {/* Saved jobs panel (⭐) */}
          {showSaved && (
            <aside className="absolute inset-y-0 left-0 z-30 flex w-full max-w-sm flex-col border-e border-white/10 bg-[#0a1220]/95 backdrop-blur-lg">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                <div>
                  <h2 className="text-xl font-bold">⭐ المحفوظات</h2>
                  <p className="mt-1 text-sm text-amber-300">{savedIds.length} عرض محفوظ</p>
                </div>
                <button
                  onClick={() => setShowSaved(false)}
                  aria-label="إغلاق"
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4 scroll-slim">
                {sortJobsForPanel(jobs.filter((j) => savedSet.has(j.id))).map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isNew={newIdsSet.has(job.id)}
                    saved
                    onToggleSave={() => toggleSave(job.id)}
                  />
                ))}
                {savedIds.length === 0 && (
                  <p className="py-10 text-center text-sm leading-relaxed text-slate-500">
                    لم تحفظ أي عرض بعد.<br />
                    اضغط ☆ على أي عرض لحفظه هنا ⭐
                  </p>
                )}
              </div>
            </aside>
          )}

          {/* Selected city panel */}
          {!showSaved && selected && (
            <aside className="absolute inset-y-0 left-0 z-30 flex w-full max-w-sm flex-col border-e border-white/10 bg-[#0a1220]/95 backdrop-blur-lg">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                <div>
                  <h2 className="text-xl font-bold">{selected.nameAr}</h2>
                  <p className="text-xs text-slate-400">
                    {selected.nameFr} · {selected.region}
                  </p>
                  <p className="mt-1 text-sm text-sky-400">{selectedJobs.length} منصب متوفر</p>
                  {selectedUrgent > 0 && (
                    <button
                      onClick={() => setUrgentOnly((v) => !v)}
                      aria-pressed={urgentOnly}
                      className={`mt-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        urgentOnly
                          ? "bg-red-400/20 text-red-200 ring-1 ring-red-400/50"
                          : "bg-white/5 text-slate-300 hover:bg-red-400/10"
                      }`}
                    >
                      ⏳ {urgentOnly ? "إلغاء" : "تنتهي قريباً"} ({selectedUrgent})
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/?city=${selected.id}`;
                      try {
                        await navigator.clipboard.writeText(url);
                      } catch {
                        const ta = document.createElement("textarea");
                        ta.value = url;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        ta.remove();
                      }
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    aria-label="مشاركة رابط هذه المدينة"
                    title="انسخ رابط هذه المدينة 🔗"
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {copied ? "✓ تم نسخ الرابط" : "🔗 مشاركة"}
                  </button>
                  <button
                    onClick={() => setSelectedCity(null)}
                    aria-label="إغلاق"
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4 scroll-slim">
                {visibleJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isNew={newIdsSet.has(job.id)}
                    saved={savedSet.has(job.id)}
                    highlight={highlightId === job.id}
                    onToggleSave={() => toggleSave(job.id)}
                  />
                ))}
                {visibleJobs.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-500">
                    {urgentOnly
                      ? "لا توجد مباريات تنتهي قريباً في هذه المدينة."
                      : "لا توجد عروض بهذا القطاع في هذه المدينة حالياً."}
                  </p>
                )}
              </div>
            </aside>
          )}

          {/* Map control buttons */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
            <CtrlButton label="تكبير" onClick={() => mapRef.current?.zoomIn({ duration: 300 })}>＋</CtrlButton>
            <CtrlButton label="تصغير" onClick={() => mapRef.current?.zoomOut({ duration: 300 })}>−</CtrlButton>
            <CtrlButton
              label="إعادة العرض"
              onClick={() =>
                mapRef.current?.flyTo({ center: [-6.9, 31.6], zoom: 5.2, duration: 900 })
              }
            >
              ⌂
            </CtrlButton>
          </div>

          {/* Legend + gesture hint */}
          <div className="absolute bottom-4 right-4 z-20 hidden rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-[11px] backdrop-blur-md md:block">
            <p className="mb-1.5 font-semibold text-slate-300">حجم النقطة = عدد المناصب</p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> خاص — شركة</p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> عام — مباريات</p>
            <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-slate-500">
              🖱️ حرك بالسحب · ⚡ قرّب بعجلة الفأرة أو نقرة مزدوجة<br />
              📱 على الهاتف: قرّب بإصبعين واسحب بإصبع واحد
            </p>
          </div>
        </div>

        {/* Quick info strip under the map */}
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoCard
            title="مصادر مباشرة"
            text="العروض مجمّعة من Rekrute · Alwadifa · Anapec · MarocAnnonces"
          />
          <InfoCard
            title="تحديث تلقائي"
            text="عروض جديدة تُضاف للخريطة كل يوم دون تدخل"
          />
          <InfoCard
            title="قطاعان في مكان واحد"
            text="الشركات الخاصة ومباريات القطاع العام على نفس الخريطة"
          />
        </section>
      </main>

      <footer className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        خريطة الوظيفة · Maroc — كل فرص الشغل على الخريطة
      </footer>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-slate-200">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}

function Stat({ value, label, accent = "text-sky-400" }: { value: number; label: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-center backdrop-blur-md">
      <p className={`text-base font-extrabold leading-none ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[9px] text-slate-500">{label}</p>
    </div>
  );
}

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-black/60 text-xl font-bold text-slate-200 backdrop-blur-md transition hover:scale-105 hover:border-sky-400/50 hover:bg-sky-400/10 hover:text-white active:scale-95"
    >
      {children}
    </button>
  );
}

function DeadlineBadge({ deadline }: { deadline?: string | null }) {
  const d = daysLeft(deadline);
  if (d === null) return null;
  if (d < 0)
    return (
      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
        انتهى الأجل
      </span>
    );
  if (d === 0)
    return (
      <span className="animate-pulse rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 ring-1 ring-red-400/40">
        ⏳ ينتهي اليوم!
      </span>
    );
  if (d === 1)
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
        ⏳ ينتهي غداً
      </span>
    );
  if (d <= 7)
    return (
      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
        ⏳ متبقي {d === 2 ? "يومين" : d <= 10 ? `${d} أيام` : `${d} يوماً`}
      </span>
    );
  return (
    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
      ⏳ ينتهي {frD(deadline!)}
    </span>
  );
}

function JobCard({
  job,
  isNew = false,
  saved = false,
  highlight = false,
  onToggleSave,
}: {
  job: Job;
  isNew?: boolean;
  saved?: boolean;
  highlight?: boolean;
  onToggleSave?: () => void;
}) {
  const isPublic = job.sector === "public";
  const expired = (daysLeft(job.deadline) ?? 1) < 0;
  return (
    <div
      data-job-id={job.id}
      className={`relative rounded-xl border p-3.5 transition ${
        highlight
          ? "border-amber-400/70 bg-amber-400/10 ring-2 ring-amber-400/40"
          : expired
            ? "border-white/10 bg-white/[0.02] opacity-55"
            : "border-white/10 bg-white/[0.04] hover:border-sky-400/40 hover:bg-white/[0.08]"
      }`}
    >
      {/* click-through link covering the whole card */}
      <a
        href={job.url}
        target="_blank"
        rel="noreferrer"
        aria-label={job.title}
        className="absolute inset-0 z-10 rounded-xl"
      />
      {/* save / unsave — above the link so it doesn't open the offer */}
      {onToggleSave && (
        <button
          onClick={onToggleSave}
          aria-label={saved ? "إزالة من المحفوظات" : "حفظ العرض"}
          className={`absolute left-1.5 top-1.5 z-20 grid h-8 w-8 place-items-center rounded-lg text-lg transition ${
            saved ? "text-amber-300" : "text-slate-500 hover:bg-white/10 hover:text-amber-200"
          }`}
        >
          {saved ? "★" : "☆"}
        </button>
      )}
      <div className="pointer-events-none select-none pe-10">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isPublic ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
            }`}
          >
            {isPublic ? "عام · مباراة" : "خاص · شركة"}
          </span>
          {isNew && (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              جديد
            </span>
          )}
          <span className="text-[10px] text-slate-500">{job.source}</span>
          <DeadlineBadge deadline={job.deadline} />
        </div>
        <p className="text-sm font-semibold leading-snug">{job.title}</p>
        <p className="mt-1 text-xs text-slate-400">{job.org}</p>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>{job.type}</span>
          <span>{job.posted}</span>
        </div>
      </div>
    </div>
  );
}
