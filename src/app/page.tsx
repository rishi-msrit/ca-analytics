'use client';

import { useEffect, useState, useCallback } from 'react';
import FlagsTable, { type FlagRow } from '@/components/FlagsTable';
import StockDetailPanel from '@/components/StockDetailPanel';

interface Summary {
  totalFlags: number;
  stocksAffected: number;
  maxReturnError: number | null;
  lastRunAt: string | null;
  universeSize: number;
}

function n2(v: number | null | undefined): string {
  return v == null ? '\u2014' : v.toFixed(2);
}

function lastRunLabel(iso: string | null): string {
  if (!iso) return 'Awaiting first run';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
}

function Info({ tip, left }: { tip: string; left?: boolean }) {
  return (
    <span className={`info-dot${left ? ' tip-left' : ''}`}>
      i<span className="tip">{tip}</span>
    </span>
  );
}

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
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const wrap: React.CSSProperties = { maxWidth: 1060, margin: '0 auto', padding: '0 24px' };

  return (
    <>
      {/* ── Minimal header ─────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ ...wrap, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden style={{ flexShrink: 0 }}>
              <rect width="20" height="20" rx="5" fill="var(--blue)" opacity="0.12" />
              <path d="M4 14L8 8L11 12L15 5L17 8" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>CA Analytics</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>
              {loading ? '…' : lastRunLabel(summary?.lastRunAt ?? null)}
            </span>
            <button onClick={toggleTheme} title="Toggle theme" style={{
              width: 30, height: 30, borderRadius: 8, fontSize: 14,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--t2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button onClick={load} style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main style={{ ...wrap, paddingTop: 44, paddingBottom: 72, display: 'flex', flexDirection: 'column', gap: 44 }}>

        {/* Hero: title + headline stats inline */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              Corporate Actions Monitor
            </h1>
            <Info tip="Checks if stock prices are adjusted correctly after dividends and splits. We compare Yahoo Finance's adjustments against an independent calculation and flag every difference." />
          </div>
          <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.65, maxWidth: 560 }}>
            Tracking {summary?.universeSize ?? 80} stocks across Nifty 50, S&amp;P 500, and global markets.
            Updated every weekday.
          </p>

          {/* Stats — flat, no cards, just numbers with labels */}
          <div style={{ display: 'flex', gap: 48, marginTop: 28, flexWrap: 'wrap' }}>
            {[
              {
                label: 'Inconsistencies',
                value: loading ? null : String(summary?.totalFlags ?? 0),
                color: 'var(--amber)',
                tip: 'Each flag is a specific stock on a specific day where the two price series disagreed by more than 0.02%.',
              },
              {
                label: 'Worst return error',
                value: loading ? null : (summary?.maxReturnError != null ? `${n2(summary.maxReturnError)} pp` : '0 pp'),
                color: 'var(--red)',
                tip: 'The biggest gap in 3-year returns between the two series. Even half a percentage point compounds into real money over time.',
              },
              {
                label: 'Stocks affected',
                value: loading ? null : `${summary?.stocksAffected ?? 0} of ${summary?.universeSize ?? 80}`,
                color: 'var(--blue)',
                tip: 'How many of the tracked stocks had at least one day where the adjustment didn\u2019t match.',
              },
            ].map(({ label, value, color, tip }) => (
              <div key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {label}
                  </span>
                  <Info tip={tip} />
                </div>
                {value == null
                  ? <div className="skeleton" style={{ height: 36, width: 80 }} />
                  : <span style={{ fontSize: 36, fontWeight: 700, color, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                      {value}
                    </span>
                }
              </div>
            ))}
          </div>
        </section>

        {/* Separator with legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--t3)' }}>
          <span style={{ height: 1, flex: 1, background: 'var(--border)', minWidth: 40 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: 'var(--blue)', display: 'inline-block', borderRadius: 1 }} />
            <span>S1</span>
            <Info tip="Yahoo Finance's own adjusted close price. This is what most tools use by default." />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, display: 'inline-block', backgroundImage: 'repeating-linear-gradient(90deg,var(--orange) 0,var(--orange) 4px,transparent 4px,transparent 8px)' }} />
            <span>S2</span>
            <Info tip="Our independent calculation — we apply the standard dividend/split formula to raw prices from scratch." />
          </div>
          <span style={{ height: 1, flex: 1, background: 'var(--border)', minWidth: 40 }} />
        </div>

        {/* Table */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--t1)' }}>
                Flagged Stocks
              </h2>
              {!loading && flags.length > 0 && (
                <span style={{ fontSize: 14, color: 'var(--t3)', fontWeight: 400 }}>({flags.length})</span>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>Click any row for details</span>
          </div>
          <FlagsTable
            rows={flags}
            loading={loading}
            selectedTicker={ticker}
            onSelectTicker={(t) => setTicker((prev) => (prev === t ? null : t))}
          />
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{
        ...wrap, paddingTop: 16, paddingBottom: 24,
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--t3)',
      }}>
        <span>CA Analytics</span>
        <span>Data from Yahoo Finance · Neon Postgres · Vercel</span>
      </footer>

      {/* ── Detail panel ───────────────────────────────────────────── */}
      <StockDetailPanel ticker={ticker} onClose={() => setTicker(null)} />
      {ticker && (
        <div onClick={() => setTicker(null)} style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)',
        }} />
      )}
    </>
  );
}
