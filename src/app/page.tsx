'use client';

import { useEffect, useState, useCallback } from 'react';
import FlagsTable, { type FlagRow } from '@/components/FlagsTable';
import StockDetailPanel from '@/components/StockDetailPanel';

// ─── types ───────────────────────────────────────────────────────────────────

interface Summary {
  totalFlags: number;
  stocksAffected: number;
  maxReturnError: number | null;
  lastRunAt: string | null;
  universeSize: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function n2(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

function lastRunLabel(iso: string | null): string {
  if (!iso) return 'Never run';
  return (
    new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }) + ' IST'
  );
}

// ─── Inline info tooltip (CSS-only hover, info on demand only) ───────────────

function Info({ tip, left }: { tip: string; left?: boolean }) {
  return (
    <span className={`info-btn${left ? ' tip-left' : ''}`} role="img" aria-label="Info">
      i
      <span className="tip">{tip}</span>
    </span>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, info, loading,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  info: string;
  loading: boolean;
}) {
  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)' }}>
          {label}
        </p>
        <Info tip={info} />
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 36, width: 100, borderRadius: 6 }} />
      ) : (
        <p style={{ fontSize: 32, fontWeight: 700, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {value}
        </p>
      )}
      <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>{sub}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Page() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = (localStorage.getItem('theme') ?? 'light') as 'light' | 'dark';
    setTheme(saved);
  }, []);

  function toggleTheme() {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, fr] = await Promise.all([
        fetch('/api/summary').then((r) => r.json()),
        fetch('/api/flags?sort=return_error_pct&limit=80').then((r) => r.json()),
      ]);
      setSummary(sr as Summary);
      setFlags((fr.data ?? []) as FlagRow[]);
    } catch {
      // keep stale state on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const universeSize = summary?.universeSize ?? 80;

  // Shared layout styles
  const wrap: React.CSSProperties = { maxWidth: 1160, margin: '0 auto', padding: '0 24px' };

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ ...wrap, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Left: Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'var(--blue-bg)', border: '1px solid var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 12L5.5 7L9 10L12.5 4L14.5 6" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>CA Analytics</span>
            <span style={{ color: 'var(--border2)', fontSize: 15, userSelect: 'none' }}>/</span>
            <span style={{ fontSize: 14, color: 'var(--t3)', fontWeight: 400 }}>Consistency Monitor</span>
          </div>

          {/* Right: last run + theme toggle + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--green)', display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                {loading ? '…' : lastRunLabel(summary?.lastRunAt ?? null)}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              style={{
                width: 32, height: 32, borderRadius: 8, fontSize: 14,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--t2)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            <button
              id="refresh-btn"
              onClick={load}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main style={{ ...wrap, paddingTop: 40, paddingBottom: 64, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Title + one-liner */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Corporate Actions Consistency Monitor
            </h1>
            <Info tip="Stock prices need to be adjusted whenever a company pays a dividend or splits its shares — otherwise historical return calculations look wrong. This tool checks whether Yahoo Finance actually applied those adjustments correctly by running the same math independently and comparing results." />
          </div>
          <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 620 }}>
            Tracks 80 stocks across Nifty 50, S&amp;P 500, and global markets. Runs every weekday morning.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 10 }}>
            {[
              'Nifty 50 · S&P 500 · Global (80 stocks)',
              'yfinance · no API key needed',
              'GitHub Actions · Mon–Fri 09:00 IST',
              'Neon Postgres',
            ].map((t) => (
              <span key={t} style={{ fontSize: 12, color: 'var(--t3)' }}>· {t}</span>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <KpiCard
            label="Inconsistencies Found"
            value={loading ? '—' : String(summary?.totalFlags ?? 0)}
            sub="Date-stock pairs where the two calculations disagreed by more than 0.02%"
            color="var(--amber)"
            info="Each 'flag' is a specific stock on a specific day where our adjustment math didn't match Yahoo's. Could be a missed dividend, a timing issue, or rounding on their end."
            loading={loading}
          />
          <KpiCard
            label="Worst Return Error"
            value={loading ? '—' : (summary?.maxReturnError != null ? `${n2(summary.maxReturnError)} pp` : '0 pp')}
            sub="Biggest 3-year return gap between the two calculations, in percentage points"
            color="var(--red)"
            info="If you used Yahoo's numbers to calculate a stock's 3-year return, this is how many percentage points you'd be off compared to our calculation. Even half a percentage point compounds into real money."
            loading={loading}
          />
          <KpiCard
            label="Stocks Affected"
            value={loading ? '—' : `${summary?.stocksAffected ?? 0} / ${universeSize}`}
            sub="Stocks with at least one day where the two series disagreed"
            color="var(--blue)"
            info="Out of the 80 stocks we track, how many had at least one day where Yahoo's adjustment didn't match what the math should produce. Even one bad day can throw off a return calculation."
            loading={loading}
          />
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: '6px 24px', padding: '11px 16px', fontSize: 13, color: 'var(--t3)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 20, height: 2, background: 'var(--blue)', display: 'inline-block', borderRadius: 1, flexShrink: 0 }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <strong style={{ color: 'var(--t2)', fontWeight: 600 }}>S1</strong>
              <span>Yahoo Finance&apos;s own adjusted close</span>
              <Info tip="This is the price Yahoo publishes directly — they apply their own adjustment algorithm whenever a dividend or split happens." />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 20, height: 2, display: 'inline-block', flexShrink: 0,
              backgroundImage: 'repeating-linear-gradient(90deg,var(--orange) 0,var(--orange) 5px,transparent 5px,transparent 9px)',
            }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <strong style={{ color: 'var(--t2)', fontWeight: 600 }}>S2</strong>
              <span>Our independent calculation from raw prices</span>
              <Info tip="We take the raw (unadjusted) price and apply the standard dividend/split formula ourselves from scratch. If Yahoo did it right, S1 and S2 should match exactly." />
            </span>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>flags where gap &gt; 0.02%</span>
        </div>

        {/* Flags table */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)' }}>
                Flagged Stocks
              </p>
              {!loading && flags.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>({flags.length})</span>
              )}
              <Info tip="Stocks where at least one day in the past 3 years showed a difference between Yahoo's adjustment and ours. Click any row to see the full breakdown — chart, flagged dates, and return impact." />
            </div>
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>Click a row to see the detail breakdown →</p>
          </div>
          <FlagsTable
            rows={flags}
            loading={loading}
            selectedTicker={ticker}
            onSelectTicker={(t) => setTicker((prev) => (prev === t ? null : t))}
          />
        </div>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{
        ...wrap, paddingTop: 18, paddingBottom: 24,
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8, fontSize: 13, color: 'var(--t3)',
      }}>
        <span>CA Analytics · Corporate Actions Adjustment Consistency</span>
        <div style={{ display: 'flex', gap: 18 }}>
          {[['Data', 'Yahoo Finance'], ['DB', 'Neon Postgres'], ['Host', 'Vercel']].map(([k, v]) => (
            <span key={k}>{k}: <span style={{ color: 'var(--t2)' }}>{v}</span></span>
          ))}
        </div>
      </footer>

      {/* ── Detail panel + backdrop ────────────────────────────────── */}
      <StockDetailPanel ticker={ticker} onClose={() => setTicker(null)} />
      {ticker && (
        <div
          onClick={() => setTicker(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}
    </>
  );
}
