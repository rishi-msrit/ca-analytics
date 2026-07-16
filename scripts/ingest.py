"""
ingest.py - Daily data fetch for all Nifty 50 constituents.

Single source: Yahoo Finance via yfinance, stored in two tables:
  - raw_prices_yf: Yahoo's own Adj Close (their CRSP-style backward adjustment)
  - raw_prices_stooq: Yahoo's raw (unadjusted) Close

analyze.py builds two adjusted series from these:
  Series 1: Yahoo's Adj Close as-is
  Series 2: Raw Close with a textbook backward adjustment applied from scratch

Any difference reveals where Yahoo's pipeline deviates from a standard implementation.

Fetch strategy: yf.download() pulls all 50 tickers in a single batched request
to avoid the per-call rate limit that triggers with individual Ticker.history() calls.
Corporate actions still use per-ticker calls but are lightweight and well-spaced.

Usage:
    DATABASE_URL="postgresql://..." python scripts/ingest.py
"""

import os
import sys
import time
import logging
from datetime import timedelta, date
from typing import Optional

import psycopg2
import psycopg2.extras
import pandas as pd
import yfinance as yf

LOOKBACK_YEARS = 3
RATE_LIMIT_ACTIONS = 0.6   # seconds between per-ticker action fetches
MAX_RETRIES = 3
BACKOFF_BASE = 2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def get_connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        log.error("DATABASE_URL not set")
        sys.exit(1)
    return psycopg2.connect(url)


def fetch_tickers(conn) -> list[tuple[str, str]]:
    with conn.cursor() as cur:
        cur.execute("SELECT ticker, company_name FROM nifty50_universe ORDER BY ticker;")
        return cur.fetchall()


def with_retry(fn, *args, **kwargs):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if attempt == MAX_RETRIES:
                raise
            wait = BACKOFF_BASE ** attempt
            log.warning(f"Attempt {attempt} failed ({e}), retrying in {wait}s")
            time.sleep(wait)


def bulk_download(tickers: list[str], start: date, end: date) -> pd.DataFrame:
    """
    yf.download with auto_adjust=False returns a MultiIndex DataFrame:
        columns = (field, ticker)  where field in [Open, High, Low, Close, Adj Close, Volume]

    This single call replaces 50 individual Ticker.history() calls and avoids
    the per-call rate limit Yahoo enforces on the v8 API.
    """
    df = yf.download(
        tickers=" ".join(tickers),
        start=start.isoformat(),
        end=end.isoformat(),
        auto_adjust=False,
        actions=False,   # actions fetched separately per-ticker for accuracy
        group_by="ticker",
        threads=True,
        progress=False,
    )
    return df


def extract_ticker_prices(bulk_df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Pull out one ticker's OHLCV+AdjClose from the bulk download result."""
    if ticker not in bulk_df.columns.get_level_values(0):
        return pd.DataFrame()
    df = bulk_df[ticker].copy()
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    df.index = df.index.date
    df = df.dropna(how="all")
    return df


def fetch_actions(ticker: str, start: date, end: date) -> dict:
    """Per-ticker fetch for corporate actions only."""
    t = yf.Ticker(ticker)
    actions = t.actions
    if actions is None or actions.empty:
        return {"dividends": pd.Series(dtype=float), "splits": pd.Series(dtype=float)}

    # Filter to our date window
    actions.index = pd.to_datetime(actions.index).date
    mask = (pd.Series(actions.index) >= start) & (pd.Series(actions.index) <= end)
    actions = actions[mask.values]

    dividends = actions.get("Dividends", pd.Series(dtype=float))
    splits = actions.get("Stock Splits", pd.Series(dtype=float))
    dividends = dividends[dividends > 0] if not dividends.empty else dividends
    splits = splits[splits > 0] if not splits.empty else splits

    return {"dividends": dividends, "splits": splits}


def upsert_yf_prices(conn, ticker: str, df: pd.DataFrame):
    if df.empty:
        return
    rows = [
        (
            ticker, idx,
            _f(row.get("open")), _f(row.get("high")),
            _f(row.get("low")), _f(row.get("close")),
            _f(row.get("adj_close")), _i(row.get("volume")),
        )
        for idx, row in df.iterrows()
    ]
    sql = """
        INSERT INTO raw_prices_yf (ticker, date, open, high, low, close, adj_close, volume)
        VALUES %s
        ON CONFLICT (ticker, date) DO UPDATE SET
            open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
            close=EXCLUDED.close, adj_close=EXCLUDED.adj_close,
            volume=EXCLUDED.volume, fetched_at=NOW();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows)
    conn.commit()


def upsert_raw_as_series2(conn, ticker: str, df: pd.DataFrame):
    """Store raw (unadjusted) close in raw_prices_stooq as the Series 2 input."""
    if df.empty:
        return
    rows = [
        (ticker, idx, _f(row.get("open")), _f(row.get("high")),
         _f(row.get("low")), _f(row.get("close")), _i(row.get("volume")))
        for idx, row in df.iterrows()
    ]
    sql = """
        INSERT INTO raw_prices_stooq (ticker, date, open, high, low, close, volume)
        VALUES %s
        ON CONFLICT (ticker, date) DO UPDATE SET
            open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
            close=EXCLUDED.close, volume=EXCLUDED.volume, fetched_at=NOW();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows)
    conn.commit()


