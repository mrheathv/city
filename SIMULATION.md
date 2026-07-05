# Simulation design

This document explains the formulas and rules behind MetroSim's simulation —
RCI demand, land value, traffic, utility networks, growth, budget, and
disasters — so they can be tuned later without archaeology through the code.
Every section names the source file that implements it.

Where SimCity Classic's original mechanics were ambiguous or deliberately
simplified, that's called out explicitly as an **Assumption**.

All per-tile "0-255" fields (land value, pollution, crime, fire risk,
traffic) are stored as `Uint8Array` bytes for memory density; the UI
displays them rescaled to 0-100.

## Tile grid (`src/sim/grid.ts`, `src/sim/types.ts`)

The map is a struct-of-arrays: each tile property (terrain, zone, network
flags, population, land value, ...) is its own typed array indexed by
`y * width + x`, rather than an array of per-tile objects. This is a
performance/scalability choice: it keeps memory compact and cache-friendly
so the same code scales from a 32x32 starter map to 128x128+ without a
rewrite — appending tiles to a typed array's row-major layout doesn't change
per-tile access cost.

**Assumption:** zoning is per-tile (one lot per tile), not SimCity Classic's
3x3 zone blocks. This is simpler to simulate and is consistent with how most
modern city builders (e.g. Cities: Skylines) model zoning.

### Terrain generation (`src/sim/noise.ts`, `generateTerrain` in `grid.ts`)

Elevation is 5-octave fractal value noise (`ValueNoise2D.fbm`), seeded with
a `mulberry32` PRNG so a given seed always regenerates the same map. Tiles
below an elevation threshold (`waterLevel`, default 0.22) become water; a
second, independently-seeded noise field carves a meandering "river band"
(`|riverNoise - 0.5| < 0.012`) so water isn't only in blobby lakes. A radial
falloff subtracted from elevation biases coastline/lake formation away from
the exact map center, keeping a buildable core. Forest placement is a third
noise field, thresholded by `forestDensity`.

## Utility networks: power & water (`src/sim/power.ts`, `water.ts`, `utility.ts`)

Power lines and water pipes are separate bitmask flags per tile
(`NetworkFlag.PowerLine`, `NetworkFlag.WaterPipe`), and a tile can carry
road + power + water + rail simultaneously — in practice a player runs all
of them along the same street.

Each tick, `computeUtilityCoverage` (shared by power and water):

