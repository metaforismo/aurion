'use client';

// React host for the Three.js planet renderer. Owns the canvas, the
// renderer lifecycle and a DOM overlay of markers ("live map" pills and
// dots) that are positioned imperatively every frame — no React re-render
// while the camera moves.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '../../lib/cn';
import type { PlanetBody, PlanetRenderer } from '../../lib/globe/planet-renderer';

export type PlanetMarker = {
  id: string;
  lon: number;
  lat: number;
  /** Higher wins when labels collide. */
  priority: number;
  /** Rendered inside the positioned wrapper (anchored at its centre-left). */
  node: ReactNode;
  /** Approximate label width in px, used for collision culling. 0 = dot only. */
  width: number;
  /** Dots never get culled by collisions. */
  kind: 'dot' | 'label';
};

export type PlanetViewHandle = {
  flyTo: (lon: number, lat: number, distance?: number) => void;
  zoomBy: (factor: number) => void;
  nudge: (dLon: number, dLat: number) => void;
  setSun: (lon: number, lat?: number) => void;
  setSunSpeed: (degPerSecond: number) => void;
  drawOverlay: (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => void;
  getView: () => { lon: number; lat: number; distance: number } | null;
};

export type PlanetViewProps = {
  body: PlanetBody;
  className?: string;
  markers?: readonly PlanetMarker[];
  initialLon?: number;
  initialLat?: number;
  initialDistance?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  offsetX?: number;
  /** Skip WebGPU and use the WebGL2 backend. */
  forceWebGL?: boolean;
  /** Degrees of solar longitude per second. */
  sunSpeed?: number;
  ariaLabel?: string;
  onPick?: (lon: number, lat: number) => void;
  onHover?: (coords: { lon: number; lat: number } | null, x: number, y: number) => void;
  onZoom?: (distance: number) => void;
  /** Fired once the renderer is live (overlay can be drawn from here on). */
  onReady?: (backend: 'webgpu' | 'webgl2') => void;
};

const LABEL_H = 30;

const PlanetView = forwardRef<PlanetViewHandle, PlanetViewProps>(function PlanetView(
  {
    body,
    className,
    markers = [],
    initialLon,
    initialLat,
    initialDistance,
    autoRotate,
    interactive = true,
    offsetX,
    forceWebGL,
    sunSpeed,
    ariaLabel,
    onPick,
    onHover,
    onZoom,
    onReady,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PlanetRenderer | null>(null);
  const markerEls = useRef(new Map<string, HTMLDivElement>());
  const markersRef = useRef(markers);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);
  // Flipped when the WebGPU device is lost: the effect re-runs on WebGL2.
  const [glFallback, setGlFallback] = useState(false);

  // Latest callbacks without re-creating the renderer.
  const cb = useRef({ onPick, onHover, onZoom, onReady });
  useEffect(() => {
    cb.current = { onPick, onHover, onZoom, onReady };
  });
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lon, lat, distance) => rendererRef.current?.flyTo(lon, lat, distance),
      zoomBy: (factor) => rendererRef.current?.zoomBy(factor),
      nudge: (dLon, dLat) => rendererRef.current?.nudge(dLon, dLat),
      setSun: (lon, lat) => rendererRef.current?.setSun(lon, lat),
      setSunSpeed: (v) => {
        if (rendererRef.current) rendererRef.current.sunSpeed = v;
      },
      drawOverlay: (draw) => rendererRef.current?.drawOverlay(draw),
      getView: () => rendererRef.current?.getView() ?? null,
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas per renderer: a canvas whose GPU device was destroyed
    // (React re-mounts effects in development) cannot be configured again.
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full touch-none';
    canvas.setAttribute('role', 'img');
    if (ariaLabel) canvas.setAttribute('aria-label', ariaLabel);
    host.appendChild(canvas);
    let cancelled = false;
    let renderer: PlanetRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let frameCount = 0;

    const layoutMarkers = () => {
      if (!renderer) return;
      frameCount += 1;
      const list = markersRef.current;
      // Collision culling is the expensive part — refresh it every 4th frame.
      const recull = frameCount % 4 === 0;
      const placed: { x: number; y: number; w: number }[] = [];
      const sorted = recull ? [...list].sort((a, b) => b.priority - a.priority) : list;
      for (const m of sorted) {
        const el = markerEls.current.get(m.id);
        if (!el) continue;
        const p = renderer.project(m.lon, m.lat, 1.004);
        if (!p.visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        if (!recull) continue;
        let show = true;
        if (m.kind === 'label' && m.width > 0) {
          for (const o of placed) {
            if (
              p.x < o.x + o.w + 6 &&
              p.x + m.width + 6 > o.x &&
              Math.abs(p.y - o.y) < LABEL_H
            ) {
              show = false;
              break;
            }
          }
          if (show) placed.push({ x: p.x, y: p.y, w: m.width });
        }
        el.style.opacity = show ? '1' : '0';
        el.style.pointerEvents = show ? 'auto' : 'none';
      }
    };

    void (async () => {
      try {
        const { PlanetRenderer: Renderer, hasHardwareWebGPU } = await import(
          '../../lib/globe/planet-renderer'
        );
        const useWebGL = forceWebGL === true || glFallback || !(await hasHardwareWebGPU());
        if (cancelled) return;
        const reducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        renderer = new Renderer({
          canvas,
          body,
          lon: initialLon,
          lat: initialLat,
          distance: initialDistance,
          autoRotate,
          interactive,
          reducedMotion,
          offsetX,
          forceWebGL: useWebGL,
        });
        renderer.onDeviceLost = (message) => {
          console.warn('[globe] GPU device lost, switching to WebGL2:', message);
          setGlFallback(true);
        };
        if (sunSpeed !== undefined) renderer.sunSpeed = sunSpeed;
        renderer.onPick = (lon, lat) => cb.current.onPick?.(lon, lat);
        renderer.onHover = (c, x, y) => cb.current.onHover?.(c, x, y);
        renderer.onZoom = (d) => cb.current.onZoom?.(d);
        renderer.onFrame = layoutMarkers;
        rendererRef.current = renderer;
        await renderer.start();
        if (cancelled) return;
        observer = new ResizeObserver(() => renderer?.resize());
        observer.observe(canvas);
        setLive(true);
        cb.current.onReady?.(renderer.backend);
      } catch (err) {
        console.warn('[globe] renderer failed to start', err);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      renderer?.dispose();
      rendererRef.current = null;
      canvas.remove();
      setLive(false);
    };
    // The renderer is created once per body; camera/sun props are initial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, glFallback]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-[#010206]', className)}>
      <div
        ref={hostRef}
        className={cn(
          'absolute inset-0 transition-opacity duration-700',
          interactive && 'cursor-grab active:cursor-grabbing',
          live ? 'opacity-100' : 'opacity-0',
        )}
      />
      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,#12233f_0%,#020409_60%)]" />
      ) : null}
      <div className="pointer-events-none absolute inset-0">
        {markers.map((m) => (
          <div
            key={m.id}
            ref={(el) => {
              if (el) markerEls.current.set(m.id, el);
              else markerEls.current.delete(m.id);
            }}
            className="absolute left-0 top-0 opacity-0 transition-opacity duration-200 will-change-transform"
            style={{ zIndex: m.kind === 'label' ? 2 : 1 }}
          >
            {m.node}
          </div>
        ))}
      </div>
    </div>
  );
});

export default PlanetView;
