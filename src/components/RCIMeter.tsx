import { useState } from 'react';
import { useGameStore } from '../state/store';

const BARS = [
  { key: 'residential' as const, label: 'R', color: '#3fae56' },
  { key: 'commercial' as const, label: 'C', color: '#3b82c4' },
  { key: 'industrial' as const, label: 'I', color: '#c4a83b' },
];

const BAR_HEIGHT = 34; // px, half above/half below the zero line

function Bar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const half = BAR_HEIGHT / 2;
  const fillHeight = Math.max(2, (Math.abs(clamped) / 100) * half);
  const isPositive = clamped >= 0;

  return (
    <div className="relative w-3" style={{ height: BAR_HEIGHT }}>
      <div className="absolute inset-0 bg-white/20 rounded-sm" />
      <div className="absolute left-0 right-0 h-0.5 bg-white/50" style={{ top: half - 1 }} />
      <div
        className="absolute left-0 right-0 rounded-sm"
        style={{
          height: fillHeight,
          top: isPositive ? half - fillHeight : half,
          background: isPositive ? color : '#e35d5d',
        }}
      />
    </div>
  );
}

function demandLabel(value: number): string {
  if (value > 40) return 'Booming';
  if (value > 10) return 'Growing';
  if (value > -10) return 'Stable';
  if (value > -40) return 'Declining';
  return 'Collapsing';
}

export function RCIMeter() {
  const demand = useGameStore((s) => s.demand);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-end gap-1.5 h-11 px-2 rounded-lg bg-white/5 active:bg-white/15"
        aria-label="RCI demand"
      >
        {BARS.map((b) => (
          <Bar key={b.key} value={demand[b.key]} color={b.color} />
        ))}
      </button>

      {expanded && (
        <div className="absolute top-full mt-1 right-0 sm:left-0 sm:right-auto bg-black/90 border border-white/10 rounded-xl p-3 text-sm text-white w-48 shadow-lg z-10">
          {BARS.map((b) => (
            <div key={b.key} className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: b.color }} />
                {b.label === 'R' ? 'Residential' : b.label === 'C' ? 'Commercial' : 'Industrial'}
              </span>
              <span className="text-white/60">{demandLabel(demand[b.key])}</span>
            </div>
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="mt-2 w-full h-9 rounded-lg bg-white/10 active:bg-white/20 text-xs font-medium"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
