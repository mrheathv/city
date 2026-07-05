import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { TopBar } from './components/TopBar';
import { BottomToolbar } from './components/BottomToolbar';
import { TileInfoPanel } from './components/TileInfoPanel';
import { BudgetPanel } from './components/BudgetPanel';
import { Onboarding, hasSeenOnboarding } from './components/Onboarding';
import { UndergroundBanner } from './components/UndergroundBanner';

function App() {
  const [showBudget, setShowBudget] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <GameCanvas />
      <TopBar onMenu={() => setShowBudget(true)} />
      <UndergroundBanner />
      <TileInfoPanel />
      <BottomToolbar />
      <BudgetPanel open={showBudget} onClose={() => setShowBudget(false)} onShowTutorial={() => setShowOnboarding(true)} />
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  );
}

export default App;
