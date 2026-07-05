import { useGameStore } from '../state/store';
import { formatMoney, formatNumber, formatSimDate } from '../utils/format';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const funds = useGameStore((s) => s.funds);
  const population = useGameStore((s) => s.population);
  const simDay = useGameStore((s) => s.simDay);
  const speed = useGameStore((s) => s.speed);
  const paused = useGameStore((s) => s.paused);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const togglePause = useGameStore((s) => s.togglePause);

  return (
    <div className="pointer-events-auto absolute top-0 left-0 right-0 flex items-center gap-2 px-2 py-2 bg-black/70 backdrop-blur-sm text-white text-sm sm:text-base border-b border-white/10">
      <button
        onClick={onMenu}
        className="flex items-center justify-center w-11 h-11 rounded-lg bg-white/10 active:bg-white/20 shrink-0"
        aria-label="Menu"
      >
        <span className="text-xl">☰</span>
      </button>

      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-semibold truncate">{formatMoney(funds)}</span>
        <span className="text-xs text-white/60 truncate">{formatSimDate(simDay)}</span>
      </div>

      <div className="flex flex-col leading-tight ml-2 min-w-0">
        <span className="font-semibold truncate">{formatNumber(population)}</span>
        <span className="text-xs text-white/60">pop.</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={togglePause}
          className={`w-11 h-11 rounded-lg flex items-center justify-center ${paused ? 'bg-amber-500/80' : 'bg-white/10'} active:bg-white/20`}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? '▶' : '⏸'}
        </button>
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s as 1 | 2 | 3)}
            className={`w-9 h-11 rounded-lg text-xs font-semibold flex items-center justify-center ${
              !paused && speed === s ? 'bg-sky-500/80' : 'bg-white/10'
            } active:bg-white/20`}
            aria-label={`Speed ${s}x`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
