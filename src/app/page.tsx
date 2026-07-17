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

interface KpiCardProps {
  label: string;
  value: string | number | null;
  sub: string;
  info: string;
  accentColor: string;
  accentBg: string;
  icon: React.ElementType;
  loading: boolean;
  delay?: number;
}

function KpiCard({ label, value, sub, info, accentColor, accentBg, icon: Icon, loading, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card p-6 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            {label}
          </p>
          <Tooltip content={info} side="bottom" />
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accentBg }}>
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
      </div>

      {loading
        ? <div className="skeleton h-9 w-28 rounded" />
        : <p className="text-3xl font-bold tracking-tight mono" style={{ color: accentColor }}>{value ?? '—'}</p>
      }

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
      .then(r => r.json())
      .then(d => { setSummary(d); setSummaryLoading(false); })
      .catch(() => setSummaryLoading(false));
    fetch('/api/flags?sort=returnErrorPct&limit=80')
      .then(r => r.json())
      .then(d => { setFlags(d.data ?? []); setFlagsLoading(false); })
      .catch(() => setFlagsLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(5,8,15,0.9)', backdropFilter: 'blur(20px)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--cyan-dim)', border: '1px solid var(--cyan-border)' }}>
              <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
            </div>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>CA Analytics</span>
            <span className="hidden sm:block text-xs" style={{ color: 'var(--text-4)' }}>·</span>
            <span className="hidden sm:block text-xs truncate" style={{ color: 'var(--text-3)' }}>Adjustment Consistency Monitor</span>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <div className="pulse-dot" />
              <span className="text-xs mono" style={{ color: 'var(--text-3)' }}>
                {summaryLoading ? '…' : formatTime(summary?.lastRunAt ?? null)}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-md mono"
                style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid var(--cyan-border)' }}>
                S1: Yahoo Adj
              </span>
              <span style={{ color: 'var(--text-4)' }}>vs</span>
              <span className="px-2 py-0.5 rounded-md mono"
                style={{ background: 'var(--orange-dim)', color: 'var(--orange)', border: '1px solid var(--orange-border)' }}>
                S2: Custom Adj
              </span>
            </div>

            <button onClick={fetchData} title="Refresh"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-3)' }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">

        {/* Hero + How it works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid lg:grid-cols-3 gap-5"
        >
          {/* Hero */}
          <div className="lg:col-span-2 card p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)' }} />
            <h1 className="text-2xl font-bold mb-3 leading-snug gradient-text">
              Corporate Actions<br />Consistency Monitor
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)', maxWidth: '520px' }}>
              When a stock pays a dividend or splits, historical prices need backward adjustment.
              This pipeline re-applies that adjustment from scratch and compares it to Yahoo Finance&apos;s
              internal result — finding where the two differ and measuring the exact impact on 3-year returns.
            </p>
            <div className="flex flex-wrap gap-4 mt-5 text-xs" style={{ color: 'var(--text-3)' }}>
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
                Neon Postgres
              </div>
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
                GitHub Actions · Mon–Fri 09:00 IST
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
                80 stocks · 3-year daily window
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="card p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>How it works</p>
            {[
              { n: '01', title: 'Ingest', body: 'yfinance fetches 3yr OHLCV + corporate actions for all 80 stocks in one batched API call.' },
              { n: '02', title: 'Dual series', body: 'S1 = Yahoo Adj Close. S2 = raw close with textbook backward adjustment applied from scratch.' },
              { n: '03', title: 'Flag & measure', body: 'Flag days where S1 vs S2 diverge >0.1%. Compute 3-year return with each series and report the gap.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-3">
                <span className="text-xs font-bold mono flex-shrink-0 mt-0.5" style={{ color: 'var(--cyan)' }}>{n}</span>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-1)' }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* KPI cards */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Latest pipeline run</p>
            <Tooltip content="Results are computed by the nightly GitHub Actions pipeline and stored in Postgres. This page reads pre-computed results — no live market API calls on load." side="right" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Inconsistencies Found"
              value={summaryLoading ? null : summary?.totalFlags ?? 0}
              sub="Date-stock pairs where the two adjusted series diverge by more than 0.1% near a corporate action"
              info="Flag = one stock, one day where |Series1 − Series2| / Series1 > 0.1%. Covers real adjustment timing and rounding differences."
              accentColor="var(--amber)"
              accentBg="var(--amber-dim)"
              icon={AlertTriangle}
              loading={summaryLoading}
              delay={0}
            />
            <KpiCard
              label="Worst Return Error"
              value={summaryLoading ? null : summary?.maxReturnError != null ? `${summary.maxReturnError.toFixed(2)} pp` : '0 pp'}
              sub="Largest gap between 3-year returns computed from each series, in percentage points"
              info="For each stock: |return_S1 − return_S2| where return = (price_end / price_start) − 1 over the shared 3-year window."
              accentColor="var(--red)"
              accentBg="rgba(248,113,113,0.1)"
              icon={TrendingUp}
              loading={summaryLoading}
              delay={0.07}
            />
            <KpiCard
              label="Stocks Affected"
              value={summaryLoading ? null : `${summary?.stocksAffected ?? 0} / ${summary?.universeSize ?? 80}`}
              sub="Stocks with at least one flagged adjustment divergence across 80 tracked names"
              info="80 stocks: Nifty 50 (IN) + top 20 S&P 500 (US) + 10 global large-caps. Affected = 1+ flagged days in the 3-year window."
              accentColor="var(--cyan)"
              accentBg="var(--cyan-dim)"
              icon={Activity}
              loading={summaryLoading}
              delay={0.14}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 rounded-xl border text-xs"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded flex-shrink-0" style={{ background: 'var(--cyan)', display: 'inline-block' }} />
            <strong style={{ color: 'var(--text-2)' }}>Series 1</strong> — Yahoo Finance Adj Close (internal pipeline)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 flex-shrink-0" style={{
              display: 'inline-block',
              backgroundImage: 'repeating-linear-gradient(90deg,#F97316 0,#F97316 5px,transparent 5px,transparent 9px)',
            }} />
            <strong style={{ color: 'var(--text-2)' }}>Series 2</strong> — Raw close + textbook backward adjustment
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <strong style={{ color: 'var(--text-2)' }}>Threshold</strong> &gt;0.1% divergence
          </div>
        </div>

        {/* Flags table */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Flagged stocks</p>
            <Tooltip content="Sorted by return error. Click a column header to re-sort. Click any row to open the detail panel with the full price chart and per-date breakdown." side="right" />
          </div>
          <FlagsTable
            rows={flags}
            loading={flagsLoading}
            selectedTicker={selectedTicker}
            onSelectTicker={(t) => setSelectedTicker(p => p === t ? null : t)}
          />
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-5 mt-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-4)' }}>
        <span>CA Analytics · Corporate Actions Adjustment Consistency</span>
        <div className="flex items-center gap-4">
          <span>Data: <span style={{ color: 'var(--cyan)' }}>Yahoo Finance</span></span>
          <span>DB: <span style={{ color: 'var(--text-3)' }}>Neon Postgres</span></span>
          <span>Host: <span style={{ color: 'var(--text-3)' }}>Vercel</span></span>
        </div>
      </footer>

      <StockDetailPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />

      {selectedTicker && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(5,8,15,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedTicker(null)}
        />
      )}
    </div>
  );
}
