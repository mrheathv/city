import { useGameStore } from '../state/store';

export function UndergroundBanner() {
  const undergroundView = useGameStore((s) => s.undergroundView);
  const setTool = useGameStore((s) => s.setTool);

  if (!undergroundView) return null;

  return (
    <div className="pointer-events-none absolute top-16 left-0 right-0 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 bg-sky-950/90 border border-sky-400/30 text-sky-100 text-sm rounded-full pl-4 pr-2 py-1.5 shadow-lg">
        <span>💧 Underground view — water pipes</span>
        <button
          onClick={() => setTool('select')}
          className="h-8 px-3 rounded-full bg-sky-400/20 active:bg-sky-400/30 text-xs font-medium whitespace-nowrap"
        >
          Back to surface
        </button>
      </div>
    </div>
  );
}
