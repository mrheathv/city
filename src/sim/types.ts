// Core enums and shared types for the simulation. Kept as small integer-friendly
// enums so the tile grid can be stored as typed arrays (struct-of-arrays) for
// performance at large map sizes.

export const Terrain = {
  Water: 0,
  Land: 1,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export const ZoneType = {
  None: 0,
  ResidentialLow: 1,
  ResidentialHigh: 2,
  CommercialLow: 3,
  CommercialHigh: 4,
  IndustrialLight: 5,
  IndustrialHeavy: 6,
} as const;
export type ZoneType = (typeof ZoneType)[keyof typeof ZoneType];

export const RESIDENTIAL_ZONES: ZoneType[] = [ZoneType.ResidentialLow, ZoneType.ResidentialHigh];
export const COMMERCIAL_ZONES: ZoneType[] = [ZoneType.CommercialLow, ZoneType.CommercialHigh];
export const INDUSTRIAL_ZONES: ZoneType[] = [ZoneType.IndustrialLight, ZoneType.IndustrialHeavy];

export function zoneCategory(z: ZoneType): 'residential' | 'commercial' | 'industrial' | 'none' {
  if (RESIDENTIAL_ZONES.includes(z)) return 'residential';
  if (COMMERCIAL_ZONES.includes(z)) return 'commercial';
  if (INDUSTRIAL_ZONES.includes(z)) return 'industrial';
  return 'none';
}

/** Bitmask flags for infrastructure networks that can overlay a tile. */
export const NetworkFlag = {
  Road: 1 << 0,
  Rail: 1 << 1,
  PowerLine: 1 << 2,
  WaterPipe: 1 << 3,
} as const;

export const FacilityType = {
  PowerPlantCoal: 'power_coal',
  PowerPlantSolar: 'power_solar',
  WaterPump: 'water_pump',
  WaterTower: 'water_tower',
  PoliceStation: 'police',
  FireStation: 'fire',
  Hospital: 'hospital',
  School: 'school',
  Park: 'park',
} as const;
export type FacilityType = (typeof FacilityType)[keyof typeof FacilityType];

export interface FacilityDef {
  type: FacilityType;
  label: string;
  size: number; // footprint is size x size
  cost: number;
  upkeep: number; // per month
  radius: number; // coverage radius in tiles (0 = no coverage, e.g. power plant uses grid not radius)
  powerOutput?: number; // MW-equivalent, for power plants
  powerDemand?: number; // consumed by the facility itself
  waterOutput?: number;
  waterDemand?: number;
  pollution?: number; // pollution generated per tick at the facility tile
}

export interface Facility {
  id: number;
  type: FacilityType;
  x: number; // top-left origin
  y: number;
}

export interface TileInfo {
  x: number;
  y: number;
  terrain: Terrain;
  elevation: number; // 0-255
  forest: boolean;
  zone: ZoneType;
  networks: number; // NetworkFlag bitmask
  powered: boolean;
  watered: boolean;
  landValue: number; // 0-255
  pollution: number; // 0-255
  crime: number; // 0-255
  fireRisk: number; // 0-255
  traffic: number; // 0-255 congestion level on road tiles
  population: number;
  jobs: number;
  developmentLevel: number; // 0-3, 0 = undeveloped zoned lot
  onFire: boolean;
  abandoned: boolean;
  facilityId: number; // 0 = none, else references Facility.id (+1 offset)
}

export type ToolId =
  | 'select'
  | 'bulldoze'
  | 'road'
  | 'rail'
  | 'powerline'
  | 'waterpipe'
  | 'zone_res_low'
  | 'zone_res_high'
  | 'zone_com_low'
  | 'zone_com_high'
  | 'zone_ind_light'
  | 'zone_ind_heavy'
  | FacilityTool;

export type FacilityTool =
  | 'facility_power_coal'
  | 'facility_power_solar'
  | 'facility_water_pump'
  | 'facility_water_tower'
  | 'facility_police'
  | 'facility_fire'
  | 'facility_hospital'
  | 'facility_school'
  | 'facility_park';
