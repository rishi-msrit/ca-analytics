'use client';

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';

interface Pt { date: string; value: number | null; }
interface Action { exDate: string; actionType: string; value: number | null; }
interface Flag { flagDate: string; nearbyAction: string | null; }

function build(yf: Pt[], s2: Pt[]) {
  const m = new Map<string, { date: string; yf: number | null; s2: number | null }>();
  for (const p of yf) {
    const d = String(p.date).slice(0, 10);
    m.set(d, { date: d, yf: p.value, s2: null });
  }
  for (const p of s2) {
    const d = String(p.date).slice(0, 10);
    const r = m.get(d);
    if (r) r.s2 = p.value;
    else m.set(d, { date: d, yf: null, s2: p.value });
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function Tip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) return null;
  const items = payload as { name: string; value: number; color: string }[];
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <p style={{ color: 'var(--t3)', marginBottom: 5, fontWeight: 500 }}>{String(label).slice(0, 10)}</p>
      {items.map((item) => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--t3)', fontSize: 11, minWidth: 130 }}>{item.name}</span>
          <span style={{ color: 'var(--t1)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {item.value != null ? `₹${Number(item.value).toFixed(2)}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PriceComparisonChart({
  yfPrices, stooqPrices, corporateActions, flags,
}: {
  yfPrices: Pt[];
  stooqPrices: Pt[];
  corporateActions: Action[];
  flags: Flag[];
}) {
  const data = build(yfPrices, stooqPrices);
  if (!data.length) {
    return (
      <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 14 }}>
        No price data available
      </div>
    );
  }
  const step = Math.max(1, Math.floor(data.length / 8));

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--t3)', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
            tickLine={false} axisLine={false}
            interval={step} tickFormatter={(v) => String(v).slice(0, 7)}
          />
          <YAxis
            tick={{ fill: 'var(--t3)', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
            tickLine={false} axisLine={false} width={64}
            tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          />
          <Tooltip content={<Tip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
            formatter={(v) => <span style={{ color: 'var(--t2)', fontFamily: 'DM Sans, sans-serif' }}>{v}</span>}
          />
          {corporateActions.slice(0, 24).map((a) => (
            <ReferenceLine
              key={`${String(a.exDate).slice(0, 10)}-${a.actionType}`}
              x={String(a.exDate).slice(0, 10)}
              stroke={a.actionType === 'split' ? '#d97706' : '#2563eb'}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          ))}
          {flags.slice(0, 24).map((f) => (
            <ReferenceLine
              key={String(f.flagDate).slice(0, 10)}
              x={String(f.flagDate).slice(0, 10)}
              stroke="#dc2626"
              strokeOpacity={0.35}
            />
          ))}
          <Line type="monotone" dataKey="yf" name="S1 — Yahoo Adj Close" stroke="#2563eb" strokeWidth={1.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="s2" name="S2 — Custom Adj" stroke="#ea580c" strokeWidth={1.5} dot={false} connectNulls={false} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
