import { CityMap } from './grid';
import { FACILITY_DEFS } from './facilities';
import { FacilityType, NetworkFlag, Terrain, ZoneType, type ToolId } from './types';

export interface ToolResult {
  changed: boolean;
  cost: number;
  reason?: string;
}

const NETWORK_COST: Record<string, number> = {
  road: 10,
  rail: 25,
  powerline: 5,
  waterpipe: 5,
};

const ZONE_COST = 5;

const FACILITY_TOOL_TYPE: Record<string, FacilityType> = {
  facility_power_coal: FacilityType.PowerPlantCoal,
  facility_power_solar: FacilityType.PowerPlantSolar,
  facility_water_pump: FacilityType.WaterPump,
  facility_water_tower: FacilityType.WaterTower,
  facility_police: FacilityType.PoliceStation,
  facility_fire: FacilityType.FireStation,
  facility_hospital: FacilityType.Hospital,
  facility_school: FacilityType.School,
  facility_park: FacilityType.Park,
};

function clearTile(map: CityMap, x: number, y: number) {
  const i = map.idx(x, y);
  map.zone[i] = ZoneType.None;
  map.networks[i] = 0;
  map.developmentLevel[i] = 0;
  map.population[i] = 0;
  map.jobs[i] = 0;
  map.abandoned[i] = 0;
  map.powered[i] = 0;
  map.watered[i] = 0;
}

function removeFacilityAt(map: CityMap, x: number, y: number): number {
  const i = map.idx(x, y);
  const fid = map.facilityId[i];
  if (fid === 0) return 0;
  const facility = map.facilities.get(fid);
  if (!facility) return 0;
  const def = FACILITY_DEFS[facility.type];
  let refund = 0;
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      const fx = facility.x + dx;
      const fy = facility.y + dy;
      if (!map.inBounds(fx, fy)) continue;
      const fi = map.idx(fx, fy);
      if (map.facilityId[fi] === fid) {
        map.facilityId[fi] = 0;
        clearTile(map, fx, fy);
      }
    }
  }
  map.removeFacility(fid);
  return refund;
}

export function facilityDefForTool(tool: ToolId) {
  const type = FACILITY_TOOL_TYPE[tool];
  return type ? FACILITY_DEFS[type] : undefined;
}

export function canPlaceFootprint(map: CityMap, x: number, y: number, size: number): boolean {
  if (x < 0 || y < 0 || x + size > map.width || y + size > map.height) return false;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const i = map.idx(x + dx, y + dy);
      if (map.terrain[i] === Terrain.Water) return false;
      if (map.facilityId[i] !== 0) return false;
      // Require the footprint to be empty land — otherwise a facility would
      // silently bulldoze any zoned tile (developed or not) or infrastructure
      // underneath it with no warning and no refund.
      if (map.zone[i] !== ZoneType.None) return false;
      if (map.networks[i] !== 0) return false;
    }
  }
  return true;
}

export function applyTool(map: CityMap, tool: ToolId, x: number, y: number, funds: number): ToolResult {
  if (!map.inBounds(x, y)) return { changed: false, cost: 0 };
  const i = map.idx(x, y);

  if (tool === 'select') return { changed: false, cost: 0 };

  if (tool === 'bulldoze') {
    if (map.facilityId[i] !== 0) {
      removeFacilityAt(map, x, y);
      return { changed: true, cost: 0 };
    }
    if (map.zone[i] === ZoneType.None && map.networks[i] === 0) {
      return { changed: false, cost: 0 };
    }
    clearTile(map, x, y);
    return { changed: true, cost: 0 };
  }

  if (tool === 'road' || tool === 'rail' || tool === 'powerline' || tool === 'waterpipe') {
    if (map.terrain[i] === Terrain.Water) return { changed: false, cost: 0, reason: 'water' };
    if (map.facilityId[i] !== 0) return { changed: false, cost: 0, reason: 'occupied' };
    const flag =
      tool === 'road'
        ? NetworkFlag.Road
        : tool === 'rail'
          ? NetworkFlag.Rail
          : tool === 'powerline'
            ? NetworkFlag.PowerLine
            : NetworkFlag.WaterPipe;
    if (map.networks[i] & flag) return { changed: false, cost: 0 };
    const cost = NETWORK_COST[tool];
    if (funds < cost) return { changed: false, cost: 0, reason: 'funds' };
    map.networks[i] |= flag;
    return { changed: true, cost };
  }

  if (tool.startsWith('zone_')) {
    if (map.terrain[i] === Terrain.Water) return { changed: false, cost: 0, reason: 'water' };
    if (map.facilityId[i] !== 0) return { changed: false, cost: 0, reason: 'occupied' };
    const zoneMap: Record<string, ZoneType> = {
      zone_res_low: ZoneType.ResidentialLow,
      zone_res_high: ZoneType.ResidentialHigh,
      zone_com_low: ZoneType.CommercialLow,
      zone_com_high: ZoneType.CommercialHigh,
      zone_ind_light: ZoneType.IndustrialLight,
      zone_ind_heavy: ZoneType.IndustrialHeavy,
    };
    const z = zoneMap[tool];
    if (z === undefined) return { changed: false, cost: 0 };
    if (map.zone[i] === z) return { changed: false, cost: 0 };
    if (funds < ZONE_COST) return { changed: false, cost: 0, reason: 'funds' };
    map.zone[i] = z;
    map.developmentLevel[i] = 0;
    map.abandoned[i] = 0;
    return { changed: true, cost: ZONE_COST };
  }

  const facilityType = FACILITY_TOOL_TYPE[tool];
  if (facilityType) {
    const def = FACILITY_DEFS[facilityType];
    if (!canPlaceFootprint(map, x, y, def.size)) return { changed: false, cost: 0, reason: 'blocked' };
    if (funds < def.cost) return { changed: false, cost: 0, reason: 'funds' };
    const facility = map.addFacility(facilityType, x, y);
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        const fx = x + dx;
        const fy = y + dy;
        clearTile(map, fx, fy);
        map.facilityId[map.idx(fx, fy)] = facility.id;
      }
    }
    return { changed: true, cost: def.cost };
  }

  return { changed: false, cost: 0 };
}
