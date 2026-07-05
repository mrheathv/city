import { useGameStore } from '../state/store';

export function TrafficBanner() {
  const trafficView = useGameStore((s) => s.trafficView);
  const setTrafficView = useGameStore((s) => s.setTrafficView);

  if (!trafficView) return null;

  return (
    <div className="pointer-events-none absolute top-16 left-0 right-0 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 bg-neutral-950/90 border border-white/20 text-white text-sm rounded-full pl-4 pr-2 py-1.5 shadow-lg">
        <span className="flex items-center gap-1.5">
          🚦 Traffic
          <span className="inline-flex items-center gap-1 ml-1 text-xs text-white/70">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgb(74,222,128)' }} />
            clear
            <span className="w-2.5 h-2.5 rounded-full ml-1" style={{ background: 'rgb(250,204,21)' }} />
            busy
            <span className="w-2.5 h-2.5 rounded-full ml-1" style={{ background: 'rgb(220,38,38)' }} />
            jammed
          </span>
        </span>
        <button
          onClick={() => setTrafficView(false)}
          className="h-8 px-3 rounded-full bg-white/15 active:bg-white/25 text-xs font-medium whitespace-nowrap"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
