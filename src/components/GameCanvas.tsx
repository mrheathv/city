import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/store';
import { renderFrame } from '../render/renderer';
import { PlaceholderTileset } from '../render/tileset';
import { clampCameraToMap, screenToWorld, worldToTile, zoomAt, type Camera } from '../render/camera';

const TICK_INTERVAL_MS: Record<number, number> = { 1: 1000, 2: 400, 3: 150 };
const TAP_MOVE_THRESHOLD = 8;
const TAP_MAX_DURATION = 450;

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const tilesetRef = useRef(new PlaceholderTileset());

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ prevDist: number; prevMid: { x: number; y: number } } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const lastPaintedRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const lastSinglePointerRef = useRef<{ x: number; y: number } | null>(null);

  const lastTickRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const loop = (time: number) => {
      const { w, h, dpr } = sizeRef.current;
      const state = useGameStore.getState();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderFrame(ctx, state.map, tilesetRef.current, state.camera, w, h, {
        showGrid: state.camera.zoom > 0.6,
        hoverTile: hoverRef.current,
        selectedTile: state.selectedTile,
        underground: state.undergroundView,
      });

      if (!state.paused) {
        const interval = TICK_INTERVAL_MS[state.speed] ?? 1000;
        if (time - lastTickRef.current > interval) {
          lastTickRef.current = time;
          state.tick();
        }
      } else {
        lastTickRef.current = time;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useGameStore.getState();
      const { w, h } = sizeRef.current;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextCam = zoomAt(state.camera, w, h, sx, sy, state.camera.zoom * factor);
      state.setCamera(clampCameraToMap(nextCam, state.map.width, state.map.height));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  function tileAtScreen(sx: number, sy: number) {
    const state = useGameStore.getState();
    const { w, h } = sizeRef.current;
    const world = screenToWorld(state.camera, w, h, sx, sy);
    return worldToTile(world.x, world.y);
  }

  function relativePos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePaint(sx: number, sy: number) {
    const tile = tileAtScreen(sx, sy);
    const last = lastPaintedRef.current;
    if (last && last.x === tile.x && last.y === tile.y) return;
    lastPaintedRef.current = tile;
    useGameStore.getState().paintTile(tile.x, tile.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture can fail for synthetic/edge-case events; harmless to skip.
    }
    const pos = relativePos(e);
    pointersRef.current.set(e.pointerId, pos);

    if (pointersRef.current.size === 1) {
      dragStartRef.current = { x: pos.x, y: pos.y, t: performance.now(), moved: false };
      lastPaintedRef.current = null;
      lastSinglePointerRef.current = pos;
      const tool = useGameStore.getState().tool;
      if (tool !== 'select') {
        handlePaint(pos.x, pos.y);
      }
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      gestureRef.current = {
        prevDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        prevMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const pos = relativePos(e);
    if (e.pointerType === 'mouse' && pointersRef.current.size === 0) {
      hoverRef.current = tileAtScreen(pos.x, pos.y);
    }
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, pos);

    const state = useGameStore.getState();
    const { w, h } = sizeRef.current;

    if (pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const gesture = gestureRef.current;
      if (gesture) {
        const zoomFactor = gesture.prevDist > 0 ? dist / gesture.prevDist : 1;
        let cam: Camera = zoomAt(state.camera, w, h, mid.x, mid.y, state.camera.zoom * zoomFactor);
        cam = { ...cam, x: cam.x - (mid.x - gesture.prevMid.x) / cam.zoom, y: cam.y - (mid.y - gesture.prevMid.y) / cam.zoom };
        state.setCamera(clampCameraToMap(cam, state.map.width, state.map.height));
      }
      gestureRef.current = { prevDist: dist, prevMid: mid };
      return;
    }

    if (pointersRef.current.size === 1) {
      const start = dragStartRef.current;
      if (start) {
        const dx = pos.x - start.x;
        const dy = pos.y - start.y;
        if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) start.moved = true;
      }

      if (state.tool === 'select') {
        const prev = lastSinglePointerRef.current;
        if (prev) {
          const dx = pos.x - prev.x;
          const dy = pos.y - prev.y;
          const cam = {
            ...state.camera,
            x: state.camera.x - dx / state.camera.zoom,
            y: state.camera.y - dy / state.camera.zoom,
          };
          state.setCamera(clampCameraToMap(cam, state.map.width, state.map.height));
        }
      } else {
        handlePaint(pos.x, pos.y);
      }
      lastSinglePointerRef.current = pos;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const pos = relativePos(e);
    const wasSingle = pointersRef.current.size === 1;
    pointersRef.current.delete(e.pointerId);
    lastSinglePointerRef.current = null;
    if (pointersRef.current.size < 2) gestureRef.current = null;

    const start = dragStartRef.current;
    if (wasSingle && start) {
      const duration = performance.now() - start.t;
      const state = useGameStore.getState();
      if (!start.moved && duration < TAP_MAX_DURATION && state.tool === 'select') {
        const tile = tileAtScreen(pos.x, pos.y);
        state.selectTile(tile.x, tile.y);
      }
    }
    dragStartRef.current = null;
  }

  return (
    <div ref={containerRef} className="absolute inset-0 touch-none select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          hoverRef.current = null;
        }}
      />
    </div>
  );
}
