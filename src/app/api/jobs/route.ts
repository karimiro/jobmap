import { NextResponse } from "next/server";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { SAMPLE_JOBS } from "@/data/jobs";

// GET /api/jobs — reads real scraped jobs from data/jobs.db (filled by scripts/scrape.mjs)
export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), "data", "jobs.db");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db
      .prepare(
        "SELECT key, source, title, org, city_id, sector, type, posted, deadline, url FROM jobs ORDER BY posted DESC"
      )
      .all();
    const jobs = rows.map((r) => ({
      id: r.key,
      title: r.title,
      org: r.org || "—",
      cityId: r.city_id || null,
      sector: r.sector,
      type: r.type,
      source: r.source,
      posted: r.posted,
      deadline: r.deadline || null,
      url: r.url,
    }));
    return NextResponse.json({ jobs });
  } catch {
    // DB not ready yet — fall back to sample data so the site always works
    return NextResponse.json({ jobs: SAMPLE_JOBS });
  }
}
