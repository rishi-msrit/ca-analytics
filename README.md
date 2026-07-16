# CA Analytics — Nifty 50 Corporate Actions Consistency Monitor

[![Daily Ingestion](https://github.com/your-username/ca-analytics/actions/workflows/daily_ingest.yml/badge.svg)](https://github.com/your-username/ca-analytics/actions/workflows/daily_ingest.yml)

A data-pipeline project that detects and quantifies inconsistencies in corporate-action-adjusted stock prices across two independent data sources for all 50 Nifty 50 constituents, and visualises the impact on return calculations in a custom React dashboard.

---

## What it does and why

Stock prices must be adjusted for corporate events — dividends and stock splits — to produce correct historical return calculations. A return calculated on unadjusted prices will appear to show a large loss on the day of a 2:1 split, for example, when no economic loss actually occurred.

Different data vendors apply these adjustments differently: they may use a different effective date, a different rounding method, or a slightly different adjustment factor derived from a different source for the dividend amount or split ratio. This means the "same" stock's 3-year price history can disagree across data sources in ways that are invisible unless you specifically look for them — and those disagreements directly distort return calculations.

This project:
1. Pulls 3 years of daily price and corporate-action data for all Nifty 50 stocks from two independent sources.
2. Constructs two independently-adjusted price series for each stock.
3. Flags any date where the two series diverge by more than 0.5% and a corporate action exists nearby.
4. Calculates the actual return-calculation error: how many percentage points wrong would a 3-year return figure be if the analyst used the less accurate source?
5. Presents all of this in a dashboard sorted by the severity of the distortion.

---

## Data Sources

### Source 1 — Yahoo Finance (via `yfinance`)
- **What is fetched**: 3-year daily OHLCV with unadjusted close, Yahoo's proprietary adjusted close (Adj Close), and the explicit corporate action history (dividend amounts, split ratios, and ex-dates).
- **Adjusted series**: Yahoo's Adj Close uses a backward CRSP-style adjustment applied by Yahoo's own internal pipeline.
- **No API key required.**

### Source 2 — Stooq (via `pandas_datareader`)

> **Substitution note**: The original specification called for NSE India's own published corporate actions data as the second source. After investigation, NSE India's website (`nseindia.com`) applies aggressive anti-scraping protections (session cookies, Cloudflare-like bot detection, frequently-rotating JSON endpoints) that make reliable automated access from a GitHub Actions runner not achievable without maintaining fresh browser sessions — a fragile approach that would fail in production. **Stooq** is used instead as a genuinely independent second source. Stooq provides free, unauthenticated OHLCV data for NSE-listed stocks using the same `.NS` suffix convention. It is a legitimate independent data aggregator with no authentication requirement, making it stable for scheduled pipeline use.

- **What is fetched**: 3-year daily OHLCV from Stooq's independent data pipeline.
- **Adjusted series**: Stooq's raw prices are adjusted independently in `analyze.py` using a custom backward-adjustment algorithm that applies the yfinance corporate action events (dates and ratios). This produces a series that is independent from Yahoo's proprietary adjustment because: (a) Stooq's raw price levels come from a different data pipeline, and (b) the adjustment algorithm is separately implemented, not copied from Yahoo's logic.
- **Why divergences are genuine**: Any difference between Yahoo's Adj Close and the custom-adjusted Stooq series points to a real discrepancy in how the adjustment was applied — different effective date, different rounding, or different price level on the adjustment date.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Ingestion and Analysis | Python 3.11 (yfinance, pandas, pandas-datareader, psycopg2) |
| Scheduling | GitHub Actions (cron, Mon-Fri 09:00 IST) |
| Database | Neon Postgres (serverless, free tier) |
| Backend API | Next.js 15 App Router API routes (@neondatabase/serverless) |
| Frontend | React (Next.js 15), Recharts, Framer Motion |
| Deployment | Vercel |

---

## Consistency Detection Logic

**Threshold**: 0.5% relative divergence.

This threshold is chosen because:
- Normal floating-point rounding in adjustment factor arithmetic produces errors well below 0.01%.
- A 0.5% divergence corresponds roughly to a missed dividend of Rs 5-15 on a Rs 1000-3000 stock — the order of magnitude of a real corporate-action mismatch.
- Going lower (0.1%) produces false positives from Yahoo's own rounding; going higher (2%) misses subtle but financially significant discrepancies.

**Corporate-action linking**: A flagged date is only included in the output if a corporate action (dividend or split) exists within plus-or-minus 7 calendar days of the divergence. This filters out divergences caused by data gaps or price discontinuities unrelated to corporate actions.

**Algorithm** (`scripts/analyze.py`):
1. Load adj_close from raw_prices_yf (Yahoo's series, Series 1).
2. Load close from raw_prices_stooq and apply the custom backward-adjustment function using events from corporate_actions_yf (Series 2).
3. Align both series on their common date range.
4. Compute divergence_pct = |adj_yf - adj_stooq| / adj_yf * 100.
5. Flag rows where divergence_pct > 0.5 AND a corporate action is within plus-or-minus 7 days.
6. Write flagged rows to consistency_flags and aggregate summaries to impact_summary.

---

## Impact Calculation

For each flagged stock, the return-calculation error is computed over the full 3-year window:

```
return_yf        = (adj_close_yf_last    / adj_close_yf_first)    - 1
return_stooq_adj = (adj_close_stooq_last / adj_close_stooq_first) - 1
return_error_pct = |return_yf - return_stooq_adj| x 100
```

This is the number of percentage points by which a 3-year return calculation would be wrong if the analyst used the less accurate source's adjusted series.

---

## Setup and Deployment

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Neon Postgres project (free tier at neon.tech)
- A Vercel account
- A GitHub repository

### 1. Clone and install
```bash
git clone https://github.com/your-username/ca-analytics.git
cd ca-analytics
npm install
pip install -r scripts/requirements.txt
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL from your Neon project
```

### 3. Run the database migration (once)
```bash
DATABASE_URL="your-connection-string" python db/migrate.py
```
This creates all 6 tables and seeds the Nifty 50 universe. Safe to re-run.

### 4. Run the ingestion pipeline (first time)
```bash
DATABASE_URL="your-connection-string" python scripts/ingest.py
DATABASE_URL="your-connection-string" python scripts/analyze.py
```

### 5. Run locally
```bash
npm run dev
# Visit http://localhost:3000
```

### 6. Deploy to Vercel
Push to GitHub, then import the repo in Vercel. Add DATABASE_URL as an Environment Variable in Vercel project settings.

### 7. Set up GitHub Actions
Add the following secret to your GitHub repository (Settings > Secrets > Actions):
- `DATABASE_URL`: your Neon connection string

The workflow at `.github/workflows/daily_ingest.yml` will run automatically every weekday at 03:30 UTC (09:00 IST). You can also trigger it manually via the GitHub Actions UI.

---

## Database Schema

| Table | Description |
|---|---|
| nifty50_universe | Static list of 50 tickers, company names, and sectors |
| raw_prices_yf | Raw + adjusted OHLCV from yfinance (Source 1) |
| raw_prices_stooq | Raw OHLCV from Stooq (Source 2) |
| corporate_actions_yf | Dividend amounts and split ratios from yfinance |
| consistency_flags | Per-stock, per-date divergence records |
| impact_summary | Per-stock aggregate: max divergence, return error, flag count |

Raw tables are kept separate — they are never merged at ingestion time.

---

## API Endpoints

| Endpoint | Description |
|---|---|
| GET /api/summary | Dashboard KPIs: total flags, stocks affected, max return error, last run time |
| GET /api/flags | Paginated, sortable list of flagged stocks with divergence and impact data |
| GET /api/stock/[ticker] | Full detail for one stock: both price series, corporate actions, flagged dates |

---

## Known Limitations

1. **Stooq data completeness**: Stooq occasionally has gaps for individual NSE-listed stocks. The pipeline logs gaps and continues.

2. **yfinance corporate action accuracy**: yfinance is an unofficial library. Yahoo Finance's corporate action data for Indian stocks may lag NSE's official announcements by 1-2 days for dividend ex-dates.

3. **Adjustment algorithm independence**: Series 2 uses the same event dates and ratios as Series 1 (from corporate_actions_yf), but applies them via a separately-implemented algorithm. A more rigorous comparison would use an independent source for the action dates and ratios as well.

4. **Neon cold starts**: Neon's free tier scales compute to zero after 5 minutes of inactivity. The first API call after idle may experience a 300-500ms delay.

5. **Index reconstitution**: The Nifty 50 constituent list is seeded statically based on Q1 2025 composition. Stocks added or removed during semi-annual reconstitution will not automatically be reflected.
