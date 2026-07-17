"""
analyze.py - Consistency detection and impact calculation.

Compares two adjusted price series for every tracked stock:
  Series 1: Yahoo Finance Adj Close (their internal backward adjustment)
  Series 2: Raw close with textbook backward adjustment applied from scratch

Flags dates where the two series diverge beyond the threshold.
The divergence does not require a nearby corporate action - all differences
above the threshold are reported, with nearby action annotated if present.

Usage:
    DATABASE_URL="postgresql://..." python scripts/analyze.py
    DATABASE_URL="postgresql://..." python scripts/analyze.py --dry-run
"""

import os
import sys
import logging
import argparse

import pandas as pd
import psycopg2
import psycopg2.extras

DIVERGENCE_THRESHOLD_PCT = 0.1   # flag anything above 0.1% - catches real adj differences
ACTION_WINDOW_DAYS = 15           # look ±15 days for a nearby corporate action

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


def load_tickers(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT ticker, company_name FROM nifty50_universe ORDER BY ticker;")
        return cur.fetchall()


def load_yf_prices(conn, ticker: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT date, close, adj_close FROM raw_prices_yf WHERE ticker = %s ORDER BY date;",
            (ticker,),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "close", "adj_close"])
    df["date"] = pd.to_datetime(df["date"])
    return df.set_index("date").sort_index().apply(pd.to_numeric, errors="coerce")


