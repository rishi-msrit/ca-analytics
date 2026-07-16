import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const sql = neon(dbUrl);

    const [flags, stocks, maxErr, lastRun, universe] = await Promise.all([
      sql`SELECT COUNT(*) AS total FROM consistency_flags;`,
      sql`SELECT COUNT(*) AS n FROM impact_summary WHERE n_flags > 0;`,
      sql`SELECT MAX(return_error_pct) AS val FROM impact_summary WHERE return_error_pct IS NOT NULL;`,
      sql`SELECT MAX(run_at) AS ts FROM impact_summary;`,
      sql`SELECT COUNT(*) AS n FROM nifty50_universe;`,
    ]);

    return NextResponse.json({
      totalFlags: Number(flags[0]?.total ?? 0),
      stocksAffected: Number(stocks[0]?.n ?? 0),
      maxReturnError: maxErr[0]?.val ? parseFloat(maxErr[0].val) : null,
      lastRunAt: lastRun[0]?.ts ?? null,
      universeSize: Number(universe[0]?.n ?? 50),
    });
  } catch (err) {
    console.error('[/api/summary]', err);
    return NextResponse.json({ error: 'Failed to load summary', detail: String(err) }, { status: 500 });
  }
}
