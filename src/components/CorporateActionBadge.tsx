'use client';

import { clsx } from 'clsx';

type CauseType = 'dividend' | 'split' | 'both' | null | undefined;

interface CorporateActionBadgeProps {
  cause: CauseType;
  className?: string;
}

const labels: Record<string, string> = {
  dividend: 'Dividend',
  split: 'Split',
  both: 'Both',
};

export default function CorporateActionBadge({ cause, className }: CorporateActionBadgeProps) {
  if (!cause) {
    return (
      <span className={clsx('badge badge-clean', className)}>
        ✓ Clean
      </span>
    );
  }

  const badgeClass = {
    dividend: 'badge-dividend',
    split: 'badge-split',
    both: 'badge-both',
  }[cause] ?? 'badge-dividend';

  const icons: Record<string, string> = {
    dividend: '₹',
    split: '⟨⟩',
    both: '⚠',
  };

  return (
    <span className={clsx('badge', badgeClass, className)}>
      <span>{icons[cause]}</span>
      {labels[cause]}
    </span>
  );
}
