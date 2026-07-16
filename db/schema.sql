-- Schema for the CA Analytics pipeline.
-- All tables use CREATE TABLE IF NOT EXISTS so this file can be re-run safely.

-- Nifty 50 universe. Static list seeded by migrate.py.
CREATE TABLE IF NOT EXISTS nifty50_universe (
    ticker          VARCHAR(20)  PRIMARY KEY,
    company_name    VARCHAR(100) NOT NULL,
    sector          VARCHAR(60),
    added_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- Raw OHLCV from Yahoo Finance (Source 1).
-- auto_adjust=False at fetch time preserves both the raw close and Yahoo's Adj Close.
CREATE TABLE IF NOT EXISTS raw_prices_yf (
    ticker          VARCHAR(20)  NOT NULL,
    date            DATE         NOT NULL,
    open            NUMERIC(14,4),
    high            NUMERIC(14,4),
    low             NUMERIC(14,4),
    close           NUMERIC(14,4),
    adj_close       NUMERIC(14,4),   -- Yahoo's backward-adjusted close (CRSP method)
    volume          BIGINT,
    fetched_at      TIMESTAMPTZ  DEFAULT NOW(),
    PRIMARY KEY (ticker, date)
);

-- Raw OHLCV from Stooq (Source 2). No Adj Close here; adjustment is applied in analyze.py.
CREATE TABLE IF NOT EXISTS raw_prices_stooq (
    ticker          VARCHAR(20)  NOT NULL,
    date            DATE         NOT NULL,
    open            NUMERIC(14,4),
    high            NUMERIC(14,4),
    low             NUMERIC(14,4),
    close           NUMERIC(14,4),
    volume          BIGINT,
    fetched_at      TIMESTAMPTZ  DEFAULT NOW(),
    PRIMARY KEY (ticker, date)
);

-- Corporate action events from yfinance. Used as the event list for building
-- the Stooq adjusted series in analyze.py (same events, different algorithm).
CREATE TABLE IF NOT EXISTS corporate_actions_yf (
    ticker          VARCHAR(20)  NOT NULL,
    ex_date         DATE         NOT NULL,
    action_type     VARCHAR(10)  NOT NULL CHECK (action_type IN ('dividend', 'split')),
    value           NUMERIC(14,6) NOT NULL,
    fetched_at      TIMESTAMPTZ  DEFAULT NOW(),
    PRIMARY KEY (ticker, ex_date, action_type)
);

-- Per-stock, per-date flags where the two adjusted series diverge above 0.5%.
-- Threshold reasoning: normal adjustment rounding is below 0.01%, so 0.5% is
-- well above noise but low enough to catch a typical missed dividend (Rs 5-15
-- on a Rs 1000-3000 stock). Flags also require a nearby corporate action within
-- 7 days to filter out unrelated price-level differences.
CREATE TABLE IF NOT EXISTS consistency_flags (
    id                  SERIAL       PRIMARY KEY,
    ticker              VARCHAR(20)  NOT NULL,
    flag_date           DATE         NOT NULL,
    adj_close_yf        NUMERIC(14,4) NOT NULL,
    adj_close_stooq     NUMERIC(14,4) NOT NULL,
    divergence_pct      NUMERIC(8,4) NOT NULL,
    nearby_action       VARCHAR(10),
    nearby_action_value NUMERIC(14,6),
    nearby_action_date  DATE,
    run_at              TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (ticker, flag_date)
);

-- Per-stock aggregate: worst divergence, full-window return error, flag count.
-- This is what the frontend reads for the KPI row and the flags table.
CREATE TABLE IF NOT EXISTS impact_summary (
    ticker              VARCHAR(20)  PRIMARY KEY,
    company_name        VARCHAR(100),
    max_divergence_pct  NUMERIC(8,4),
    worst_flag_date     DATE,
    return_yf           NUMERIC(10,4),
    return_stooq_adj    NUMERIC(10,4),
    return_error_pct    NUMERIC(10,4),
    n_flags             INTEGER,
    primary_cause       VARCHAR(10),
    last_flag_date      DATE,
    run_at              TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_prices_yf_ticker    ON raw_prices_yf    (ticker, date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_prices_stooq_ticker ON raw_prices_stooq (ticker, date DESC);
CREATE INDEX IF NOT EXISTS idx_corp_actions_ticker     ON corporate_actions_yf (ticker, ex_date DESC);
CREATE INDEX IF NOT EXISTS idx_flags_ticker            ON consistency_flags (ticker, flag_date DESC);
CREATE INDEX IF NOT EXISTS idx_flags_divergence        ON consistency_flags (divergence_pct DESC);
CREATE INDEX IF NOT EXISTS idx_impact_return_error     ON impact_summary    (return_error_pct DESC NULLS LAST);
