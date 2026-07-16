'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw, GitBranch, Database, ChevronDown, ChevronUp } from 'lucide-react';
import KpiCard from '@/components/KpiCard';
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

function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--color-border)', background: 'rgba(15,23,42,0.6)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:bg-white/5"
        id="how-it-works-toggle"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            How does this work?
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{
            background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)',
          }}>
            methodology
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        }
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="px-6 py-5 grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-indigo-300 mb-1">Step 1 — Ingest (daily, 09:00 IST)</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  A GitHub Actions job fetches 3 years of daily OHLCV data and all corporate action events
                  (dividends, splits) for every Nifty 50 stock from Yahoo Finance via yfinance.
                  Both the raw (unadjusted) close and Yahoo&apos;s own Adj Close are stored — each in a
                  separate table so they can be compared independently.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-300 mb-1">Step 2 — Build two adjusted series</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong className="text-indigo-200">Series 1</strong> uses Yahoo&apos;s own Adj Close directly — their proprietary CRSP-style backward adjustment applied internally.
                  <br /><br />
                  <strong className="text-amber-200">Series 2</strong> takes the raw (unadjusted) Close and applies a textbook backward-adjustment algorithm from scratch, using the same dividend amounts and split ratios that yfinance publishes.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-indigo-300 mb-1">Step 3 — Flag divergences</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Both series should be identical if the adjustment was applied the same way. Any date where they differ by more than <strong className="text-white">0.5%</strong> and a corporate action is within 7 days gets flagged.
                  The 0.5% threshold is above normal floating-point noise (~0.01%) but low enough to catch a typical missed dividend.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-300 mb-1">Step 4 — Quantify the impact</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  For each flagged stock, the pipeline computes what a 3-year return would look like using each series and reports the gap in percentage points. This is the concrete financial cost of using inaccurate adjusted data.
                </p>
              </div>
            </div>
          </div>
          <div
            className="mx-6 mb-5 rounded-xl px-4 py-3 text-xs"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', color: 'var(--color-text-muted)' }}
          >
            <strong className="text-slate-300">Source:</strong>{' '}
            <span className="text-indigo-300">Yahoo Finance</span> (via yfinance, no API key). Both series
            use the same underlying price data — Series 1 is Yahoo&apos;s internal Adj Close; Series 2 is
            the raw Close with a textbook backward-adjustment re-applied. The difference shows where
            Yahoo&apos;s pipeline deviates from a standard implementation.
          </div>
        </motion.div>
      )}
    </div>
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
    fetch('/api/flags?sort=returnErrorPct&limit=50')
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
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(8,12,20,0.88)', backdropFilter: 'blur(20px)', borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', lineHeight: 1 }}>
                CA Analytics
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Nifty 50 &middot; Corporate Actions Consistency Monitor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-2">
              <div className="pulse-dot" />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {summaryLoading ? 'Loading...' : `Last run: ${formatTime(summary?.lastRunAt ?? null)}`}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full border font-medium"
                style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.25)', color: '#818CF8' }}>
                yfinance
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>vs</span>
              <span className="text-xs px-2.5 py-1 rounded-full border font-medium"
                style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)', color: '#FCD34D' }}>
                Stooq
              </span>
            </div>

            <button
              id="refresh-data"
              onClick={fetchData}
              title="Refresh data"
              className="p-2 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl p-7 border relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(8,12,20,0.9) 60%)',
            borderColor: 'rgba(99,102,241,0.2)',
          }}
        >
          <div
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }}
          />
          <div className="relative max-w-3xl">
            <h1 className="text-xl font-bold mb-3 gradient-text">
              Corporate Actions Data Consistency Monitor
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Stock prices must be adjusted for dividends and splits to produce correct return calculations.
              Different data vendors apply these adjustments differently — sometimes on different dates, with different rounding, or using different dividend amounts.
              This pipeline catches those inconsistencies by comparing two independently-adjusted price series for every Nifty 50 stock and measuring how much the gap distorts a return calculation.
            </p>
            <div className="flex flex-wrap gap-5 mt-5">
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Neon Postgres &middot; pre-computed results
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                GitHub Actions &middot; Mon–Fri 09:00 IST
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                50 stocks &middot; 3-year daily window
              </div>
            </div>
          </div>
        </motion.div>

        {/* How it works (collapsible) */}
        <HowItWorks />

        {/* KPI row */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              This run
            </h2>
            <Tooltip
              content="These numbers are computed fresh each time the daily pipeline runs and stored in the database. The dashboard reads pre-computed results — no live API calls to Yahoo or Stooq on page load."
              side="right"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Inconsistencies Detected"
              value={summaryLoading ? null : summary?.totalFlags ?? 0}
              subtext="Total flagged date-stock pairs — each is a day where the two series diverged above 0.5% near a corporate action"
              info="A flag is raised when: (1) the two adjusted series differ by more than 0.5% on a given day, and (2) a corporate action (dividend or split) occurred within 7 calendar days of that date."
              icon="flags"
              loading={summaryLoading}
              delay={0}
            />
            <KpiCard
              label="Largest Return Error"
              value={summaryLoading ? null : summary?.maxReturnError != null ? `${summary.maxReturnError.toFixed(2)} pp` : '0 pp'}
              subtext="Biggest 3-year return distortion caused by an adjustment mismatch — in percentage points"
              info="For each flagged stock, we compute: |return_yf - return_stooq| where return = (adj_close_end / adj_close_start) - 1. This KPI shows the worst case across all Nifty 50 stocks."
              icon="error"
              loading={summaryLoading}
              delay={0.08}
            />
            <KpiCard
              label="Stocks Affected"
              value={summaryLoading ? null : `${summary?.stocksAffected ?? 0} / ${summary?.universeSize ?? 50}`}
              subtext="Nifty 50 constituents with at least one flagged divergence"
              info="Out of all 50 Nifty 50 stocks tracked. A stock counts as 'affected' if it has at least one trading day with a flagged adjustment inconsistency in the current 3-year window."
              icon="stocks"
              loading={summaryLoading}
              delay={0.16}
            />
          </div>
        </div>

        {/* Methodology legend */}
        <div
          className="rounded-xl px-5 py-3.5 border text-xs flex flex-wrap gap-x-6 gap-y-2"
          style={{
            background: 'rgba(15,23,42,0.6)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded" style={{ background: '#6366F1', display: 'inline-block' }} />
            <strong className="text-indigo-300">Yahoo adj:</strong> CRSP-style backward adjustment applied by Yahoo Finance
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded" style={{
              display: 'inline-block',
              backgroundImage: 'repeating-linear-gradient(90deg,#F59E0B 0,#F59E0B 4px,transparent 4px,transparent 7px)',
            }} />
            <strong className="text-amber-300">Stooq adj:</strong> Stooq raw close + custom backward adjustment algorithm
          </div>
          <div className="flex items-center gap-1.5">
            <strong className="text-slate-300">Threshold:</strong> divergence flagged at &gt;0.5% — above floating-point noise, below a typical missed dividend
          </div>
        </div>

        {/* Flags table */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Flagged stocks
            </h2>
            <Tooltip
              content="Sorted by return error by default. Click a column header to sort by that metric. Click a row to open a side-by-side chart view for that stock."
              side="right"
            />
          </div>
          <FlagsTable
            rows={flags}
            loading={flagsLoading}
            selectedTicker={selectedTicker}
            onSelectTicker={handleSelectTicker}
          />
        </div>

      </main>

      {/* Footer */}
      <footer
        className="max-w-7xl mx-auto px-6 py-8 mt-4 border-t text-xs flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <span>CA Analytics &middot; Nifty 50 Corporate Actions Consistency Pipeline</span>
        <div className="flex items-center gap-4">
          <span>Source 1: <strong className="text-indigo-300">Yahoo Finance</strong></span>
          <span>Source 2: <strong className="text-amber-300">Stooq</strong></span>
          <span>DB: <strong className="text-slate-300">Neon Postgres</strong></span>
        </div>
      </footer>

      {/* Stock detail panel */}
      <StockDetailPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />

      {/* Backdrop */}
      {selectedTicker && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          id="panel-backdrop"
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(8,12,20,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSelectedTicker(null)}
        />
      )}
    </div>
  );
}
