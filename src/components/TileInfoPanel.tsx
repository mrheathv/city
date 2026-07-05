import { useGameStore } from '../state/store';
import { NetworkFlag, ZoneType, zoneCategory } from '../sim/types';
import { FACILITY_DEFS } from '../sim/facilities';
import { formatMoney } from '../utils/format';

const ZONE_LABELS: Record<number, string> = {
  [ZoneType.None]: 'Unzoned',
  [ZoneType.ResidentialLow]: 'Residential (Low)',
  [ZoneType.ResidentialHigh]: 'Residential (High)',
  [ZoneType.CommercialLow]: 'Commercial (Low)',
  [ZoneType.CommercialHigh]: 'Commercial (High)',
  [ZoneType.IndustrialLight]: 'Industrial (Light)',
  [ZoneType.IndustrialHeavy]: 'Industrial (Heavy)',
};

export function TileInfoPanel() {
  const info = useGameStore((s) => s.selectedTileInfo);
  const map = useGameStore((s) => s.map);
  const clearSelection = useGameStore((s) => s.clearSelection);

  if (!info) return null;

  const category = zoneCategory(info.zone);
  const facility = info.facilityId > 0 ? map.facilities.get(info.facilityId) : undefined;
  const facilityDef = facility ? FACILITY_DEFS[facility.type] : undefined;

  return (
    <div className="pointer-events-auto absolute bottom-[calc(3.5rem+8px)] left-2 right-2 sm:left-auto sm:w-80 bg-black/85 backdrop-blur-sm text-white rounded-xl border border-white/10 p-3 text-sm shadow-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="font-semibold">
          Tile ({info.x}, {info.y}) {info.onFire && <span className="text-orange-400">🔥 On fire!</span>}
        </div>
        <button
          onClick={clearSelection}
          className="w-9 h-9 -mt-1 -mr-1 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center text-lg"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-white/80">
        <dt className="text-white/50">Terrain</dt>
        <dd>{info.terrain === 0 ? 'Water' : info.forest ? 'Forest' : 'Land'}</dd>

        {facilityDef ? (
          <>
            <dt className="text-white/50">Building</dt>
            <dd>{facilityDef.label}</dd>

            <dt className="text-white/50">Footprint</dt>
            <dd>
              {facilityDef.size}×{facilityDef.size}
            </dd>

            <dt className="text-white/50">Upkeep</dt>
            <dd>{formatMoney(facilityDef.upkeep)}/mo</dd>

            {facilityDef.radius > 0 && (
              <>
                <dt className="text-white/50">Coverage radius</dt>
                <dd>{facilityDef.radius} tiles</dd>
              </>
            )}
            {facilityDef.powerOutput !== undefined && (
              <>
                <dt className="text-white/50">Power output</dt>
                <dd>{facilityDef.powerOutput}</dd>
              </>
            )}
            {facilityDef.waterOutput !== undefined && (
              <>
                <dt className="text-white/50">Water output</dt>
                <dd>{facilityDef.waterOutput}</dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt className="text-white/50">Zone</dt>
            <dd>{ZONE_LABELS[info.zone]}</dd>
          </>
        )}

        {category !== 'none' && (
          <>
            <dt className="text-white/50">Development</dt>
            <dd>
              Level {info.developmentLevel} {info.abandoned ? '(abandoned)' : ''}
            </dd>

            <dt className="text-white/50">{category === 'residential' ? 'Population' : 'Jobs'}</dt>
            <dd>{category === 'residential' ? info.population : info.jobs}</dd>

            <dt className="text-white/50">Power</dt>
            <dd>{info.powered ? 'Connected' : 'None'}</dd>

            <dt className="text-white/50">Water</dt>
            <dd>{info.watered ? 'Connected' : 'None'}</dd>
          </>
        )}

        <dt className="text-white/50">Land value</dt>
        <dd>{Math.round((info.landValue / 255) * 100)}</dd>

        <dt className="text-white/50">Pollution</dt>
        <dd>{Math.round((info.pollution / 255) * 100)}</dd>

        <dt className="text-white/50">Crime</dt>
        <dd>{Math.round((info.crime / 255) * 100)}</dd>

        <dt className="text-white/50">Fire risk</dt>
        <dd>{Math.round((info.fireRisk / 255) * 100)}</dd>

        {(info.networks & NetworkFlag.Road) !== 0 && (
          <>
            <dt className="text-white/50">Traffic</dt>
            <dd>{Math.round((info.traffic / 255) * 100)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
