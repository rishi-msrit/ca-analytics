"""
analyze.py

For each tracked stock, compares two adjusted price series:
  S1: Yahoo Finance Adj Close (their own backward adjustment)
  S2: Raw close with standard backward adjustment applied from scratch

Flags dates where the two series differ by more than DIVERGENCE_THRESHOLD_PCT.
"""

import os
import sys
import logging
import argparse

import pandas as pd
import psycopg2
import psycopg2.extras

DIVERGENCE_THRESHOLD_PCT = 0.02   # 0.02% catches real algorithm differences
ACTION_WINDOW_DAYS = 15

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


def load_yf_prices(conn, ticker):
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


def load_raw_prices(conn, ticker):
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


def load_corporate_actions(conn, ticker):
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


def build_custom_adjusted(raw_df, actions_df):
    """
    Apply standard backward adjustment to raw closes using corporate action events.
    Processes newest-to-oldest so each factor uses the pre-event raw price.
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

        before_mask = prices.index < ex_date
        before = prices[before_mask]
        after = prices[prices.index >= ex_date]

        if action["action_type"] == "split":
            if value != 1.0:
                prices[before_mask] /= value

        elif action["action_type"] == "dividend":
            if before.empty or after.empty:
                continue
            # Use the last raw price BEFORE ex-date for the factor
            p_before = float(before.iloc[-1])
            if p_before <= value:
                continue
            factor = (p_before - value) / p_before
            if 0 < factor < 1:
                prices[before_mask] *= factor

    return prices


def find_nearby_action(flag_date, actions_df):
    if actions_df.empty:
        return None, None, None
    dates = pd.to_datetime(actions_df["ex_date"])
    window = pd.Timedelta(days=ACTION_WINDOW_DAYS)
    deltas = (dates - flag_date).abs()
    idx = deltas.argmin()
    if deltas.iloc[idx] <= window:
        a = actions_df.iloc[idx]
        return a["action_type"], float(a["value"]), a["ex_date"].date()
    return None, None, None


def detect_divergences(s1, s2, actions_df):
    if s1.empty or s2.empty:
        return pd.DataFrame()

    combined = pd.DataFrame({"s1": s1, "s2": s2}).dropna()
    if combined.empty:
        return pd.DataFrame()

    combined["div_pct"] = (
        (combined["s1"] - combined["s2"]).abs() / combined["s1"].abs() * 100
    )

    # Log the maximum divergence seen regardless of threshold (for diagnostics)
    max_div = combined["div_pct"].max()
    log.info(f"  max divergence in series: {max_div:.4f}%")

    flagged = combined[combined["div_pct"] > DIVERGENCE_THRESHOLD_PCT].copy()
    if flagged.empty:
        return pd.DataFrame()

    results = []
    for flag_date, row in flagged.iterrows():
        act, val, act_date = find_nearby_action(flag_date, actions_df)
        results.append({
            "flag_date": flag_date.date(),
            "adj_close_yf": float(row["s1"]),
            "adj_close_stooq": float(row["s2"]),
            "divergence_pct": float(row["div_pct"]),
            "nearby_action": act,
            "nearby_action_value": val,
            "nearby_action_date": act_date,
        })
    return pd.DataFrame(results)


def calculate_impact(s1, s2):
    yf_v = s1.dropna()
    s2_v = s2.dropna()
    if len(yf_v) < 2 or len(s2_v) < 2:
        return {"return_yf": None, "return_stooq_adj": None, "return_error_pct": None}

    start = max(yf_v.index.min(), s2_v.index.min())
    end = min(yf_v.index.max(), s2_v.index.max())

    yf_w = yf_v[(yf_v.index >= start) & (yf_v.index <= end)]
    s2_w = s2_v[(s2_v.index >= start) & (s2_v.index <= end)]

    if len(yf_w) < 2 or len(s2_w) < 2:
        return {"return_yf": None, "return_stooq_adj": None, "return_error_pct": None}

    r_yf = (float(yf_w.iloc[-1]) / float(yf_w.iloc[0]) - 1) * 100
    r_s2 = (float(s2_w.iloc[-1]) / float(s2_w.iloc[0]) - 1) * 100

    return {
        "return_yf": round(r_yf, 4),
        "return_stooq_adj": round(r_s2, 4),
        "return_error_pct": round(abs(r_yf - r_s2), 4),
    }


def upsert_flags(conn, ticker, flags_df, dry_run=False):
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
    log.info(f"Analyzing {len(tickers)} tickers — threshold: {DIVERGENCE_THRESHOLD_PCT}%")

    total_flagged = total_flags = 0

    for i, (ticker, company) in enumerate(tickers, 1):
        log.info(f"[{i:02d}/{len(tickers)}] {ticker}")

        yf_df = load_yf_prices(conn, ticker)
        raw_df = load_raw_prices(conn, ticker)
        actions_df = load_corporate_actions(conn, ticker)

        log.info(f"  yf rows={len(yf_df)}, raw rows={len(raw_df)}, actions={len(actions_df)}")

        if yf_df.empty or raw_df.empty:
            log.warning("  No price data — skipping")
            upsert_impact(conn, ticker, company, pd.DataFrame(), {}, dry_run)
            continue

        s1 = yf_df["adj_close"].dropna()
        s2 = build_custom_adjusted(raw_df, actions_df)

        flags_df = detect_divergences(s1, s2, actions_df)
        n = len(flags_df)
        if n > 0:
            log.info(f"  FLAGGED: {n} day(s), max={flags_df['divergence_pct'].max():.4f}%")
            total_flagged += 1
            total_flags += n
        else:
            log.info("  Clean (no divergence above threshold)")

        impact = calculate_impact(s1, s2)
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
