import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { TopBar } from './components/TopBar';
import { BottomToolbar } from './components/BottomToolbar';
import { TileInfoPanel } from './components/TileInfoPanel';
import { BudgetPanel } from './components/BudgetPanel';

function App() {
  const [showBudget, setShowBudget] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <GameCanvas />
      <TopBar onMenu={() => setShowBudget(true)} />
      <TileInfoPanel />
      <BottomToolbar />
      <BudgetPanel open={showBudget} onClose={() => setShowBudget(false)} />
    </div>
  );
}

export default App;
