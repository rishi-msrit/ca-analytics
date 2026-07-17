'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw, GitBranch, Database, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import FlagsTable, { FlagRow } from '@/components/FlagsTable';
import StockDetailPanel from '@/components/StockDetailPanel';
import Tooltip from '@/components/Tooltip';

interface Summary {
  totalFlags: number;
  stocksAffected: number;
  maxReturnError: number | null;
  lastRunAt: string | null;
  universeSize: number;
}

function formatTime(iso: string | null) {
  if (!iso) return 'Not yet run';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  }) + ' IST';
}

function KpiCard({
  label, value, sub, color, icon: Icon, info, loading = false, delay = 0,
}: {
  label: string;
  value: string | number | null;
  sub: string;
  color: string;
  dimColor: string;
  borderColor: string;
  icon: React.ElementType;
  info: string;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="kpi-label">{label}</span>
          <Tooltip content={info} side="bottom" />
        </div>
        <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-10 w-32 rounded-lg" />
      ) : (
        <p className="kpi-value num" style={{ color }}>{value ?? '—'}</p>
      )}

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{sub}</p>
    </motion.div>
  );
}

export default function HomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setSummaryLoading(true);
    setFlagsLoading(true);
    fetch('/api/summary')
      .then((r) => r.json())
      .then((d) => { setSummary(d); setSummaryLoading(false); })
      .catch(() => setSummaryLoading(false));
    fetch('/api/flags?sort=returnErrorPct&limit=80')
      .then((r) => r.json())
      .then((d) => { setFlags(d.data ?? []); setFlagsLoading(false); })
      .catch(() => setFlagsLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectTicker = useCallback((t: string) => {
    setSelectedTicker((prev) => prev === t ? null : t);
  }, []);

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(6,11,20,0.92)',
          backdropFilter: 'blur(24px)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-screen-xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)' }}>
              <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-1)' }}>
                CA Analytics
              </span>
              <span className="mx-2 text-xs" style={{ color: 'var(--text-4)' }}>/</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                Adjustment Consistency Monitor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-2">
              <div className="pulse-dot" />
              <span className="text-xs mono" style={{ color: 'var(--text-3)' }}>
                {summaryLoading ? '—' : formatTime(summary?.lastRunAt ?? null)}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-xs px-2 py-1 rounded-md mono"
                style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid var(--cyan-border)' }}>
                S1: Yahoo Adj
              </span>
              <span className="text-xs" style={{ color: 'var(--text-4)' }}>vs</span>
              <span className="text-xs px-2 py-1 rounded-md mono"
                style={{ background: 'var(--orange-dim)', color: 'var(--orange)', border: '1px solid var(--orange-border)' }}>
                S2: Custom Adj
              </span>
            </div>
            <button
              id="refresh-btn"
              onClick={fetchData}
              title="Refresh"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-3)' }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-8 py-10 space-y-10">

        {/* ── Hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid lg:grid-cols-5 gap-6"
        >
          {/* Main text block */}
          <div className="lg:col-span-3 glass-card p-8 relative overflow-hidden">
            <div
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)' }}
            />
            <h1 className="text-2xl font-bold mb-3 gradient-text leading-tight">
              Corporate Actions<br />Consistency Monitor
            </h1>
            <p className="text-sm leading-relaxed max-w-lg" style={{ color: 'var(--text-2)' }}>
              When a stock pays a dividend or splits, every historical price gets adjusted backward.
              This pipeline re-implements that adjustment from scratch and compares it against
              Yahoo Finance's internal result — surfacing where the two methods diverge
              and measuring the exact impact on 3-year return calculations.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              {[
                { icon: Database, text: 'Neon Postgres' },
                { icon: GitBranch, text: 'GitHub Actions · Mon–Fri 09:00 IST' },
                { icon: Activity, text: '80 stocks · 3-year window' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              How it works
            </p>
            {[
              { n: '01', title: 'Ingest', body: 'Fetch 3yr OHLCV + corporate action events from Yahoo Finance (yfinance) for all 80 stocks in one batched request.' },
              { n: '02', title: 'Two series', body: 'Series 1 = Yahoo\'s Adj Close. Series 2 = raw close with textbook backward-adjustment applied from scratch using the same event data.' },
              { n: '03', title: 'Flag & measure', body: 'Flag every day where the two differ by >0.1%. Compute the 3-year return using each series and report the gap in percentage points.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-3">
                <span className="mono text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: 'var(--cyan)' }}>{n}</span>
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-1)' }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── KPI strip ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              Latest run
            </p>
            <Tooltip
              content="Computed by the daily GitHub Actions pipeline and stored in Postgres. The page reads pre-computed results — no live market API calls on load."
              side="right"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Inconsistencies Found"
              value={summaryLoading ? null : summary?.totalFlags ?? 0}
              sub="Total flagged date-stock pairs where the two adjusted series differ by more than 0.1%"
              info="A flag = one stock, one trading day where |Series1 - Series2| / Series1 > 0.1%. Threshold sits above floating-point noise but catches real adjustment timing differences."
              color="var(--amber)"
              dimColor="var(--amber-dim)"
              borderColor="rgba(251,191,36,0.25)"
              icon={AlertTriangle}
              loading={summaryLoading}
              delay={0}
            />
            <KpiCard
              label="Worst Return Error"
              value={summaryLoading ? null : summary?.maxReturnError != null ? `${summary.maxReturnError.toFixed(2)} pp` : '0 pp'}
              sub="Largest gap between 3-year returns when computed from each series, in percentage points"
              info="For each stock: |return_S1 - return_S2| where return = (adj_close_end / adj_close_start) − 1 over the shared 3-year window."
              color="var(--red)"
              dimColor="var(--red-dim)"
              borderColor="rgba(248,113,113,0.25)"
              icon={TrendingUp}
              loading={summaryLoading}
              delay={0.07}
            />
            <KpiCard
              label="Stocks Affected"
              value={summaryLoading ? null : `${summary?.stocksAffected ?? 0} / ${summary?.universeSize ?? 80}`}
              sub="Out of 80 tracked stocks across Nifty 50, S&P 500 top 20, and global large-caps"
              info="80 stocks: Nifty 50 (India) + top 20 S&P 500 by market cap (US) + 10 global large-caps. Affected = at least one flagged day in the 3-year window."
              color="var(--cyan)"
              dimColor="var(--cyan-dim)"
              borderColor="var(--cyan-border)"
              icon={Activity}
              loading={summaryLoading}
              delay={0.14}
            />
          </div>
        </section>

        {/* ── Legend strip ── */}
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 rounded-xl text-xs border"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded inline-block" style={{ background: 'var(--cyan)' }} />
            <strong style={{ color: 'var(--text-2)' }}>Series 1</strong>
            Yahoo Finance Adj Close (their internal pipeline)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded inline-block" style={{
              backgroundImage: 'repeating-linear-gradient(90deg,#F97316 0,#F97316 5px,transparent 5px,transparent 9px)',
            }} />
            <strong style={{ color: 'var(--text-2)' }}>Series 2</strong>
            Raw close + textbook backward adjustment
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <strong style={{ color: 'var(--text-2)' }}>Threshold</strong>
            &gt;0.1% divergence
          </div>
        </div>

        {/* ── Flags table ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              Flagged stocks
            </p>
            <Tooltip
              content="Sorted by return error by default. Click a column header to re-sort. Click any row to open the detail panel with charts and per-date breakdown."
              side="right"
            />
          </div>
          <FlagsTable
            rows={flags}
            loading={flagsLoading}
            selectedTicker={selectedTicker}
            onSelectTicker={handleSelectTicker}
          />
        </section>

      </main>

      {/* ── Footer ── */}
      <footer
        className="max-w-screen-xl mx-auto px-8 py-6 mt-2 border-t text-xs flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--border)', color: 'var(--text-4)' }}
      >
        <span>CA Analytics · Corporate Actions Adjustment Consistency</span>
        <div className="flex items-center gap-4">
          <span>Data: <span style={{ color: 'var(--cyan)' }}>Yahoo Finance (yfinance)</span></span>
          <span>DB: <span style={{ color: 'var(--text-3)' }}>Neon Postgres</span></span>
          <span>Host: <span style={{ color: 'var(--text-3)' }}>Vercel</span></span>
        </div>
      </footer>

      <StockDetailPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />

      {selectedTicker && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          id="panel-backdrop"
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(6,11,20,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedTicker(null)}
        />
      )}
    </div>
  );
}
