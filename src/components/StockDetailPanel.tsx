'use client';

import { useEffect, useState } from 'react';
import PriceComparisonChart from './PriceComparisonChart';

interface StockDetail {
  ticker: string;
  companyName: string;
  sector: string | null;
  summary: {
    maxDivergencePct: number | null;
    worstFlagDate: string | null;
    returnYf: number | null;
    returnStooqAdj: number | null;
    returnErrorPct: number | null;
    nFlags: number;
    primaryCause: string | null;
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

function n(v: number | null | undefined, d = 2): string {
  return v == null ? '—' : v.toFixed(d);
}

export default function StockDetailPanel({
  ticker, onClose,
}: { ticker: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) { setDetail(null); setErr(null); return; }
    setDetail(null); setErr(null);
    fetch(`/api/stock/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setErr(String(d.error)); else setDetail(d as StockDetail); })
      .catch(() => setErr('Failed to load data'));
  }, [ticker]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!ticker) return null;

  const s = detail?.summary;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
      width: '100%', maxWidth: 660,
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      overflowY: 'auto',
      boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>
              {ticker.replace(/\.(NS|BO)$/i, '')}
            </span>
            {detail && <span style={{ fontSize: 13, color: 'var(--t3)' }}>{detail.companyName}</span>}
          </div>
          {detail?.sector && <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{detail.sector}</p>}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ✕ Close
        </button>
      </div>

      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {err && <p style={{ fontSize: 14, color: 'var(--red)' }}>{err}</p>}

        {!detail && !err && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[80, 130, 100, 90, 110].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 16, width: w }} />
            ))}
          </div>
        )}

        {detail && (
          <>
            {/* Stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Return Error', value: `${n(s?.returnErrorPct)} pp`, color: 'var(--red)' },
                { label: 'S1 Return (3yr)', value: `${n(s?.returnYf, 1)}%`, color: 'var(--blue)' },
                { label: 'S2 Return (3yr)', value: `${n(s?.returnStooqAdj, 1)}%`, color: 'var(--orange)' },
                { label: 'Max Divergence', value: `${n(s?.maxDivergencePct, 3)}%`, color: 'var(--t1)' },
                { label: 'Flag Days', value: String(s?.nFlags ?? 0), color: 'var(--t1)' },
                { label: 'Worst Date', value: s?.worstFlagDate ? String(s.worstFlagDate).slice(0, 10) : '—', color: 'var(--t1)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, padding: 14,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 6 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Plain summary */}
            {s && s.nFlags > 0 && (
              <div style={{
                padding: '12px 16px',
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                borderRadius: 8, fontSize: 14, color: 'var(--t2)', lineHeight: 1.7,
                opacity: 0.9,
              }}>
                Over 3 years, S1 gives a return of{' '}
                <strong style={{ color: 'var(--blue)' }}>{n(s.returnYf, 1)}%</strong> while S2 gives{' '}
                <strong style={{ color: 'var(--orange)' }}>{n(s.returnStooqAdj, 1)}%</strong> —
                a gap of <strong style={{ color: 'var(--red)' }}>{n(s.returnErrorPct)} percentage points</strong>.
                The two series disagree on {s.nFlags} day{s.nFlags !== 1 ? 's' : ''}.
                {s.primaryCause ? ` Most mismatches are near ${s.primaryCause} events.` : ''}
              </div>
            )}

            {/* Chart */}
            {(detail.yfPrices.length > 0 || detail.stooqPrices.length > 0) && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 12 }}>
                  Price comparison
                </p>
                <PriceComparisonChart
                  yfPrices={detail.yfPrices}
                  stooqPrices={detail.stooqPrices}
                  flags={detail.flags}
                  corporateActions={detail.corporateActions}
                />
                <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
                  Dashed lines: <span style={{ color: 'var(--blue)' }}>blue</span> = dividend · <span style={{ color: 'var(--amber)' }}>amber</span> = split · <span style={{ color: 'var(--red)' }}>red</span> = flagged day
                </p>
              </div>
            )}

            {/* Flagged dates */}
            {detail.flags.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 10 }}>
                  Flagged dates ({detail.flags.length})
                </p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Date', 'S1 Adj', 'S2 Adj', 'Divergence', 'Nearby Action'].map((h) => (
                            <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.flags.slice(0, 60).map((flag) => (
                          <tr key={String(flag.flagDate).slice(0, 10)}>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--t2)', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                              {String(flag.flagDate).slice(0, 10)}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--blue)', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                              {n(flag.adjCloseYf)}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--orange)', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                              {n(flag.adjCloseStooq)}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--red)', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                              {n(flag.divergencePct, 3)}%
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--t3)', borderBottom: '1px solid var(--border)' }}>
                              {flag.nearbyAction ? `${flag.nearbyAction} · ${String(flag.nearbyActionDate).slice(0, 10)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {detail.flags.length > 60 && (
                    <p style={{ padding: '8px 12px', fontSize: 12, color: 'var(--t3)' }}>+{detail.flags.length - 60} more rows</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
