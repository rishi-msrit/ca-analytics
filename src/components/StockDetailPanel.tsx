'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import CorporateActionBadge from './CorporateActionBadge';
import PriceComparisonChart from './PriceComparisonChart';
import Tooltip from './Tooltip';

interface StockDetail {
  ticker: string;
  companyName: string;
  sector: string;
  summary: {
    maxDivergencePct: number | null;
    worstFlagDate: string | null;
    returnYf: number | null;
    returnStooqAdj: number | null;
    returnErrorPct: number | null;
    nFlags: number;
    primaryCause: 'dividend' | 'split' | 'both' | null;
    lastFlagDate: string | null;
  };
  yfPrices: { date: string; value: number | null }[];
  stooqPrices: { date: string; value: number | null }[];
  corporateActions: { exDate: string; actionType: string; value: number | null }[];
  flags: {
    flagDate: string;
    adjCloseYf: number | null;
    adjCloseStooq: number | null;
    divergencePct: number | null;
    nearbyAction: string | null;
    nearbyActionValue: number | null;
    nearbyActionDate: string | null;
  }[];
}

function fmt(n: number | null, d = 2) {
  return n == null ? '—' : n.toFixed(d);
}

function StatCard({ label, value, sub, color, info }: {
  label: string; value: string; sub: string; color: string; info?: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="kpi-label text-xs">{label}</p>
        {info && <Tooltip content={info} side="right" />}
      </div>
      <p className="text-xl font-bold mono num" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
    </div>
  );
}

