import { GameCanvas } from './components/GameCanvas';
import { TopBar } from './components/TopBar';
import { BottomToolbar } from './components/BottomToolbar';
import { TileInfoPanel } from './components/TileInfoPanel';

function App() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <GameCanvas />
      <TopBar onMenu={() => {}} />
      <TileInfoPanel />
      <BottomToolbar />
    </div>
  );
}

export default App;
