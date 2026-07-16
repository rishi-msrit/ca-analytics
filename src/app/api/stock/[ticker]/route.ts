import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const db_url = process.env.DATABASE_URL;
  if (!db_url) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const { ticker } = await params;
  // Sanitize: only allow uppercase letters, digits, dots, hyphens
  const safeTicker = ticker.replace(/[^A-Z0-9.\-]/gi, '').toUpperCase();
  if (!safeTicker) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
  }

  try {
    const sql = neon(db_url);

    // Company info + impact summary
    const summaryResult = await sql`
      SELECT
        u.ticker,
        u.company_name,
        u.sector,
        s.max_divergence_pct,
        s.worst_flag_date,
        s.return_yf,
        s.return_stooq_adj,
        s.return_error_pct,
        s.n_flags,
        s.primary_cause,
        s.last_flag_date,
        s.run_at
      FROM nifty50_universe u
      LEFT JOIN impact_summary s ON s.ticker = u.ticker
      WHERE u.ticker = ${safeTicker};
    `;

    if (summaryResult.length === 0) {
      return NextResponse.json({ error: 'Ticker not found in Nifty 50 universe' }, { status: 404 });
    }

    // yfinance price series (last 3 years of adj_close)
    const yfPrices = await sql`
      SELECT date, adj_close AS value
      FROM raw_prices_yf
      WHERE ticker = ${safeTicker}
        AND adj_close IS NOT NULL
      ORDER BY date ASC;
    `;

    // Stooq price series
    const stooqPrices = await sql`
      SELECT date, close AS value
      FROM raw_prices_stooq
      WHERE ticker = ${safeTicker}
        AND close IS NOT NULL
      ORDER BY date ASC;
    `;

    // Corporate actions (for chart annotations)
    const actions = await sql`
      SELECT ex_date, action_type, value
      FROM corporate_actions_yf
      WHERE ticker = ${safeTicker}
      ORDER BY ex_date ASC;
    `;

    // Flagged divergence dates
    const flags = await sql`
      SELECT
        flag_date,
        adj_close_yf,
        adj_close_stooq,
        divergence_pct,
        nearby_action,
        nearby_action_value,
        nearby_action_date
      FROM consistency_flags
      WHERE ticker = ${safeTicker}
      ORDER BY flag_date ASC;
    `;

    const s = summaryResult[0];
    return NextResponse.json({
      ticker: s.ticker,
      companyName: s.company_name,
      sector: s.sector,
      summary: {
        maxDivergencePct: s.max_divergence_pct ? parseFloat(s.max_divergence_pct) : null,
        worstFlagDate: s.worst_flag_date,
        returnYf: s.return_yf ? parseFloat(s.return_yf) : null,
        returnStooqAdj: s.return_stooq_adj ? parseFloat(s.return_stooq_adj) : null,
        returnErrorPct: s.return_error_pct ? parseFloat(s.return_error_pct) : null,
        nFlags: s.n_flags ? Number(s.n_flags) : 0,
        primaryCause: s.primary_cause,
        lastFlagDate: s.last_flag_date,
        runAt: s.run_at,
      },
      yfPrices: yfPrices.map((r) => ({
        date: r.date,
        value: r.value ? parseFloat(r.value) : null,
      })),
      stooqPrices: stooqPrices.map((r) => ({
        date: r.date,
        value: r.value ? parseFloat(r.value) : null,
      })),
      corporateActions: actions.map((r) => ({
        exDate: r.ex_date,
        actionType: r.action_type,
        value: r.value ? parseFloat(r.value) : null,
      })),
      flags: flags.map((r) => ({
        flagDate: r.flag_date,
        adjCloseYf: r.adj_close_yf ? parseFloat(r.adj_close_yf) : null,
        adjCloseStooq: r.adj_close_stooq ? parseFloat(r.adj_close_stooq) : null,
        divergencePct: r.divergence_pct ? parseFloat(r.divergence_pct) : null,
        nearbyAction: r.nearby_action,
        nearbyActionValue: r.nearby_action_value ? parseFloat(r.nearby_action_value) : null,
        nearbyActionDate: r.nearby_action_date,
      })),
    });
  } catch (err) {
    console.error(`[/api/stock/${safeTicker}]`, err);
    return NextResponse.json(
      { error: 'Failed to load stock detail data', detail: String(err) },
      { status: 500 }
    );
  }
}