1. Flood-fills a conductive graph into connected components via BFS. A tile
   conducts if it's a power line/pipe tile, a source facility's footprint
   (a power plant's tiles conduct too), *or* a tile with its own demand — a
   zoned lot or civic building. That last case is what lets power/water
   propagate building to building without a dedicated line on every tile,
   matching the original game: a powered building relays power to its
   powered neighbors, so you only need to actually run a line to bridge
   gaps of vacant land, not to reach every single lot along a street.
   Connectivity here is purely topological — whether current can physically
   reach a tile — independent of whether capacity actually covers it; a
   shortfall shows up as some tiles in the component going dark during
   allocation (next step), not as a break in the graph itself.
2. For each component containing at least one source, sums that source's
   capacity (`FacilityDef.powerOutput` / `waterOutput`).
3. Allocates that capacity to every demanding tile already in the component
   (any zoned tile demands `POWER_DEMAND_PER_TILE` / `WATER_DEMAND_PER_TILE`,
   4 units each; civic buildings without their own generation demand a
   double share) **in component-discovery order** until exhausted.

**Assumption / known simplification:** allocation order follows BFS
discovery order, not proximity- or fairness-based. Under a capacity
shortfall this means tiles closer to the source (in BFS terms) are favored,
which is a simplification of real brownout behavior. It's cheap and stable;
a fairer scheme (e.g. round-robin, or proportional scaling) would be a
reasonable follow-up if it becomes a noticeable "always the same lights go
out" pattern in a long-running city.

## Land value (`src/sim/landvalue.ts`)

Recomputed for every non-water tile, every tick, from (in order):

- **Base** 80.
- **+ up to 40**, linearly decaying, for the nearest water tile within 4
  tiles (`40 * (1 - dist/4)`).
- **+ up to 22**, linearly decaying, for the nearest road tile within 3
  tiles.
- **+ 8** flat if the tile itself is forested.
- **+ up to 35 / 8 / 6 / 8** for park / police / fire / health / education
  coverage strength (see below), scaled `coverage/255 * weight`.
- **− up to 90** for pollution, **− up to 90** for crime, **− up to 35** for
  fire risk, **− up to 45** for traffic congestion — all `(value/255) *
  weight`.

The result is clamped to 0-255. Because it's fully recomputed every tick
(not just once at placement time), land value responds immediately as
services are built, pollution spreads, or congestion worsens — there's no
stale cached value.

**Assumption:** the specific weights above were chosen by feel (pollution
and crime dominate; forest is a minor bonus) rather than fit to real data;
they're the first place to tune if growth patterns feel wrong.

## Crime, fire risk, pollution (`src/sim/environment.ts`, `src/sim/services.ts`)

**Service coverage** (`computeServiceCoverage`): for each police/fire/
hospital/school/park facility, contributes a linearly-decaying value (255
at the facility's footprint, 0 at its `radius`) to every tile within range,
via `accumulateRadialField` (`src/sim/spatial.ts`). Overlapping coverage
from multiple facilities of the same type stacks (clamped to 255) — this is
deliberate: redundant coverage should be strictly better, modeling backup
capacity.

**Pollution**: spreads from developed industrial tiles (peak
`(heavy ? 140 : 70) * (level/3)`, radius 7 for heavy / 5 for light
industry) and from any facility with a `pollution` value (coal plants: 180
over radius 10; solar: 0).

**Crime**: `density * 14 - policeCoverage * 0.6`, clamped to 0-255, where
`density` is `developmentLevel * 1.4` if population+jobs on the tile exceed
30, else `developmentLevel * 1`. Deliberately **not** a function of land
value — land value is downstream of crime, not an input to it (see the code
comment in `environment.ts`: making crime depend on land value created a
bootstrapping bug where empty, never-developed tiles computed nonsense
crime from the initial all-zero land value array).

**Fire risk**: `density * 10 + (industrial ? 40 : 0) - fireCoverage * 0.6`,
same density definition, clamped to 0-255.

## RCI demand (`src/sim/rci.ts`)

Demand for each of Residential / Commercial / Industrial is a number in
`[-100, 100]`: positive encourages new development/growth, negative
encourages decay/abandonment (applied per-tile in `growth.ts`).

Inputs:
- **`workers`** = 50% of total population (assumed labor force participation).
- **`jobs`** = total commercial + industrial jobs.
- **`jobsPerWorker`** / **`workersPerJob`**: the ratio of jobs to workers (or
  its inverse), **clamped to [0, 2]** — so "balanced" is 1.0, at most double
  or zero. This clamp is important: an early version let these ratios swing
  unbounded, so the instant a single household existed with zero local jobs,
  `jobsPerWorker` computed to 0 and residential demand cratered to roughly
  -60, destroying the very first house before anything else could grow. The
  clamp keeps the labor-market signal directional without letting small-city
  noise cause a death spiral.
- **`landValueFactor`** = `(avgLandValue - 128) / 128`, so -1..1 around a
  neutral midpoint.
- **`cycle`** = `businessCycleMultiplier(simDay)`, a sine wave over a
  6-year period, amplitude ±0.5 — the "slow business cycle" the brief asked
  for. It multiplies into each demand term at various weights.
- **`taxDrag(rate)`** = `-(rate - 9) * 3` — 9% is treated as the neutral
  baseline rate; every point above/below shifts demand by 3.
- **`BOOTSTRAP`** = 15, added to every demand term. Without it, a brand-new
  city (zero population, zero jobs) has no signal to start growing from at
  all — a chicken-and-egg problem, since jobs need residents and residents
  (in this model) are partly attracted by jobs. This constant is the
  "why does anything ever get built" answer; see also **Assumption** below.
- **`commutePenalty`** = `max(0, (avgCommuteDistance - 12) * 1.8)`,
  subtracted from residential demand. `avgCommuteDistance` comes from the
  traffic simulation (see below): a population-weighted average of
  congestion-inflated road distance from home to the nearest job. This is
  the mechanism that makes "commute times too long" suppress residential
  growth, per the brief.

Formulas:
```
residential = BOOTSTRAP + (jobsPerWorker - 1) * 35 + landValueFactor * 20
              + cycle * 40 + taxDrag(residentialRate) - commutePenalty

commercial  = BOOTSTRAP * 0.7 + min(60, population / 8) * supplyFactor
              + landValueFactor * 15 + cycle * 40 + taxDrag(commercialRate)

industrial  = BOOTSTRAP + (workersPerJob - 1) * 35 + cycle * 50
              + taxDrag(industrialRate)
```
where `supplyFactor` (commercial's dependency on industrial output, per the
brief's "industry produces goods that commercial zones sell") is
`min(1, industrialJobs / max(1, population * 0.15))` if any industrial
jobs exist, else a flat 0.6 (a small city can still support some retail
without local manufacturing, e.g. importing goods).

**Assumption:** `BOOTSTRAP` and the tax/cycle weights were tuned by playing
the game and watching whether a city could get off the ground and whether
demand swings felt proportionate — they are not derived from any real
economic model. The labor-market *shape* (jobs vs. workers driving
residential/industrial demand, land value and tax rate as modifiers) is the
part meant to generalize; the exact constants are the tuning surface.

## Growth & abandonment (`src/sim/growth.ts`)

Every zoned tile rolls independently each tick — this is what makes growth
visibly ripple outward from well-served areas rather than jumping uniformly
across the whole map.

A tile is **serviced** if `powered && watered && hasAdjacentRoad` (road
within 4-directional distance 1). If not serviced, a developed tile has a
flat 5%/tick chance to lose a level (abandonment) and no chance to develop
further, regardless of demand.

If serviced:
- **Undeveloped (level 0) → level 1**: chance `(demand / 400) * landValueFactor`,
  where `landValueFactor = 0.5 + 0.5 * (landValue / 255)` — land value
  nudges the odds (0.5x at worst, 1x at best) but never fully gates growth.
- **Developed, growing**: if `demand > 10` and below the zone's max level,
  chance `(demand / 600) * landValueFactor`.
- **Developed, decaying**: if `demand < -10`, chance
  `(-demand / 500) * declineFactor` where `declineFactor = 1.5 -
  landValueFactor` (worse land value decays faster).

Population/jobs per level (`LEVEL_UNITS`): low-density zones cap at level 2,
high-density at level 3 — modeling low-rise vs. high-rise development.

| Zone | Per level | Max level |
|---|---|---|
| Residential Low | 8 | 2 |
| Residential High | 20 | 3 |
| Commercial Low | 6 | 2 |
| Commercial High | 15 | 3 |
| Industrial Light | 8 | 2 |
| Industrial Heavy | 18 | 3 |

**Assumption:** these per-level population/job counts are placeholder
"feels reasonable for a tile-based city" numbers, not derived from real
density figures.

## Traffic (`src/sim/traffic.ts`, `src/sim/heap.ts`)

Rather than tracing a shortest path for every individual commuter (which
would cost roughly `O(residents × road network size)`), traffic runs a
**single multi-source Dijkstra per tick**, seeded from every job-holding
tile's adjacent road entry point simultaneously. Edge weight into a tile is
`1 + currentTraffic[tile] / 40` — so already-congested roads look "farther,"
which is what lets the pathfinder route around jams in the next tick rather
than just measuring them.

After that one search, every road tile knows its distance to the *nearest*
job and the parent pointer to get there. Each residential tile with
population then walks its own entry point's parent chain back to that job,
adding trip load (`population * 0.5 * 0.2`, i.e. roughly half the
population commutes and trips are scaled down so one household doesn't
saturate a road) to every road tile it crosses. Congestion decays 45% each
tick (`traffic *= 0.55`) before new trips are added, so the number reflects
rolling recent load, not lifetime accumulation.

`avgCommuteDistance` — the population-weighted average of each resident's
distance-to-nearest-job — feeds both into `computeRCIDemand`'s
`commutePenalty` and, per-tile, into land value's traffic penalty.

**Assumption:** commuting only uses the road network; rail isn't yet routed
through (it renders and could be extended to carry trips — the multi-source
Dijkstra would just need a second conduit-flag pass — but v1 keeps the
pathfinding to one mode for simplicity). A bus system is an explicit stretch
goal in the brief and isn't implemented.

**Assumption:** a resident with no road-connected job at all is "stranded"
(counted in `strandedPopulation`, excluded from the commute-distance
average) rather than blocking growth outright — this avoids a hard failure
mode where a single disconnected house breaks the whole demand calculation.

## Budget (`src/sim/budget.ts`, `src/sim/bonds.ts`)

Computed daily (one simulated day per tick):

- **Revenue**: `residentialPop * residentialRate / 100`,
  `commercialJobs * commercialRate / 60`, `industrialJobs * industrialRate
  / 80`. The different divisors mean commercial and industrial jobs are
  worth more tax per unit than residential population at the same rate —
  modeling that businesses generally pay more property tax per occupant
  than households.
- **Expenses**: each facility's `upkeep / 30` (upkeep is defined as a
  monthly figure), split into power/water/other-services buckets for the
  budget report, plus `roadTileCount * 0.05` road maintenance.

**Bonds** (`bonds.ts`) are standard fixed-rate amortizing loans: issuing one
adds the principal to funds immediately and computes a monthly payment via
the standard annuity formula
`payment = P * r / (1 - (1 + r)^-n)` (r = monthly rate, n = term in months).
Daily funds deduct `sum(monthlyPayment) / 30` (smoothed, so the treasury
ticker doesn't jump once a month); every 30 sim-days,
`amortizeMonthly` actually splits each payment into interest (on the
current balance) and principal, reducing `remainingBalance` and dropping
bonds once paid off. This is real interest accrual — paying a bond off
early isn't supported in v1, but the balance and payment schedule are
computed properly (not just "borrow now, flat tax later").

## Disasters (`src/sim/disasters.ts`)

Gated by a single `disasters.enabled` toggle (persisted in saves) — flipping
it off both stops new events and clears any tile currently on fire, for a
sandbox mode with no random destruction.

**Fire** is a small cellular automaton, one generation per tick:
1. Tiles that were already marked "on fire" (from the *previous* tick) are
   destroyed (`developmentLevel/population/jobs` reset, `abandoned` set) and
   the fire flag clears. Before clearing, each flammable, non-burning
   4-directional neighbor rolls to catch fire too, at
   `0.32 * (1 - fireCoverage/255 * 0.85)` — fire coverage suppresses spread
   but never fully prevents it.
2. Fresh ignitions roll across every developed tile proportional to its
   `fireRisk`, at `fireRisk/255 * 0.00003 * 255` per tile per day (tuned so
   a modestly-sized, poorly-covered city sees an occasional fire — roughly
   one every couple of in-game months — rather than a constant stream).

A tile that just ignited renders as burning for one tick *before* being
destroyed (so the player sees it) then resolves on the following tick —
this is why the fire state needs its own field on the tile grid rather than
being inferred from other data.

**Earthquake**: `triggerEarthquake(map, cx, cy, radius)` sweeps every tile
within `radius`, with severity `1 - dist/radius`; each tile independently
rolls `severity * 0.8` to have its building destroyed and its infrastructure
(all network flags) knocked out. An unprompted earthquake can strike with
probability `1/3000` per day (roughly once every ~8 in-game years) at a
random location; the player can also trigger one manually from the City
Menu, mirroring the original game's disaster menu.

**Assumption:** flood was not implemented — earthquake was chosen instead
as the natural disaster because it doesn't require converting land tiles to
water (which would orphan roads/zones/pipes sitting on top of them and
needed a bigger rework of the terrain/network relationship than a v1
disaster warranted). Flood is a reasonable follow-up once terrain mutation
at runtime is supported.

## Save format (`src/state/save.ts`)

Every typed array on `CityMap` is base64-encoded (raw bytes, chunked to
avoid call-stack limits on `String.fromCharCode`) into a single JSON blob,
versioned (`SAVE_VERSION`) so future format changes can branch on it. It's
deliberately just a JSON object with no localStorage-specific structure —
`serializeCity`/`deserializeCity` don't know about localStorage at all,
`saveToLocalStorage`/`loadFromLocalStorage` are thin wrappers — so moving
persistence to a backend later is a matter of POSTing/GETing the same blob
instead of reading/writing `localStorage`.
