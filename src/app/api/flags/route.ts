import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const db_url = process.env.DATABASE_URL;
  if (!db_url) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') ?? 'return_error_pct';
  const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;
  const filterCause = searchParams.get('cause');

  // Allowlist sort columns (prevents SQL injection via string interpolation below)
  const allowedSortCols: Record<string, string> = {
    return_error_pct: 'return_error_pct',
    max_divergence_pct: 'max_divergence_pct',
    n_flags: 'n_flags',
    worst_flag_date: 'worst_flag_date',
    ticker: 'ticker',
    company_name: 'company_name',
  };
  const sortCol = allowedSortCols[sort] ?? 'return_error_pct';
  const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

  // Allowlist cause filter
  const allowedCauses = new Set(['dividend', 'split', 'both']);
  const safeCause = filterCause && allowedCauses.has(filterCause) ? filterCause : null;

  try {
    const sql = neon(db_url);

    // Build separate typed queries for each case.
    // The Neon serverless driver uses tagged template literals; column names
    // cannot be parameterised, so we use pre-allowlisted string interpolation.
    let rows: Record<string, unknown>[];
    let total: number;

    if (safeCause) {
      const countRes = await sql`
        SELECT COUNT(*) AS cnt
        FROM impact_summary
        WHERE n_flags > 0 AND primary_cause = ${safeCause};
      `;
      total = Number(countRes[0]?.cnt ?? 0);

      // Dynamic ORDER BY with allowlisted column — safe because sortCol comes from allowedSortCols
      rows = await sql.query(
        `SELECT ticker, company_name, max_divergence_pct, worst_flag_date,
                return_yf, return_stooq_adj, return_error_pct,
                n_flags, primary_cause, last_flag_date, run_at
         FROM impact_summary
         WHERE n_flags > 0 AND primary_cause = $1
         ORDER BY ${sortCol} ${safeOrder} NULLS LAST
         LIMIT $2 OFFSET $3`,
        [safeCause, limit, offset]
      ) as Record<string, unknown>[];
    } else {
      const countRes = await sql`
        SELECT COUNT(*) AS cnt FROM impact_summary WHERE n_flags > 0;
      `;
      total = Number(countRes[0]?.cnt ?? 0);

      rows = await sql.query(
        `SELECT ticker, company_name, max_divergence_pct, worst_flag_date,
                return_yf, return_stooq_adj, return_error_pct,
                n_flags, primary_cause, last_flag_date, run_at
         FROM impact_summary
         WHERE n_flags > 0
         ORDER BY ${sortCol} ${safeOrder} NULLS LAST
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ) as Record<string, unknown>[];
    }

    return NextResponse.json({
      data: rows.map((r) => ({
        ticker: r.ticker,
        companyName: r.company_name,
        maxDivergencePct: r.max_divergence_pct != null ? parseFloat(String(r.max_divergence_pct)) : null,
        worstFlagDate: r.worst_flag_date,
        returnYf: r.return_yf != null ? parseFloat(String(r.return_yf)) : null,
        returnStooqAdj: r.return_stooq_adj != null ? parseFloat(String(r.return_stooq_adj)) : null,
        returnErrorPct: r.return_error_pct != null ? parseFloat(String(r.return_error_pct)) : null,
        nFlags: Number(r.n_flags),
        primaryCause: r.primary_cause,
        lastFlagDate: r.last_flag_date,
        runAt: r.run_at,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[/api/flags]', err);
    return NextResponse.json(
      { error: 'Failed to load flags data', detail: String(err) },
      { status: 500 }
    );
  }
}