export default function StockDetailPanel({
  ticker,
  onClose,
}: {
  ticker: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/stock/${encodeURIComponent(ticker)}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setDetail(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [ticker]);

  return (
    <AnimatePresence>
      {ticker && (
        <motion.div
          key="panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="detail-panel fixed top-0 right-0 h-full z-50 overflow-y-auto"
          style={{ width: 'min(620px, 100vw)' }}
          id="detail-panel"
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', backdropFilter: 'blur(12px)' }}
          >
            <div>
              {loading && (
                <div className="space-y-2">
                  <div className="skeleton h-5 w-28 rounded" />
                  <div className="skeleton h-3 w-44 rounded" />
                </div>
              )}
              {detail && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="mono text-indigo-300 text-lg font-bold">{detail.ticker.replace('.NS', '')}</span>
                    <CorporateActionBadge cause={detail.summary.primaryCause} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {detail.companyName} &middot; {detail.sector}
                  </p>
                </>
              )}
            </div>
            <button
              id="close-detail-panel"
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-white/10 flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {error && (
              <div className="rounded-xl p-4 border border-red-400/30 text-red-400 text-sm">{error}</div>
            )}

            {loading && (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
              </div>
            )}

            {detail && (
              <>
                {/* Impact stats */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Return Error"
                    value={`${fmt(detail.summary.returnErrorPct)} pp`}
                    sub="percentage-point error in 3-year return"
                    color={
                      (detail.summary.returnErrorPct ?? 0) > 2 ? '#EF4444'
                      : (detail.summary.returnErrorPct ?? 0) > 0.5 ? '#F59E0B'
                      : '#10B981'
                    }
                    info="If an analyst used the less accurate source, their 3-year return calculation would be off by this many percentage points. Computed as |return_yf - return_stooq_adj|."
                  />
                  <StatCard
                    label="Max Divergence"
                    value={`${fmt(detail.summary.maxDivergencePct, 3)}%`}
                    sub="worst single-day price gap between sources"
                    color="#F59E0B"
                    info="The largest relative difference between Yahoo's Adj Close (Series 1) and the custom backward-adjusted series (Series 2) on any single trading day. Flagged when it coincides with a corporate action."
                  />
                  <StatCard
                    label="Yahoo 3yr Return"
                    value={`${fmt(detail.summary.returnYf, 1)}%`}
                    sub="adj_close, Yahoo's CRSP-style backward adjustment"
                    color="#818CF8"
                    info="Total return from start to end of the 3-year window using Yahoo Finance's Adj Close series. This is what you'd see if you used yfinance with auto_adjust=True."
                  />
                  <StatCard
                    label="Series 2 Return"
                    value={`${fmt(detail.summary.returnStooqAdj, 1)}%`}
                    sub="Raw close + textbook backward adjustment"
                    color="#F59E0B"
                    info="Total return using Yahoo's raw (unadjusted) close with a standard backward-adjustment algorithm applied from scratch using the same dividend/split data that yfinance publishes."
                  />
                </div>

                {/* Plain-language summary */}
                {detail.summary.nFlags > 0 && (
                  <div className="rounded-xl p-4 border" style={{
                    background: 'rgba(245,158,11,0.05)',
                    borderColor: 'rgba(245,158,11,0.18)',
                  }}>
                    <p className="text-xs font-semibold text-amber-300 mb-1.5">What this means</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {detail.ticker.replace('.NS', '')} has{' '}
                      <strong className="text-white">{detail.summary.nFlags} flagged date{detail.summary.nFlags > 1 ? 's' : ''}</strong>{' '}
                      where the two adjusted price series diverge above 0.5%. The worst single-day gap is{' '}
                      <strong className="text-amber-400">{fmt(detail.summary.maxDivergencePct, 3)}%</strong>
                      {detail.summary.worstFlagDate ? ` on ${detail.summary.worstFlagDate}` : ''}.
                      A portfolio analyst using the wrong source would report a 3-year return of{' '}
                      {fmt(detail.summary.returnYf, 1)}% (Series 1) vs {fmt(detail.summary.returnStooqAdj, 1)}% (Series 2),
                      a difference of{' '}
                      <strong className="text-red-400">{fmt(detail.summary.returnErrorPct)} percentage points</strong>.
                      The divergence is linked to a {detail.summary.primaryCause === 'both'
                        ? 'combination of dividend and split adjustments'
                        : `${detail.summary.primaryCause} adjustment`} applied differently across the two pipelines.
                    </p>
                  </div>
                )}

                {/* Chart */}
                <div className="glass-card p-5">
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Adjusted Price Series
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Both series should track identically — gaps reveal adjustment inconsistencies
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-0.5 rounded" style={{ background: '#6366F1', display: 'inline-block' }} />
                        Yahoo Finance
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-0.5 rounded" style={{
                          display: 'inline-block',
                          backgroundImage: 'repeating-linear-gradient(90deg,#F59E0B 0,#F59E0B 4px,transparent 4px,transparent 8px)',
                        }} />
                        Custom Backward Adj
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-px" style={{ background: 'rgba(239,68,68,0.6)', display: 'inline-block' }} />
                        Flagged date
                      </div>
                    </div>
                  </div>
                  <PriceComparisonChart
                    yfPrices={detail.yfPrices}
                    stooqPrices={detail.stooqPrices}
                    corporateActions={detail.corporateActions}
                    flags={detail.flags}
                    ticker={detail.ticker}
                  />
                  <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                    Vertical dashed lines mark corporate action ex-dates (indigo = dividend, amber = split). Red lines mark flagged divergence dates.
                  </p>
                </div>

                {/* Flag table */}
                {detail.flags.length > 0 && (
                  <div className="glass-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          Flagged Dates
                        </h3>
                        <Tooltip
                          content="Each row is a trading day where the two adjusted series diverged above 0.5% and a corporate action was within 7 days. This is the raw evidence behind the return error figure."
                          side="right"
                        />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {detail.flags.length} date{detail.flags.length > 1 ? 's' : ''} exceeding the 0.5% threshold
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Yahoo Adj</th>
                            <th>Series 2 Adj</th>
                            <th>Divergence</th>
                            <th>Nearby Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.flags.map((f) => (
                            <tr key={f.flagDate} style={{ cursor: 'default' }}>
                              <td className="mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{f.flagDate}</td>
                              <td className="mono text-xs" style={{ color: '#818CF8' }}>₹{fmt(f.adjCloseYf)}</td>
                              <td className="mono text-xs text-amber-400">₹{fmt(f.adjCloseStooq)}</td>
                              <td className="mono text-xs text-red-400 font-semibold">{fmt(f.divergencePct, 3)}%</td>
                              <td>
                                {f.nearbyAction ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <CorporateActionBadge cause={f.nearbyAction as 'dividend' | 'split'} />
                                    <span className="mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                      {f.nearbyAction === 'split'
                                        ? `${f.nearbyActionValue}:1`
                                        : `₹${fmt(f.nearbyActionValue)}`}
                                    </span>
                                  </div>
                                ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Corporate action history */}
                {detail.corporateActions.length > 0 && (
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-1.5 mb-4">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Corporate Action History
                      </h3>
                      <Tooltip
                        content="Events fetched from yfinance (Yahoo Finance). These are the dates and ratios used to build both adjusted series. Source: yfinance Ticker.actions."
                        side="right"
                      />
                    </div>
                    <div className="space-y-3">
                      {detail.corporateActions.map((a, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CorporateActionBadge cause={a.actionType as 'dividend' | 'split'} />
                            <span className="mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{a.exDate}</span>
                          </div>
                          <span className="mono text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {a.actionType === 'split' ? `${a.value}:1 split` : `₹${fmt(a.value, 2)} dividend`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
