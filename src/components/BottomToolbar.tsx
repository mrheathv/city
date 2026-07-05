import { useState } from 'react';
import { useGameStore } from '../state/store';
import type { ToolId } from '../sim/types';

interface ToolDef {
  id: ToolId;
  label: string;
  icon: string;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  tools: ToolDef[];
}

const CATEGORIES: Category[] = [
  { id: 'select', label: 'Select', icon: '↖', tools: [{ id: 'select', label: 'Select', icon: '↖' }] },
  {
    id: 'zone',
    label: 'Zone',
    icon: '▦',
    tools: [
      { id: 'zone_res_low', label: 'Res. Low', icon: '🏠' },
      { id: 'zone_res_high', label: 'Res. High', icon: '🏢' },
      { id: 'zone_com_low', label: 'Com. Low', icon: '🏪' },
      { id: 'zone_com_high', label: 'Com. High', icon: '🏬' },
      { id: 'zone_ind_light', label: 'Ind. Light', icon: '🏭' },
      { id: 'zone_ind_heavy', label: 'Ind. Heavy', icon: '⚙' },
    ],
  },
  {
    id: 'infra',
    label: 'Infra',
    icon: '🛣',
    tools: [
      { id: 'road', label: 'Road', icon: '🛣' },
      { id: 'rail', label: 'Rail', icon: '🚆' },
      { id: 'powerline', label: 'Power Line', icon: '⚡' },
      { id: 'waterpipe', label: 'Water Pipe', icon: '💧' },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    icon: '🏛',
    tools: [
      { id: 'facility_power_coal', label: 'Coal Plant', icon: '⚡' },
      { id: 'facility_power_solar', label: 'Solar Farm', icon: '☀' },
      { id: 'facility_water_pump', label: 'Water Pump', icon: '💧' },
      { id: 'facility_water_tower', label: 'Water Tower', icon: '💧' },
      { id: 'facility_police', label: 'Police', icon: '★' },
      { id: 'facility_fire', label: 'Fire Station', icon: '🔥' },
      { id: 'facility_hospital', label: 'Hospital', icon: '+' },
      { id: 'facility_school', label: 'School', icon: '🎓' },
      { id: 'facility_park', label: 'Park', icon: '🌳' },
    ],
  },
  { id: 'bulldoze', label: 'Bulldoze', icon: '💥', tools: [{ id: 'bulldoze', label: 'Bulldoze', icon: '💥' }] },
];

export function BottomToolbar() {
  const tool = useGameStore((s) => s.tool);
  const setTool = useGameStore((s) => s.setTool);
  const trafficView = useGameStore((s) => s.trafficView);
  const setTrafficView = useGameStore((s) => s.setTrafficView);
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeCategory = CATEGORIES.find((c) => c.tools.some((t) => t.id === tool));

  function onCategoryTap(cat: Category) {
    if (cat.tools.length === 1) {
      setTool(cat.tools[0].id);
      setExpanded(null);
      return;
    }
    setExpanded((prev) => (prev === cat.id ? null : cat.id));
  }

  const expandedCategory = CATEGORIES.find((c) => c.id === expanded);

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 flex flex-col">
      {expandedCategory && (
        <div className="flex gap-2 overflow-x-auto px-2 py-2 bg-black/80 backdrop-blur-sm border-t border-white/10">
          {expandedCategory.tools.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTool(t.id);
                setExpanded(null);
              }}
              className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-lg px-2 shrink-0 ${
                tool === t.id ? 'bg-sky-500/80' : 'bg-white/10'
              } active:bg-white/20 text-white`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] mt-1 whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-around items-center px-1 py-1.5 bg-black/80 backdrop-blur-sm border-t border-white/10">
        {CATEGORIES.map((cat) => {
          const isActive = expanded === cat.id || (activeCategory?.id === cat.id && expanded === null);
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryTap(cat)}
              className={`flex flex-col items-center justify-center flex-1 h-12 mx-0.5 rounded-lg ${
                isActive ? 'bg-sky-500/80' : 'bg-white/5'
              } active:bg-white/20 text-white`}
            >
              <span className="text-xl leading-none">{cat.icon}</span>
              <span className="text-[10px] mt-0.5">{cat.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setTrafficView(!trafficView)}
          className={`flex flex-col items-center justify-center flex-1 h-12 mx-0.5 rounded-lg ${
            trafficView ? 'bg-sky-500/80' : 'bg-white/5'
          } active:bg-white/20 text-white`}
          aria-pressed={trafficView}
        >
          <span className="text-xl leading-none">🚦</span>
          <span className="text-[10px] mt-0.5">Traffic</span>
        </button>
      </div>
    </div>
  );
}
