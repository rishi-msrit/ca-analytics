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
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const positionClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        className="w-4 h-4 rounded-full inline-flex items-center justify-center transition-colors flex-shrink-0"
        style={{
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.3)',
          color: '#818CF8',
        }}
        aria-label="More information"
      >
        <Info className="w-2.5 h-2.5" strokeWidth={2.5} />
      </button>

      {visible && (
        <div
          className={`absolute z-50 w-64 rounded-xl px-3 py-2.5 text-xs leading-relaxed pointer-events-none ${positionClass}`}
          style={{
            background: '#1A2744',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#94A3B8',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
