"""
migrate.py - One-time database setup.

Creates all tables (idempotent, safe to re-run) and seeds the universe
if the table is empty.

Universe: Nifty 50 (India) + top 20 S&P 500 (USA) + 10 global large-caps.
Run this once before the first ingest.py run.

Usage:
    DATABASE_URL="postgresql://..." python db/migrate.py
"""

import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def run():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set")
        sys.exit(1)

    schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()

    print("Running schema migration...")
    cur.execute(schema)

    cur.execute("SELECT COUNT(*) FROM nifty50_universe;")
    if cur.fetchone()[0] == 0:
        print("Seeding universe (Nifty 50 + S&P top stocks + global large-caps)...")
        seed_universe(cur)
        print("Done seeding.")
    else:
        print("Universe already populated, skipping seed.")

    cur.close()
    conn.close()
    print("Migration complete.")


def seed_universe(cur):
    # fmt: off
    constituents = [
        # --- Nifty 50 (NSE India) ---
        # Q1 2025 composition; update during March/September reconstitutions
        ("ADANIENT.NS",   "Adani Enterprises",             "Metals & Mining",           "IN"),
        ("ADANIPORTS.NS", "Adani Ports and SEZ",           "Industrials",               "IN"),
        ("APOLLOHOSP.NS", "Apollo Hospitals",              "Healthcare",                "IN"),
        ("ASIANPAINT.NS", "Asian Paints",                  "Consumer Staples",          "IN"),
        ("AXISBANK.NS",   "Axis Bank",                     "Financials",                "IN"),
        ("BAJAJ-AUTO.NS", "Bajaj Auto",                    "Consumer Discretionary",    "IN"),
        ("BAJAJFINSV.NS", "Bajaj Finserv",                 "Financials",                "IN"),
        ("BAJFINANCE.NS", "Bajaj Finance",                 "Financials",                "IN"),
        ("BEL.NS",        "Bharat Electronics",            "Industrials",               "IN"),
        ("BHARTIARTL.NS", "Bharti Airtel",                 "Communication Services",    "IN"),
        ("BPCL.NS",       "Bharat Petroleum",              "Energy",                    "IN"),
        ("BRITANNIA.NS",  "Britannia Industries",          "Consumer Staples",          "IN"),
        ("CIPLA.NS",      "Cipla",                         "Healthcare",                "IN"),
        ("COALINDIA.NS",  "Coal India",                    "Energy",                    "IN"),
        ("DRREDDY.NS",    "Dr Reddy's Laboratories",       "Healthcare",                "IN"),
        ("EICHERMOT.NS",  "Eicher Motors",                 "Consumer Discretionary",    "IN"),
        ("GRASIM.NS",     "Grasim Industries",             "Materials",                 "IN"),
        ("HCLTECH.NS",    "HCL Technologies",              "Information Technology",    "IN"),
        ("HDFCBANK.NS",   "HDFC Bank",                     "Financials",                "IN"),
        ("HDFCLIFE.NS",   "HDFC Life Insurance",           "Financials",                "IN"),
        ("HEROMOTOCO.NS", "Hero MotoCorp",                 "Consumer Discretionary",    "IN"),
        ("HINDALCO.NS",   "Hindalco Industries",           "Materials",                 "IN"),
        ("HINDUNILVR.NS", "Hindustan Unilever",            "Consumer Staples",          "IN"),
        ("ICICIBANK.NS",  "ICICI Bank",                    "Financials",                "IN"),
        ("INDUSINDBK.NS", "IndusInd Bank",                 "Financials",                "IN"),
        ("INFY.NS",       "Infosys",                       "Information Technology",    "IN"),
        ("ITC.NS",        "ITC",                           "Consumer Staples",          "IN"),
        ("JSWSTEEL.NS",   "JSW Steel",                     "Materials",                 "IN"),
        ("KOTAKBANK.NS",  "Kotak Mahindra Bank",           "Financials",                "IN"),
        ("LT.NS",         "Larsen & Toubro",               "Industrials",               "IN"),
        ("M&M.NS",        "Mahindra & Mahindra",           "Consumer Discretionary",    "IN"),
        ("MARUTI.NS",     "Maruti Suzuki",                 "Consumer Discretionary",    "IN"),
        ("NESTLEIND.NS",  "Nestle India",                  "Consumer Staples",          "IN"),
        ("NTPC.NS",       "NTPC",                          "Utilities",                 "IN"),
        ("ONGC.NS",       "ONGC",                          "Energy",                    "IN"),
        ("POWERGRID.NS",  "Power Grid Corporation",        "Utilities",                 "IN"),
        ("RELIANCE.NS",   "Reliance Industries",           "Energy",                    "IN"),
        ("SBILIFE.NS",    "SBI Life Insurance",            "Financials",                "IN"),
        ("SBIN.NS",       "State Bank of India",           "Financials",                "IN"),
        ("SHRIRAMFIN.NS", "Shriram Finance",               "Financials",                "IN"),
        ("SUNPHARMA.NS",  "Sun Pharma",                    "Healthcare",                "IN"),
        ("TATACONSUM.NS", "Tata Consumer Products",        "Consumer Staples",          "IN"),
        ("TATAMOTORS.NS", "Tata Motors",                   "Consumer Discretionary",    "IN"),
        ("TATASTEEL.NS",  "Tata Steel",                    "Materials",                 "IN"),
        ("TCS.NS",        "Tata Consultancy Services",     "Information Technology",    "IN"),
        ("TECHM.NS",      "Tech Mahindra",                 "Information Technology",    "IN"),
        ("TITAN.NS",      "Titan Company",                 "Consumer Discretionary",    "IN"),
        ("TRENT.NS",      "Trent",                         "Consumer Discretionary",    "IN"),
        ("ULTRACEMCO.NS", "UltraTech Cement",              "Materials",                 "IN"),
        ("WIPRO.NS",      "Wipro",                         "Information Technology",    "IN"),

        # --- Top 20 S&P 500 (USA) by market cap ---
        ("AAPL",   "Apple",                      "Information Technology",    "US"),
        ("MSFT",   "Microsoft",                  "Information Technology",    "US"),
        ("NVDA",   "NVIDIA",                     "Information Technology",    "US"),
        ("AMZN",   "Amazon",                     "Consumer Discretionary",    "US"),
        ("GOOGL",  "Alphabet (Class A)",         "Communication Services",    "US"),
        ("META",   "Meta Platforms",             "Communication Services",    "US"),
        ("TSLA",   "Tesla",                      "Consumer Discretionary",    "US"),
        ("BRK-B",  "Berkshire Hathaway B",       "Financials",                "US"),
        ("JPM",    "JPMorgan Chase",             "Financials",                "US"),
        ("V",      "Visa",                       "Financials",                "US"),
        ("UNH",    "UnitedHealth Group",         "Healthcare",                "US"),
        ("LLY",    "Eli Lilly",                  "Healthcare",                "US"),
        ("XOM",    "ExxonMobil",                 "Energy",                    "US"),
        ("MA",     "Mastercard",                 "Financials",                "US"),
        ("JNJ",    "Johnson & Johnson",          "Healthcare",                "US"),
        ("PG",     "Procter & Gamble",           "Consumer Staples",          "US"),
        ("HD",     "Home Depot",                 "Consumer Discretionary",    "US"),
        ("AVGO",   "Broadcom",                   "Information Technology",    "US"),
        ("COST",   "Costco",                     "Consumer Staples",          "US"),
        ("MRK",    "Merck",                      "Healthcare",                "US"),

        # --- Global large-caps (non-India, non-USA) ---
        ("TSM",    "Taiwan Semiconductor",       "Information Technology",    "TW"),
        ("ASML",   "ASML Holding",               "Information Technology",    "NL"),
        ("NVO",    "Novo Nordisk",               "Healthcare",                "DK"),
        ("SAP",    "SAP SE",                     "Information Technology",    "DE"),
        ("SHEL",   "Shell",                      "Energy",                    "GB"),
        ("TM",     "Toyota Motor",              "Consumer Discretionary",    "JP"),
        ("NESN.SW","Nestle SA",                  "Consumer Staples",          "CH"),
        ("LVMH.PA","LVMH Moet Hennessy",         "Consumer Discretionary",    "FR"),
        ("BHP",    "BHP Group",                  "Materials",                 "AU"),
        ("RIO",    "Rio Tinto",                  "Materials",                 "GB"),
    ]
    # fmt: on

    # Add 'market' column to universe if not already present (for multi-market support)
    cur.execute("""
        ALTER TABLE nifty50_universe
        ADD COLUMN IF NOT EXISTS market CHAR(2) DEFAULT 'IN';
    """)

    cur.executemany(
        """
        INSERT INTO nifty50_universe (ticker, company_name, sector, market)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (ticker) DO UPDATE SET
            company_name=EXCLUDED.company_name,
            sector=EXCLUDED.sector,
            market=EXCLUDED.market;
        """,
        constituents,
    )


if __name__ == "__main__":
    run()
