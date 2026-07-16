'use client';

import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import Tooltip from './Tooltip';

interface KpiCardProps {
  label: string;
  value: string | number | null;
  subtext?: string;
  info: string;
  icon: 'flags' | 'error' | 'stocks';
  loading?: boolean;
  delay?: number;
}

const icons = { flags: AlertTriangle, error: TrendingUp, stocks: Activity };

const palette = {
  flags: {
    text: '#F59E0B', icon: 'text-amber-400',
    bg: 'bg-amber-400/10', border: 'border-amber-400/20',
    glow: 'rgba(245,158,11,0.12)',
  },
  error: {
    text: '#EF4444', icon: 'text-red-400',
    bg: 'bg-red-400/10', border: 'border-red-400/20',
    glow: 'rgba(239,68,68,0.1)',
  },
  stocks: {
    text: '#818CF8', icon: 'text-indigo-400',
    bg: 'bg-indigo-400/10', border: 'border-indigo-400/20',
    glow: 'rgba(99,102,241,0.12)',
  },
};

export default function KpiCard({ label, value, subtext, info, icon, loading = false, delay = 0 }: KpiCardProps) {
  const Icon = icons[icon];
  const c = palette[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="glass-card p-6 flex flex-col gap-3 relative overflow-hidden"
      style={{ boxShadow: `0 0 36px ${c.glow}` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${c.text}60, transparent)` }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="kpi-label">{label}</span>
          <Tooltip content={info} side="bottom" />
        </div>
        <div className={clsx('p-2 rounded-xl', c.bg, `border ${c.border}`)}>
          <Icon className={clsx('w-4 h-4', c.icon)} strokeWidth={2.5} />
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-9 w-28 rounded-lg" />
      ) : (
        <div className="kpi-value num" style={{ color: c.text }}>{value ?? '—'}</div>
      )}

      {subtext && !loading && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {subtext}
        </p>
      )}
    </motion.div>
  );
}