def upsert_corporate_actions(conn, ticker: str, dividends: pd.Series, splits: pd.Series):
    rows = []
    for ex_date, amount in dividends.items():
        if hasattr(ex_date, "date"):
            ex_date = ex_date.date()
        rows.append((ticker, ex_date, "dividend", float(amount)))
    for ex_date, ratio in splits.items():
        if hasattr(ex_date, "date"):
            ex_date = ex_date.date()
        rows.append((ticker, ex_date, "split", float(ratio)))
    if not rows:
        return
    sql = """
        INSERT INTO corporate_actions_yf (ticker, ex_date, action_type, value)
        VALUES %s
        ON CONFLICT (ticker, ex_date, action_type) DO UPDATE SET
            value=EXCLUDED.value, fetched_at=NOW();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows)
    conn.commit()


def _f(val) -> Optional[float]:
    try:
        v = float(val)
        return None if v != v else v
    except (TypeError, ValueError):
        return None


def _i(val) -> Optional[int]:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def main():
    end = date.today()
    start = end - timedelta(days=LOOKBACK_YEARS * 365 + 30)

    log.info(f"Ingestion window: {start} to {end}")
    conn = get_connection()
    tickers_data = fetch_tickers(conn)
    tickers = [t for t, _ in tickers_data]
    log.info(f"Universe: {len(tickers)} tickers")

    # Bulk download all 50 tickers in one shot
    log.info("Bulk downloading OHLCV via yf.download() ...")
    try:
        bulk_df = with_retry(bulk_download, tickers, start, end)
        log.info(f"Bulk download complete: {len(bulk_df)} trading days")
    except Exception as e:
        log.error(f"Bulk download failed: {e}")
        conn.close()
        sys.exit(1)

    ok, fail = 0, 0

    for i, (ticker, _) in enumerate(tickers_data, 1):
        log.info(f"[{i:02d}/{len(tickers)}] {ticker}")

        try:
            prices = extract_ticker_prices(bulk_df, ticker)
            if prices.empty:
                log.warning(f"  No prices in bulk result for {ticker}")
                fail += 1
            else:
                upsert_yf_prices(conn, ticker, prices)
                upsert_raw_as_series2(conn, ticker, prices)
                log.info(f"  {len(prices)} rows")
                ok += 1
        except Exception as e:
            log.error(f"  Price upsert failed: {e}")
            fail += 1

        # Corporate actions: still per-ticker, but just metadata calls
        try:
            actions = with_retry(fetch_actions, ticker, start, end)
            upsert_corporate_actions(conn, ticker, actions["dividends"], actions["splits"])
            n = len(actions["dividends"]) + len(actions["splits"])
            if n:
                log.info(f"  {n} corporate action(s)")
        except Exception as e:
            log.warning(f"  Actions fetch failed: {e}")

        time.sleep(RATE_LIMIT_ACTIONS)

    conn.close()
    log.info(f"Done. {ok} ok / {fail} failed")


if __name__ == "__main__":
    main()
