'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import CorporateActionBadge from './CorporateActionBadge';
import Tooltip from './Tooltip';

export interface FlagRow {
  ticker: string;
  companyName: string;
  maxDivergencePct: number | null;
  worstFlagDate: string | null;
  returnYf: number | null;
  returnStooqAdj: number | null;
  returnErrorPct: number | null;
  nFlags: number;
  primaryCause: 'dividend' | 'split' | 'both' | null;
  lastFlagDate: string | null;
}

type SortKey = 'returnErrorPct' | 'maxDivergencePct' | 'nFlags' | 'ticker';

interface FlagsTableProps {
  rows: FlagRow[];
  loading?: boolean;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}

const columns: { key: SortKey; label: string; info: string }[] = [
  {
    key: 'ticker',
    label: 'Ticker',
    info: 'NSE ticker symbol. All tickers use the .NS suffix (National Stock Exchange). Click a row to see the full price series comparison.',
  },
  {
    key: 'returnErrorPct',
    label: 'Return Error (pp)',
    info: 'How many percentage points off a 3-year return calculation would be if you used the less accurate source. Computed as |return_yf - return_stooq_adj| over the full 3-year window.',
  },
  {
    key: 'maxDivergencePct',
    label: 'Max Divergence',
    info: 'Largest single-day relative difference between the two adjusted series: |adj_yf - adj_stooq| / adj_yf. Values above 0.5% near a corporate action are flagged.',
  },
  {
    key: 'nFlags',
    label: 'Flags',
    info: 'Number of individual trading days where the divergence exceeded 0.5% and a corporate action (dividend or split) was within 7 days.',
  },
];

function fmt(n: number | null, d = 2) {
  return n == null ? '—' : n.toFixed(d);
}

function SortIndicator({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 opacity-25" />;
  return asc ? <ChevronUp className="w-3 h-3 text-indigo-400" /> : <ChevronDown className="w-3 h-3 text-indigo-400" />;
}

const CAUSE_FILTERS = ['all', 'dividend', 'split', 'both'] as const;

export default function FlagsTable({ rows, loading, selectedTicker, onSelectTicker }: FlagsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('returnErrorPct');
  const [sortAsc, setSortAsc] = useState(false);
  const [causeFilter, setCauseFilter] = useState<string>('all');

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) setSortAsc((a) => !a);
      else { setSortAsc(false); }
      return key;
    });
  }, []);

  const displayRows = [...rows]
    .filter((r) => causeFilter === 'all' || r.primaryCause === causeFilter)
    .sort((a, b) => {
      let av: number | string | null, bv: number | string | null;
      if (sortKey === 'ticker') { av = a.ticker; bv = b.ticker; }
      else if (sortKey === 'nFlags') { av = a.nFlags; bv = b.nFlags; }
      else if (sortKey === 'maxDivergencePct') { av = a.maxDivergencePct; bv = b.maxDivergencePct; }
      else { av = a.returnErrorPct; bv = b.returnErrorPct; }

      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'string') {
        return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  return (
    <div className="glass-card overflow-hidden">
      <div
        className="flex items-start sm:items-center justify-between px-6 py-5 border-b flex-col sm:flex-row gap-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Flagged Stocks
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Click any row to open the side-by-side price chart for that stock
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Filter by cause:</span>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            {CAUSE_FILTERS.map((f) => (
              <button
                key={f}
                id={`filter-${f}`}
                onClick={() => setCauseFilter(f)}
                className="px-3 py-1.5 text-xs font-medium transition-colors capitalize"
                style={{
                  background: causeFilter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: causeFilter === f ? '#818CF8' : 'var(--color-text-muted)',
                }}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} id={`th-${col.key}`} onClick={() => handleSort(col.key)}>
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <Tooltip content={col.info} side="bottom" />
                    <SortIndicator active={sortKey === col.key} asc={sortAsc} />
                  </div>
                </th>
              ))}
              <th>Company</th>
              <th>
                <div className="flex items-center gap-1.5">
                  Cause
                  <Tooltip content="What type of corporate action caused this divergence — a cash dividend, a stock split, or both in the same period." side="bottom" />
                </div>
              </th>
              <th>Worst Date</th>
              <th>
                <div className="flex items-center gap-1.5">
                  YF Return
                  <Tooltip content="3-year cumulative return using Yahoo Finance's adjusted price series as the start and end price." side="bottom" />
                </div>
              </th>
              <th>
                <div className="flex items-center gap-1.5">
                  Stooq Return
                  <Tooltip content="3-year cumulative return using Stooq's prices with our custom backward-adjustment applied." side="bottom" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}>
                      <div className="skeleton h-4 rounded" style={{ width: `${50 + ((i * 3 + j * 7) % 50)}px` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
                  {rows.length === 0
                    ? 'No data yet — run the ingestion pipeline first.'
                    : 'No stocks match this filter.'}
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {displayRows.map((row, i) => (
                  <motion.tr
                    key={row.ticker}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.015 }}
                    className={clsx(selectedTicker === row.ticker ? 'selected' : '')}
                    onClick={() => onSelectTicker(row.ticker)}
                    id={`row-${row.ticker.replace('.', '-')}`}
                  >
                    <td>
                      <span className="mono font-semibold text-indigo-300 text-sm">
                        {row.ticker.replace('.NS', '')}
                      </span>
                    </td>
                    <td>
                      {row.returnErrorPct != null ? (
                        <span
                          className="mono font-semibold"
                          style={{
                            color: row.returnErrorPct > 2 ? '#EF4444'
                                 : row.returnErrorPct > 0.5 ? '#F59E0B'
                                 : '#10B981',
                          }}
                        >
                          {fmt(row.returnErrorPct)} pp
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className="mono text-amber-400 font-medium">{fmt(row.maxDivergencePct, 3)}%</span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>{row.nFlags}</span>
                    </td>
                    <td style={{ maxWidth: '180px' }}>
                      <span className="text-xs truncate block" style={{ color: 'var(--color-text-secondary)' }}>
                        {row.companyName}
                      </span>
                    </td>
                    <td><CorporateActionBadge cause={row.primaryCause} /></td>
                    <td className="mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {row.worstFlagDate ?? '—'}
                    </td>
                    <td className="mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {row.returnYf != null ? `${fmt(row.returnYf, 1)}%` : '—'}
                    </td>
                    <td className="mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {row.returnStooqAdj != null ? `${fmt(row.returnStooqAdj, 1)}%` : '—'}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
