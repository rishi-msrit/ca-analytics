'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

interface PricePoint { date: string; value: number | null; }
interface CorporateAction { exDate: string; actionType: string; value: number | null; }
interface FlagPoint { flagDate: string; nearbyAction: string | null; nearbyActionValue: number | null; }

interface Props {
  yfPrices: PricePoint[];
  stooqPrices: PricePoint[];
  corporateActions: CorporateAction[];
  flags: FlagPoint[];
  ticker: string;
}

type ChartRow = { date: string; yf: number | null; stooq: number | null };

function buildData(yf: PricePoint[], stooq: PricePoint[]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const p of yf) map.set(p.date as string, { date: p.date as string, yf: p.value, stooq: null });
  for (const p of stooq) {
    const d = p.date as string;
    const row = map.get(d);
    if (row) row.stooq = p.value;
    else map.set(d, { date: d, yf: null, stooq: p.value });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const items = payload as { name: string; value: number; color: string }[];
  return (
    <div style={{
      background: '#1A2744', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10,
      padding: '10px 14px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ color: '#475569', fontWeight: 600, marginBottom: 6 }}>
        {(label as string)?.slice(0, 10)}
      </p>
      {items.map((item) => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
          <span style={{ color: '#94A3B8', minWidth: 160 }}>{item.name}</span>
          <span style={{ color: '#F1F5F9', fontFamily: 'monospace', fontWeight: 600 }}>
            {item.value != null ? `₹${item.value.toFixed(2)}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PriceComparisonChart({ yfPrices, stooqPrices, corporateActions, flags }: Props) {
  const data = buildData(yfPrices, stooqPrices);
  const step = Math.max(1, Math.floor(data.length / 10));

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No price data available yet.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(99,102,241,0.07)" strokeDasharray="4 4" />

          <XAxis
            dataKey="date"
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={step}
            tickFormatter={(v) => (v as string)?.slice(0, 7)}
          />

          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(v) =>
              `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
            }
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: 10, fontSize: '0.75rem' }}
            formatter={(v) => <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{v}</span>}
          />

          {/* Corporate action markers */}
          {corporateActions.map((a) => {
            const d = (a.exDate as string)?.slice(0, 10);
            return (
              <ReferenceLine
                key={`ca-${d}-${a.actionType}`}
                x={d}
                stroke={a.actionType === 'split' ? 'rgba(245,158,11,0.55)' : 'rgba(99,102,241,0.45)'}
                strokeDasharray="3 3"
                label={{
                  value: a.actionType === 'split' ? `Split ${a.value}:1` : `Div ₹${(a.value ?? 0).toFixed(1)}`,
                  position: 'top',
                  fill: a.actionType === 'split' ? '#F59E0B' : '#818CF8',
                  fontSize: 9,
                }}
              />
            );
          })}

          {/* Flag markers */}
          {flags.slice(0, 12).map((f) => (
            <ReferenceLine
              key={`f-${f.flagDate}`}
              x={(f.flagDate as string)?.slice(0, 10)}
              stroke="rgba(239,68,68,0.45)"
              strokeWidth={1.5}
            />
          ))}

          {/* Series 1 — Yahoo Finance adjusted close */}
          <Line
            type="monotone"
            dataKey="yf"
            name="Yahoo Finance (Adj Close)"
            stroke="#6366F1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366F1' }}
            connectNulls={false}
          />

          {/* Series 2 — custom backward-adjusted close */}
          <Line
            type="monotone"
            dataKey="stooq"
            name="Custom Backward Adj"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#F59E0B' }}
            connectNulls={false}
            strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
