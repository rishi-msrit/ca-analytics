'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pos = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <div ref={ref} className="relative inline-flex items-center flex-shrink-0">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center transition-colors"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-3)',
        }}
        aria-label="More info"
      >
        <Info className="w-2 h-2" strokeWidth={2.5} />
      </button>

      {visible && (
        <div
          className={`absolute z-50 w-60 rounded-xl px-3 py-2.5 text-xs leading-relaxed pointer-events-none ${pos}`}
          style={{
            background: '#0E1624',
            border: '1px solid rgba(34,211,238,0.15)',
            color: 'var(--text-2)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
