# CA Analytics — Corporate Actions Consistency Monitor

An automated data pipeline and dashboard that detects calculation discrepancies in backward-adjusted stock prices — and measures how much those errors distort 3-year return metrics.

Covers 80 stocks: Nifty 50 (India), top 20 S&P 500 (US), and 10 global large-caps.

**Live Dashboard:** Deployed on Vercel · **Automated Pipeline:** GitHub Actions (Mon–Fri, 16:30 IST after market close)

---

## What Problem Does This Solve?

When a company pays a dividend or splits its stock, historical share prices must be backward-adjusted so return calculations and chart histories aren't distorted by artificial price drops.

Financial portals like Yahoo Finance run internal automated algorithms to perform these adjustments. However, timing mismatches, missing corporate action records, or dividend adjustment errors often creep into the data unnoticed. 

**CA Analytics** independently re-calculates adjusted price series from scratch using raw price data and corporate action events, then compares the results against Yahoo's published adjusted prices. If Yahoo's numbers differ from textbook math, we quantify the exact return distortion in percentage points.

---

## Key Findings & Findings Summary

Analyzing historical price data across the tracked universe revealed significant, real-world data quality issues in published adjusted series:

### 1. Headline Metrics
- **14,203 Date-Stock Inconsistencies:** Over 14,000 individual trading days showed a difference greater than 0.02% between Yahoo's adjusted series and textbook calculation.
- **34 of 50 Stocks Affected:** 68% of tracked Nifty 50 stocks exhibited at least one corporate-action-related calculation mismatch over a 3-year window.
- **Up to 3,000+ Percentage Point Return Distortions:** Unadjusted stock splits combined with dividend distributions can compound into massive return errors over multi-year holding periods.

### 2. Major Case Studies

| Stock | Primary Cause | Yahoo S1 Return (3yr) | Independent S2 Return (3yr) | Return Error Gap |
|---|---|---|---|---|
| **Nestle India** (`NESTLEIND`) | Split + Dividend | 36.5% | 3,046.7% | **3,010.23 pp** |
| **Shriram Finance** (`SHRIRAMFIN`) | Split + Dividend | 225.9% | 1,734.1% | **1,508.22 pp** |
| **Dr. Reddy's** (`DRREDDY`) | Split + Dividend | 20.4% | 538.1% | **517.67 pp** |
| **Kotak Mahindra Bank** (`KOTAKBANK`) | Split + Dividend | 5.0% | 431.8% | **426.74 pp** |
| **BPCL** (`BPCL`) | Bonus / Split | 108.1% | 352.5% | **244.41 pp** |
| **HDFC Bank** (`HDFCBANK`) | Dividend Timing | -3.8% | 98.0% | **101.86 pp** |

*Takeaway:* Anyone blindly relying on unverified adjusted close series for backtesting, portfolio valuation, or quantitative research risks making decisions based on heavily distorted performance figures.

---

## How It Works

1. **Ingest Pipeline:**
   Every weekday at 16:30 IST (following Indian market close), a GitHub Actions job executes `scripts/ingest.py`. It uses a single batched `yfinance` download request to pull 3 years of daily raw prices, adjusted prices, and corporate action histories into a Neon Postgres database.

2. **Dual-Series Reconstruction:**
   - **Series 1 (S1):** Published Yahoo Finance `Adj Close` as-is.
   - **Series 2 (S2):** Raw `Close` with standard backward-adjustment applied from scratch:
     - Dividend adjustment factor: $P_{\text{adj}} = P_{\text{prior}} \times \frac{P_{\text{before}} - D}{P_{\text{before}}}$
     - Split adjustment factor: $P_{\text{adj}} = P_{\text{prior}} \times \frac{1}{\text{Ratio}}$

3. **Consistency Analysis:**
   The `scripts/analyze.py` engine compares S1 vs S2 on every trading date. Gaps exceeding **0.02%** are flagged and annotated with nearby dividend or split events within a 15-day window.

4. **Return Gap Calculation:**
   Computes 3-year cumulative returns for both S1 and S2 to establish the exact error magnitude ($\text{Return Error} = |R_{S1} - R_{S2}|$).

---

## Tech Stack

- **Data Ingestion:** Python 3.11, `yfinance`, `pandas`, `psycopg2`
- **Database:** Neon Postgres (serverless SQL)
- **Pipeline Orchestration:** GitHub Actions Cron (`0 11 * * 1-5`)
- **Web App:** Next.js 15, React, TypeScript, Recharts
- **Styling & Theme:** Pure Vanilla CSS variables (Light/Dark mode), DM Sans typography

---

## Project Structure

```
ca-analytics/
├── db/
│   ├── schema.sql        # Table schemas for prices, actions, and flags
│   └── migrate.py        # Database migration and universe seed script
├── scripts/
│   ├── ingest.py         # Daily market data & corporate action ingestion
│   ├── analyze.py        # Divergence detection and return error engine
│   └── requirements.txt
├── src/
│   ├── app/
│   │   ├── api/          # Serverless REST endpoints (/summary, /flags, /stock)
│   │   ├── globals.css   # Custom CSS theme system & UI utilities
│   │   ├── layout.tsx    # Root layout & theme initialization
│   │   └── page.tsx      # Main dashboard & explanation modal
│   └── components/
│       ├── FlagsTable.tsx          # Interactive table with sorting & tooltips
│       ├── StockDetailPanel.tsx    # Slide-over breakdown panel
│       └── PriceComparisonChart.tsx# Recharts price series & event visualizer
└── .github/
    └── workflows/
        └── daily_ingest.yml        # Scheduled pipeline workflow
```

---

## Local Development

```bash
# Clone repository
git clone https://github.com/rishi-msrit/ca-analytics.git
cd ca-analytics

# Install Python dependencies
pip install -r scripts/requirements.txt

# Set Neon Postgres URL
export DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"

# Run schema migration & seed universe
python db/migrate.py

# Ingest price data & run analysis
python scripts/ingest.py
python scripts/analyze.py

# Run Next.js web application
npm install
npm run dev
```

Open `http://localhost:3000` to view the dashboard locally.
