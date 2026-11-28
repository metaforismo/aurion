'use client';

// Down on the surface: the colony in 3D. Drag to look around, scroll or
// pinch to go from the whole base down to the people walking through it.

import { ArrowUp, Crosshair, Minus, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  baseSignature,
  buildBaseModel,
  buildCapitalModel,
  type BaseBody,
  type BuildingKind,
} from '../../lib/base/model';
import type { BaseRenderer } from '../../lib/base/base-renderer';
import { compactNumber } from '../../lib/format';
import { useGameStore } from '../../lib/store';
import { IconButton } from '../ui';

/** Building kinds worth counting in the caption, in display order. */
const COUNTED: readonly BuildingKind[] = [
  'housing',
  'dome',
  'habitat',
  'skyscraper',
  'office',
  'apartment',
  'house',
  'factory',
  'lab',
  'barracks',
  'mine',
  'foundry',
  'site',
];

export default function BaseView({ body, onLeave }: { body: BaseBody; onLeave: () => void }) {
  const t = useTranslations('cosmos.base');
  const tColony = useTranslations('cosmos.colony');
  const locale = useLocale();
  const state = useGameStore((s) => s.state);
  const canvasHost = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<BaseRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [glFallback, setGlFallback] = useState(false);
  // The building last tapped, named next to the pointer for a moment.
  const [picked, setPicked] = useState<{ kind: BuildingKind; x: number; y: number } | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);

  const model = useMemo(
    () => (state ? (body === 'earth' ? buildCapitalModel(state) : buildBaseModel(state, body)) : null),
    [state, body],
  );
  const signature = model ? baseSignature(model) : '';
  const modelRef = useRef(model);
  // What the renderer currently shows, so the same city is never built twice.
  const applied = useRef('');
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  // The name fades by itself, so it never lingers over a view that has moved on.
  useEffect(() => {
    if (!picked) return;
    const timer = window.setTimeout(() => setPicked(null), 2800);
    return () => window.clearTimeout(timer);
  }, [picked]);

  // One renderer per mount (and per backend, should WebGPU give up).
  useEffect(() => {
    const host = canvasHost.current;
    const first = modelRef.current;
    if (!host || !first) return;
    applied.current = baseSignature(first);
    let renderer: BaseRenderer | null = null;
    let cancelled = false;
    // A fresh canvas each time: a canvas keeps the first context it was given.
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full touch-none';
    host.appendChild(canvas);
    const observer = new ResizeObserver(() => renderer?.resize());
    (async () => {
      const [{ BaseRenderer: Renderer }, { hasHardwareWebGPU }] = await Promise.all([
        import('../../lib/base/base-renderer'),
        import('../../lib/globe/planet-renderer'),
      ]);
      const forceWebGL = glFallback || !(await hasHardwareWebGPU());
      if (cancelled) return;
      renderer = new Renderer({
        canvas,
        model: first,
        forceWebGL,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
      renderer.onDeviceLost = () => setGlFallback(true);
      try {
        await renderer.init();
      } catch {
        if (!cancelled && !forceWebGL) setGlFallback(true);
        return;
      }
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      // Test hook, next to the store the end-to-end suite already uses.
      const hook = (window as unknown as { __aurion?: Record<string, unknown> }).__aurion;
      if (hook) hook.base = renderer;
      observer.observe(host);
      renderer.start();
      setReady(true);
    })();
    return () => {
      cancelled = true;
      observer.disconnect();
      rendererRef.current = null;
      renderer?.dispose();
      canvas.remove();
      setReady(false);
    };
  }, [glFallback]);

  // The base grew: rebuild it in place, keeping the camera where it is.
  useEffect(() => {
    const current = modelRef.current;
    if (!ready || !current || applied.current === signature) return;
    applied.current = signature;
    rendererRef.current?.setModel(current);
  }, [ready, signature]);

  if (!model) return null;
  const counts = COUNTED.map((kind) => ({ kind, n: model.buildings.filter((b) => b.kind === kind).length })).filter(
    (c) => c.n > 0,
  );

  return (
    <div className="absolute inset-0 bg-black" data-testid={`base-${body}`}>
      <div
        ref={canvasHost}
        className="absolute inset-0"
        role="img"
        aria-label={t(`label.${body}`)}
        onPointerDown={(e) => {
          press.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          // A tap, not the end of a drag: name what is under it.
          const from = press.current;
          press.current = null;
          if (!from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const kind = rendererRef.current?.pickAt(x, y) ?? null;
          setPicked(kind ? { kind, x, y } : null);
        }}
      />
      {picked ? (
        <div
          role="status"
          data-testid="base-picked"
          className="glass-panel pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1 text-xs font-medium text-fg"
          style={{ left: picked.x, top: picked.y - 10 }}
        >
          {t(`name.${picked.kind}`)}
        </div>
      ) : null}

      <div
        className="glass-panel absolute top-[4.25rem] z-10 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pl-2 pr-4 lg:top-[7.25rem]"
        style={{ left: 'var(--stage-center, 50%)' }}
      >
        <button
          type="button"
          onClick={onLeave}
          data-testid="base-leave"
          className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-black transition-colors hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowUp aria-hidden className="h-3.5 w-3.5" />
          {t(body === 'earth' ? 'leaveEarth' : 'leave')}
        </button>
        <p className="numeric-tabular font-mono text-[11px] text-fg-muted">
          {body === 'earth'
            ? t('citizens', { n: compactNumber(model.population, locale) })
            : tColony('people', {
                n: compactNumber(model.population, locale),
                cap: compactNumber(model.capacity, locale),
              })}
        </p>
      </div>

      <div
        className="glass-panel absolute bottom-28 z-10 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl px-4 py-3 lg:bottom-20"
        style={{ left: 'var(--stage-center, 50%)' }}
      >
        <h3 className="text-sm font-semibold text-fg">{t(`label.${body}`)}</h3>
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted" data-testid="base-counts">
          {counts.map(({ kind, n }) => (
            <li key={kind} className="numeric-tabular">
              <span className="font-mono text-fg">{n}</span> {t(`kind.${kind}`, { n })}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] leading-snug text-fg-faint">{ready ? t(body === 'earth' ? 'hintEarth' : 'hint') : t('loading')}</p>
      </div>

      <div className="absolute bottom-28 right-4 z-10 flex flex-col gap-1 lg:bottom-20" data-stage-inset="right">
        <IconButton icon={Plus} label={t('zoomIn')} onClick={() => rendererRef.current?.zoomBy(0.6)} />
        <IconButton icon={Minus} label={t('zoomOut')} onClick={() => rendererRef.current?.zoomBy(1.6)} />
        <IconButton icon={Crosshair} label={t('reset')} onClick={() => rendererRef.current?.resetView()} />
      </div>
    </div>
  );
}
