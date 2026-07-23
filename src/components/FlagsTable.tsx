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
  return v == null ? '\u2014' : v.toFixed(d);
}

function Info({ tip, left }: { tip: string; left?: boolean }) {
  return (
    <span className={`info-dot${left ? ' tip-left' : ''}`}>
      i<span className="tip">{tip}</span>
    </span>
  );
}

function CauseBadge({ cause }: { cause: string | null }) {
  if (!cause) return <span style={{ color: 'var(--t3)' }}>\u2014</span>;
  const c: Record<string, { bg: string; fg: string }> = {
    dividend: { bg: 'var(--blue-soft)', fg: 'var(--blue)' },
    split:    { bg: 'var(--amber-soft)', fg: 'var(--amber)' },
    both:     { bg: 'var(--red-soft)', fg: 'var(--red)' },
  };
  const s = c[cause] ?? { bg: 'var(--surface2)', fg: 'var(--t3)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.fg }}>
      {cause.charAt(0).toUpperCase() + cause.slice(1)}
    </span>
  );
}

const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--t3)',
  background: 'var(--surface)', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap', userSelect: 'none', position: 'relative', zIndex: 5,
};

const TD: React.CSSProperties = {
  padding: '12px 14px', fontSize: 14, color: 'var(--t2)',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
};

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
    let av: number | string | null = null, bv: number | string | null = null;
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

  const arrow = (k: SortKey) => sortKey === k ? (dir === 'desc' ? ' \u2193' : ' \u2191') : '';

  const tableWrap: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-sm)',
  };

  if (loading) {
    return (
      <div style={tableWrap}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Ticker', 'Return Error', 'Max Divergence', 'Flags', 'Cause', 'Worst Date', 'S1 Return', 'S2 Return'].map((h) => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} style={TD}><div className="skeleton" style={{ height: 14, width: j === 0 ? 80 : 52 }} /></td>
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
      <div style={{ ...tableWrap, padding: '56px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: 'var(--t2)', marginBottom: 6, fontWeight: 500 }}>No flagged stocks yet</p>
        <p style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.6 }}>
          The data pipeline hasn&apos;t completed its first run.
        </p>
      </div>
    );
  }

  return (
    <div style={tableWrap}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => handleSort('ticker')}>
                Ticker{arrow('ticker')}
              </th>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => handleSort('returnErrorPct')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Return Error{arrow('returnErrorPct')}
                  <Info tip="How many percentage points the 3-year return would differ if you used Yahoo's numbers vs ours." />
                </span>
              </th>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => handleSort('maxDivergencePct')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Max Divergence{arrow('maxDivergencePct')}
                  <Info tip="The single worst day — how far apart the two price series were, as a percentage." />
                </span>
              </th>
              <th style={{ ...TH, cursor: 'pointer' }} onClick={() => handleSort('nFlags')}>
                Flag Days{arrow('nFlags')}
              </th>
              <th style={TH}>Cause</th>
              <th style={TH}>Worst Date</th>
              <th style={TH}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  S1 Return
                  <Info tip="3-year return using Yahoo's own adjusted close." left />
                </span>
              </th>
              <th style={TH}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  S2 Return
                  <Info tip="3-year return using our independently adjusted series." left />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const active = selectedTicker === row.ticker;
              const errColor = row.returnErrorPct != null && row.returnErrorPct > 1 ? 'var(--red)' : 'var(--amber)';
              return (
                <tr
                  key={row.ticker}
                  onClick={() => onSelectTicker(row.ticker)}
                  style={{
                    cursor: 'pointer',
                    background: active ? 'var(--blue-soft)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={TD}>
                    <span style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 14 }}>
                      {row.ticker.replace(/\.(NS|BO)$/i, '')}
                    </span>
                    {row.companyName && (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginTop: 1 }}>{row.companyName}</span>
                    )}
                  </td>
                  <td style={{ ...TD, fontWeight: 700, color: errColor, fontVariantNumeric: 'tabular-nums' }}>
                    {row.returnErrorPct != null ? `${f(row.returnErrorPct)} pp` : '\u2014'}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>
                    {row.maxDivergencePct != null ? `${f(row.maxDivergencePct, 3)}%` : '\u2014'}
                  </td>
                  <td style={{ ...TD, color: 'var(--t1)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {row.nFlags}
                  </td>
                  <td style={TD}><CauseBadge cause={row.primaryCause} /></td>
                  <td style={{ ...TD, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {row.worstFlagDate ? String(row.worstFlagDate).slice(0, 10) : '\u2014'}
                  </td>
                  <td style={{ ...TD, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.returnYf != null ? `${f(row.returnYf, 1)}%` : '\u2014'}
                  </td>
                  <td style={{ ...TD, color: 'var(--orange)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.returnStooqAdj != null ? `${f(row.returnStooqAdj, 1)}%` : '\u2014'}
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
