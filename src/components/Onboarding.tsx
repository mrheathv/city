import { useState } from 'react';

const STEPS = [
  {
    icon: '🖐️',
    title: 'Welcome to MetroSim',
    body: 'Build and grow a city from a patch of land. Pan by dragging with one finger, pinch (or scroll) to zoom.',
  },
  {
    icon: '🧰',
    title: 'Tools live at the bottom',
    body: 'Tap a category — Zone, Infra, Services, Bulldoze — to open its tools, then tap or drag across the map to paint.',
  },
  {
    icon: '🏗️',
    title: 'Zone, then connect utilities',
    body: 'Zoned land only develops once it has road access, power, and water. Run power lines and water pipes alongside your roads.',
  },
  {
    icon: '📊',
    title: 'Tap any tile for details',
    body: 'Select the Select tool and tap a tile to see its land value, pollution, crime, and traffic. The ☰ menu has budget, taxes, and save/load.',
  },
];

const STORAGE_KEY = 'metrosim.onboarded';

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    onDone();
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-end sm:items-center sm:justify-center bg-black/70">
      <div className="w-full sm:w-96 bg-neutral-900 text-white rounded-t-2xl sm:rounded-2xl border border-white/10 p-6 pb-8">
        <div className="text-5xl mb-4 text-center">{current.icon}</div>
        <h2 className="text-lg font-semibold mb-2 text-center">{current.title}</h2>
        <p className="text-sm text-white/70 text-center mb-6">{current.body}</p>

        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-sky-400' : 'bg-white/20'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {!isLast && (
            <button onClick={finish} className="h-12 px-4 rounded-lg bg-white/10 active:bg-white/20 text-sm font-medium">
              Skip
            </button>
          )}
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="flex-1 h-12 rounded-lg bg-sky-500 active:bg-sky-600 text-sm font-semibold"
          >
            {isLast ? "Let's build!" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
