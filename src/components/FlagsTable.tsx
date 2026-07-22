'use client';

import { useState } from 'react';

export interface FlagRow {
  ticker: string;
  companyName: string | null;
  maxDivergencePct: number | null;
  worstFlagDate: string | null;
  returnYf: number | null;
  returnStooqAdj: number | null;
  returnErrorPct: number | null;
  nFlags: number;
  primaryCause: string | null;
  lastFlagDate: string | null;
}

type SortKey = 'returnErrorPct' | 'maxDivergencePct' | 'nFlags' | 'ticker';

function f(v: number | null | undefined, d = 2): string {
  return v == null ? '—' : v.toFixed(d);
}

// Info tooltip (CSS-only hover)
function Info({ tip, left }: { tip: string; left?: boolean }) {
  return (
    <span className={`info-btn${left ? ' tip-left' : ''}`} role="img" aria-label="Info">
      i<span className="tip">{tip}</span>
    </span>
  );
}

function CauseBadge({ cause }: { cause: string | null }) {
  if (!cause) return <span style={{ color: 'var(--t3)' }}>—</span>;
  const colors: Record<string, { bg: string; color: string }> = {
    dividend: { bg: 'var(--blue-bg)',  color: 'var(--blue)' },
    split:    { bg: 'var(--amber-bg)', color: 'var(--amber)' },
    both:     { bg: 'var(--red-bg)',   color: 'var(--red)' },
  };
  const c = colors[cause] ?? { bg: 'var(--surface2)', color: 'var(--t3)' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.color,
    }}>
      {cause.charAt(0).toUpperCase() + cause.slice(1)}
    </span>
  );
}

export default function FlagsTable({
  rows, loading, selectedTicker, onSelectTicker,
}: {
  rows: FlagRow[];
  loading: boolean;
  selectedTicker: string | null;
  onSelectTicker: (t: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('returnErrorPct');
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');

  function handleSort(k: SortKey) {
    if (sortKey === k) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(k); setDir('desc'); }
  }

  const sorted = [...rows].sort((a, b) => {
    let av: number | string | null = null;
    let bv: number | string | null = null;
    if (sortKey === 'returnErrorPct') { av = a.returnErrorPct; bv = b.returnErrorPct; }
    else if (sortKey === 'maxDivergencePct') { av = a.maxDivergencePct; bv = b.maxDivergencePct; }
    else if (sortKey === 'nFlags') { av = a.nFlags; bv = b.nFlags; }
    else { av = a.ticker; bv = b.ticker; }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const arrow = (k: SortKey) => sortKey === k ? (dir === 'desc' ? ' ↓' : ' ↑') : '';

  const wrapStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
  };

  if (loading) {
    return (
      <div style={wrapStyle}>
        <table className="data-table">
          <thead><tr>
            {['Ticker', 'Return Error', 'Max Divergence', 'Flags', 'Cause', 'Worst Date', 'S1 Return', 'S2 Return'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {Array.from({ length: 7 }).map((_, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="skeleton" style={{ height: 14, width: j === 0 ? 80 : 56 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ ...wrapStyle, padding: '52px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: 'var(--t2)', marginBottom: 8, fontWeight: 500 }}>No flagged stocks yet</p>
        <p style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.6 }}>
          Go to GitHub → Actions → &quot;Daily Corporate Actions Ingestion &amp; Analysis&quot; → Run workflow
        </p>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('ticker')}>
                Ticker{arrow('ticker')}
              </th>
              <th className="sortable" onClick={() => handleSort('returnErrorPct')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Return Error{arrow('returnErrorPct')}
                  <Info tip="How many percentage points your 3-year return would be off if you used Yahoo's numbers vs our calculation. Bigger means more misleading the data would be." />
                </span>
              </th>
              <th className="sortable" onClick={() => handleSort('maxDivergencePct')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Max Divergence{arrow('maxDivergencePct')}
                  <Info tip="The worst single-day difference between S1 and S2, as a percentage of the S1 price. This is the biggest gap we saw on any one day." />
                </span>
              </th>
              <th className="sortable" onClick={() => handleSort('nFlags')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Flag Days{arrow('nFlags')}
                  <Info tip="How many individual days this stock showed a disagreement between the two series. More days usually means a bigger or recurring adjustment problem." />
                </span>
              </th>
              <th>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Cause
                  <Info tip="What type of corporate action was happening nearby when the disagreement occurred — dividend payment, stock split, or both." left />
                </span>
              </th>
              <th>Worst Date</th>
              <th>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  S1 Return
                  <Info tip="3-year cumulative return using Yahoo's own adjusted close. This is what most tools would show you by default." left />
                </span>
              </th>
              <th>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  S2 Return
                  <Info tip="3-year cumulative return using our independently calculated adjusted series. If this differs from S1, the data quality issue has a real return impact." left />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const active = selectedTicker === row.ticker;
              const errColor = row.returnErrorPct != null && row.returnErrorPct > 1
                ? 'var(--red)'
                : 'var(--amber)';
              return (
                <tr
                  key={row.ticker}
                  className={active ? 'row-active' : ''}
                  onClick={() => onSelectTicker(row.ticker)}
                >
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 14 }}>
                      {row.ticker.replace(/\.(NS|BO)$/i, '')}
                    </div>
                    {row.companyName && (
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{row.companyName}</div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: errColor, fontVariantNumeric: 'tabular-nums' }}>
                    {row.returnErrorPct != null ? `${f(row.returnErrorPct)} pp` : '—'}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--t2)' }}>
                    {row.maxDivergencePct != null ? `${f(row.maxDivergencePct, 3)}%` : '—'}
                  </td>
                  <td style={{ color: 'var(--t1)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {row.nFlags}
                  </td>
                  <td><CauseBadge cause={row.primaryCause} /></td>
                  <td style={{ fontSize: 13, color: 'var(--t2)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.worstFlagDate ? String(row.worstFlagDate).slice(0, 10) : '—'}
                  </td>
                  <td style={{ color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.returnYf != null ? `${f(row.returnYf, 1)}%` : '—'}
                  </td>
                  <td style={{ color: 'var(--orange)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.returnStooqAdj != null ? `${f(row.returnStooqAdj, 1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