def load_stooq_prices(conn, ticker: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT date, close FROM raw_prices_stooq WHERE ticker = %s ORDER BY date;",
            (ticker,),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "close"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    return df


def load_corporate_actions(conn, ticker: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT ex_date, action_type, value FROM corporate_actions_yf WHERE ticker = %s ORDER BY ex_date;",
            (ticker,),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame(columns=["ex_date", "action_type", "value"])
    df = pd.DataFrame(rows, columns=["ex_date", "action_type", "value"])
    df["ex_date"] = pd.to_datetime(df["ex_date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    return df


def build_custom_adjusted(raw_df: pd.DataFrame, actions_df: pd.DataFrame) -> pd.Series:
    """
    Textbook backward adjustment on raw close prices.

    Works newest-to-oldest. For each corporate action:
      - Split (ratio R): multiply all prior prices by 1/R
      - Dividend (amount A): multiply all prior prices by (P - A) / P
        where P is the price on the ex-date
    """
    if raw_df.empty or "close" not in raw_df.columns:
        return pd.Series(dtype=float)

    prices = raw_df["close"].copy().astype(float)
    if actions_df.empty:
        return prices

    for _, action in actions_df.sort_values("ex_date", ascending=False).iterrows():
        ex_date = action["ex_date"]
        value = float(action["value"])
        if value <= 0:
            continue

        before = prices.index < ex_date

        if action["action_type"] == "split":
            if value != 1.0:
                prices[before] /= value

        elif action["action_type"] == "dividend":
            post = prices[prices.index >= ex_date]
            if post.empty:
                continue
            p = float(post.iloc[0])
            if p <= 0:
                continue
            factor = (p - value) / p
            if 0 < factor < 1:
                prices[before] *= factor

    return prices


def find_nearby_action(flag_date, actions_df: pd.DataFrame):
    if actions_df.empty:
        return None, None, None
    action_dates = pd.to_datetime(actions_df["ex_date"])
    window = pd.Timedelta(days=ACTION_WINDOW_DAYS)
    deltas = (action_dates - flag_date).abs()
    idx = deltas.argmin()
    if deltas.iloc[idx] <= window:
        a = actions_df.iloc[idx]
        return a["action_type"], float(a["value"]), a["ex_date"].date()
    return None, None, None


def detect_divergences(yf_adj: pd.Series, custom_adj: pd.Series, actions_df: pd.DataFrame) -> pd.DataFrame:
    """
    Flag every date where the two adjusted series differ by more than DIVERGENCE_THRESHOLD_PCT.
    A nearby corporate action is annotated if one falls within ACTION_WINDOW_DAYS, but is not
    required for a flag to be raised.
    """
    if yf_adj.empty or custom_adj.empty:
        return pd.DataFrame()

    combined = pd.DataFrame({"adj_yf": yf_adj, "adj_stooq": custom_adj}).dropna()
    if combined.empty:
        return pd.DataFrame()

    combined["divergence_pct"] = (
        (combined["adj_yf"] - combined["adj_stooq"]).abs() / combined["adj_yf"].abs() * 100
    )

    flagged = combined[combined["divergence_pct"] > DIVERGENCE_THRESHOLD_PCT].copy()
    if flagged.empty:
        return pd.DataFrame()

    results = []
    for flag_date, row in flagged.iterrows():
        nearby_action, nearby_value, nearby_date = find_nearby_action(flag_date, actions_df)
        results.append({
            "flag_date": flag_date.date(),
            "adj_close_yf": float(row["adj_yf"]),
            "adj_close_stooq": float(row["adj_stooq"]),
            "divergence_pct": float(row["divergence_pct"]),
            "nearby_action": nearby_action,
            "nearby_action_value": nearby_value,
            "nearby_action_date": nearby_date,
        })

    return pd.DataFrame(results)


def calculate_impact(yf_adj: pd.Series, custom_adj: pd.Series) -> dict:
    yf_v = yf_adj.dropna()
    custom_v = custom_adj.dropna()

    if len(yf_v) < 2 or len(custom_v) < 2:
        return {"return_yf": None, "return_stooq_adj": None, "return_error_pct": None}

    common_start = max(yf_v.index.min(), custom_v.index.min())
    common_end = min(yf_v.index.max(), custom_v.index.max())

    yf_w = yf_v[(yf_v.index >= common_start) & (yf_v.index <= common_end)]
    cust_w = custom_v[(custom_v.index >= common_start) & (custom_v.index <= common_end)]

    if len(yf_w) < 2 or len(cust_w) < 2:
        return {"return_yf": None, "return_stooq_adj": None, "return_error_pct": None}

    r_yf = (float(yf_w.iloc[-1]) / float(yf_w.iloc[0]) - 1) * 100
    r_cust = (float(cust_w.iloc[-1]) / float(cust_w.iloc[0]) - 1) * 100

    return {
        "return_yf": round(r_yf, 4),
        "return_stooq_adj": round(r_cust, 4),
        "return_error_pct": round(abs(r_yf - r_cust), 4),
    }


def upsert_flags(conn, ticker: str, flags_df: pd.DataFrame, dry_run=False):
    if flags_df.empty:
        return
    rows = [
        (
            ticker, row["flag_date"],
            row["adj_close_yf"], row["adj_close_stooq"], row["divergence_pct"],
            row.get("nearby_action"), row.get("nearby_action_value"), row.get("nearby_action_date"),
        )
        for _, row in flags_df.iterrows()
    ]
    if dry_run:
        log.info(f"  [dry-run] {len(rows)} flags")
        return
    sql = """
        INSERT INTO consistency_flags
            (ticker, flag_date, adj_close_yf, adj_close_stooq, divergence_pct,
             nearby_action, nearby_action_value, nearby_action_date)
        VALUES %s
        ON CONFLICT (ticker, flag_date) DO UPDATE SET
            adj_close_yf=EXCLUDED.adj_close_yf, adj_close_stooq=EXCLUDED.adj_close_stooq,
            divergence_pct=EXCLUDED.divergence_pct, nearby_action=EXCLUDED.nearby_action,
            nearby_action_value=EXCLUDED.nearby_action_value,
            nearby_action_date=EXCLUDED.nearby_action_date, run_at=NOW();
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows)
    conn.commit()


def upsert_impact(conn, ticker, company, flags_df, impact, dry_run=False):
    if not flags_df.empty:
        best = flags_df.loc[flags_df["divergence_pct"].idxmax()]
        max_div = float(best["divergence_pct"])
        worst_date = best["flag_date"]
        n = len(flags_df)
        causes = flags_df["nearby_action"].dropna().unique().tolist()
        cause = causes[0] if len(causes) == 1 else ("both" if causes else None)
        last_flag = flags_df["flag_date"].max()
    else:
        max_div = worst_date = cause = last_flag = None
        n = 0

    if dry_run:
        log.info(f"  [dry-run] {n} flags, error={impact.get('return_error_pct')} pp")
        return

    sql = """
        INSERT INTO impact_summary
            (ticker, company_name, max_divergence_pct, worst_flag_date,
             return_yf, return_stooq_adj, return_error_pct,
             n_flags, primary_cause, last_flag_date, run_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON CONFLICT (ticker) DO UPDATE SET
            company_name=EXCLUDED.company_name,
            max_divergence_pct=EXCLUDED.max_divergence_pct,
            worst_flag_date=EXCLUDED.worst_flag_date,
            return_yf=EXCLUDED.return_yf, return_stooq_adj=EXCLUDED.return_stooq_adj,
            return_error_pct=EXCLUDED.return_error_pct, n_flags=EXCLUDED.n_flags,
            primary_cause=EXCLUDED.primary_cause, last_flag_date=EXCLUDED.last_flag_date,
            run_at=NOW();
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            ticker, company, max_div, worst_date,
            impact.get("return_yf"), impact.get("return_stooq_adj"), impact.get("return_error_pct"),
            n, cause, last_flag,
        ))
    conn.commit()


def main(dry_run=False):
    conn = get_connection()
    tickers = load_tickers(conn)
    log.info(f"Analyzing {len(tickers)} tickers, threshold={DIVERGENCE_THRESHOLD_PCT}%")

    total_flagged = total_flags = 0

    for i, (ticker, company) in enumerate(tickers, 1):
        log.info(f"[{i:02d}/{len(tickers)}] {ticker}")

        yf_df = load_yf_prices(conn, ticker)
        stooq_df = load_stooq_prices(conn, ticker)
        actions_df = load_corporate_actions(conn, ticker)

        if yf_df.empty or stooq_df.empty:
            log.warning("  No price data, skipping")
            upsert_impact(conn, ticker, company, pd.DataFrame(), {}, dry_run)
            continue

        yf_adj = yf_df["adj_close"].dropna()
        custom_adj = build_custom_adjusted(stooq_df, actions_df)

        flags_df = detect_divergences(yf_adj, custom_adj, actions_df)
        n = len(flags_df)
        if n > 0:
            log.info(f"  {n} flag(s), max divergence={flags_df['divergence_pct'].max():.3f}%")
            total_flagged += 1
            total_flags += n
        else:
            log.info("  Clean")

        impact = calculate_impact(yf_adj, custom_adj)
        if impact.get("return_error_pct") is not None:
            log.info(f"  Return error: {impact['return_error_pct']:.4f} pp")

        upsert_flags(conn, ticker, flags_df, dry_run)
        upsert_impact(conn, ticker, company, flags_df, impact, dry_run)

    conn.close()
    log.info(f"Done. {total_flagged}/{len(tickers)} stocks flagged, {total_flags} total flag records.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    main(dry_run=parser.parse_args().dry_run)
