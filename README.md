# MetroSim

A browser-based city-building game inspired by SimCity Classic (1989), with a
more realistic economic/traffic/land-value simulation and a mobile-first,
touch-friendly UI. Single-page app, no backend, no install step.

See [SIMULATION.md](./SIMULATION.md) for the formulas and rules behind the
RCI demand, land value, and traffic models.

## Stack

- React + TypeScript, rendered with HTML5 Canvas
- Zustand for state
- Tailwind CSS for UI chrome
- Vite

## Development

```sh
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npx vitest run   # run unit tests
```

## Project layout

- `src/sim/` — pure simulation logic (grid, terrain, zoning tools, power/water
  networks, RCI demand, growth, land value, budget). No rendering or React
  imports; unit-tested independently of the UI.
- `src/render/` — canvas rendering: camera/viewport math and the tileset
  (currently a procedural placeholder pixel-art renderer, swappable for a
  sprite-sheet-backed implementation later without touching simulation code).
- `src/state/` — Zustand store wiring simulation + camera + UI state together.
- `src/components/` — React UI: canvas host, top status bar, mobile bottom
  toolbar, tile info panel.
