# CA Analytics

A data pipeline that catches inconsistencies in how adjusted stock prices are computed — and measures how much those inconsistencies would distort a return calculation.

Built for my CS portfolio. Covers 80 stocks: Nifty 50 (India), top 20 S&P 500 (US), and 10 global large-caps.

**Live:** [Deployed on Vercel] · **Pipeline:** GitHub Actions, Mon–Fri 09:00 IST

---

## What problem does this solve?

When a company pays a dividend or splits its stock, every historical price on the chart needs to be adjusted backward. Without this, return calculations are wrong — your chart would show a fake "crash" on the ex-dividend date.

The issue is that different data sources and methods don't always agree on *how* to apply these adjustments. Yahoo Finance runs their own internal adjustment pipeline. This project re-implements the same adjustment from scratch using the corporate action dates and amounts that Yahoo publishes, then compares the two results.

Any gap between them is a real inconsistency — it means someone using Yahoo's Adj Close would report a different return than someone who built their own adjusted series from the same source data.

---

## How it works

**Step 1 — Ingest**

A GitHub Actions job runs every weekday morning and calls `yfinance` to download 3 years of daily OHLCV data for all 80 stocks in a single batched request. Both the raw (unadjusted) close and Yahoo's own Adj Close are stored in separate Postgres tables.

**Step 2 — Build two adjusted series**

- **Series 1:** Yahoo's Adj Close directly (their internal CRSP-style backward adjustment)
- **Series 2:** Raw close + textbook backward adjustment applied from scratch

The textbook algorithm works like this: scan from the most recent date backward. Each time you cross a dividend ex-date, multiply all prior prices by `(P - D) / P`. Each time you cross a split, multiply by `1 / R`. This is the standard method — the same one every finance textbook describes.

**Step 3 — Flag divergences**

Both series should be identical. Any day where they differ by more than **0.5%** and a corporate action falls within 7 calendar days gets flagged. The 0.5% threshold sits above normal floating-point noise (~0.01%) but below what a missed dividend would produce.

**Step 4 — Quantify the impact**

For each flagged stock, the pipeline computes the 3-year cumulative return using each series and reports the gap in percentage points. This is the concrete answer to: *"how much does this inconsistency actually matter?"*

---

## Stack

| Layer | Tech |
|---|---|
| Data | Yahoo Finance via `yfinance` (no API key needed) |
| Pipeline | Python 3.11, GitHub Actions |
| Database | Neon Postgres (serverless) |
| Backend | Next.js 15 API routes, `@neondatabase/serverless` |
| Frontend | React, Recharts, Framer Motion, Vanilla CSS |
| Hosting | Vercel |

---

## Project structure

```
ca-analytics/
├── db/
│   ├── schema.sql        # table definitions (idempotent)
│   └── migrate.py        # run once to create tables + seed universe
├── scripts/
│   ├── ingest.py         # fetch prices + corporate actions, store in Postgres
│   ├── analyze.py        # compute flags + return errors, store results
│   └── requirements.txt
├── src/
│   ├── app/
│   │   ├── api/          # summary, flags, stock detail API routes
│   │   └── page.tsx      # main dashboard
│   └── components/       # KpiCard, FlagsTable, StockDetailPanel, charts, tooltips
└── .github/
    └── workflows/
        └── daily_ingest.yml   # Mon-Fri cron
```

---

## Running it yourself

**Prerequisites:** Python 3.11+, Node 18+, a Neon Postgres database

```bash
# Clone
git clone https://github.com/rishi-msrit/ca-analytics.git
cd ca-analytics

# Install Python deps
pip install -r scripts/requirements.txt

# Set your DB URL
export DATABASE_URL="postgresql://..."

# Create tables + seed the 80-stock universe
python db/migrate.py

# Fetch prices and corporate actions
python scripts/ingest.py

# Run consistency analysis
python scripts/analyze.py

# Install and start the Next.js dev server
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Deployment

**Vercel:**
1. Import the repo
2. Set `DATABASE_URL` as an environment variable (Settings → Environment Variables)
3. Deploy

**GitHub Actions (automated pipeline):**
1. Go to Settings → Secrets and variables → Actions
2. Add `DATABASE_URL` as a repository secret
3. The workflow runs automatically Mon–Fri at 09:00 IST, or trigger it manually from the Actions tab

---

## Universe

| Market | Count | Benchmark |
|---|---|---|
| India | 50 | Nifty 50 |
| USA | 20 | Top S&P 500 by market cap |
| Global | 10 | Large-caps: TSM, ASML, NVO, SAP, SHEL, TM, NESN, LVMH, BHP, RIO |

Nifty 50 composition as of Q1 2025. Updated during index reconstitutions (March/September).

---

## Limitations

- Yahoo Finance rate-limits aggressive fetching. The pipeline uses `yf.download()` for a single batched request rather than 50 individual calls to avoid this.
- `yfinance` data is delayed ~15 minutes and is community-maintained. Don't use this for trading.
- The adjusted price comparison is internally consistent (same source data, different algorithms) rather than cross-vendor. Cross-vendor comparison was the original intent but free NSE data APIs block CI/CD runners, and Stooq added bot protection in mid-2025.
