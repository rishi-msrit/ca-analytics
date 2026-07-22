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
  return v == null ? '\u2014' : v.toFixed(d);
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
      .catch(() => setErr('Failed to load'));
  }, [ticker]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!ticker) return null;

  const s = detail?.summary;

  const statStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--t3)', marginBottom: 4,
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
      width: '100%', maxWidth: 620,
      background: 'var(--bg)', borderLeft: '1px solid var(--border)',
      overflowY: 'auto', boxShadow: '-16px 0 48px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>
            {ticker.replace(/\.(NS|BO)$/i, '')}
          </span>
          {detail && <span style={{ fontSize: 14, color: 'var(--t3)', marginLeft: 10 }}>{detail.companyName}</span>}
          {detail?.sector && <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{detail.sector}</p>}
        </div>
        <button onClick={onClose} style={{
          padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Close
        </button>
      </div>

      <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {err && <p style={{ fontSize: 14, color: 'var(--red)' }}>{err}</p>}

        {!detail && !err && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[90, 140, 110, 100].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 16, width: w }} />
            ))}
          </div>
        )}

        {detail && (
          <>
            {/* Flat stats — no tiles */}
            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
              {[
                { label: 'Return Error', value: `${n(s?.returnErrorPct)} pp`, color: 'var(--red)' },
                { label: 'S1 Return', value: `${n(s?.returnYf, 1)}%`, color: 'var(--blue)' },
                { label: 'S2 Return', value: `${n(s?.returnStooqAdj, 1)}%`, color: 'var(--orange)' },
                { label: 'Max Divergence', value: `${n(s?.maxDivergencePct, 3)}%`, color: 'var(--t1)' },
                { label: 'Flag Days', value: String(s?.nFlags ?? 0), color: 'var(--t1)' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p style={statStyle}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Impact note */}
            {s && s.nFlags > 0 && (
              <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, borderLeft: '2px solid var(--red)', paddingLeft: 14 }}>
                Over 3 years, S1 returns <strong style={{ color: 'var(--blue)' }}>{n(s.returnYf, 1)}%</strong> while
                S2 returns <strong style={{ color: 'var(--orange)' }}>{n(s.returnStooqAdj, 1)}%</strong> \u2014
                a gap of <strong style={{ color: 'var(--red)' }}>{n(s.returnErrorPct)} pp</strong>.
                {s.primaryCause ? ` Most mismatches are near ${s.primaryCause} events.` : ''}
              </p>
            )}

            {/* Chart */}
            {(detail.yfPrices.length > 0 || detail.stooqPrices.length > 0) && (
              <div>
                <p style={statStyle}>Price comparison</p>
                <PriceComparisonChart
                  yfPrices={detail.yfPrices}
                  stooqPrices={detail.stooqPrices}
                  flags={detail.flags}
                  corporateActions={detail.corporateActions}
                />
              </div>
            )}

            {/* Flagged dates */}
            {detail.flags.length > 0 && (
              <div>
                <p style={{ ...statStyle, marginBottom: 10 }}>Flagged dates ({detail.flags.length})</p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Date', 'S1', 'S2', 'Gap', 'Nearby'].map((h) => (
                            <th key={h} style={{
                              padding: '8px 12px', textAlign: 'left', fontSize: 10,
                              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                              color: 'var(--t3)', background: 'var(--surface)',
                              borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.flags.slice(0, 50).map((flag) => {
                          const tdS: React.CSSProperties = {
                            padding: '8px 12px', fontSize: 13, color: 'var(--t2)',
                            borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums',
                          };
                          return (
                            <tr key={String(flag.flagDate).slice(0, 10)}>
                              <td style={tdS}>{String(flag.flagDate).slice(0, 10)}</td>
                              <td style={{ ...tdS, color: 'var(--blue)' }}>{n(flag.adjCloseYf)}</td>
                              <td style={{ ...tdS, color: 'var(--orange)' }}>{n(flag.adjCloseStooq)}</td>
                              <td style={{ ...tdS, color: 'var(--red)' }}>{n(flag.divergencePct, 3)}%</td>
                              <td style={{ ...tdS, color: 'var(--t3)', fontSize: 12 }}>
                                {flag.nearbyAction ? `${flag.nearbyAction} \u00b7 ${String(flag.nearbyActionDate).slice(0, 10)}` : '\u2014'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {detail.flags.length > 50 && (
                    <p style={{ padding: '8px 12px', fontSize: 12, color: 'var(--t3)' }}>+{detail.flags.length - 50} more</p>
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
