'use client';

// Zoom control cluster for the world map renderers.
//
// Wheel / pinch zoom existed since the first map iteration but had zero
// discoverable or keyboard-accessible surface — the `map.zoom.*` i18n keys
// shipped unused. This cluster gives the same viewBox mutations an explicit
// affordance: zoom in / zoom out / reset view, stacked vertically in the
// top-right corner of the map. The visual language mirrors MapLegend
// (hairline border, bg/85 + blur, mono small caps) so the two rails read as
// one chrome family.
//
// The component is renderer-agnostic: WorldMap and RealWorldMap own their
// own viewBox math and pass plain callbacks + boolean limits down.

import { Minus, Plus, Scan } from 'lucide-react';

import { cn } from '../../lib/cn';

export type MapZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** False when the view is already at maximum magnification. */
  canZoomIn: boolean;
  /** False when the view is already at minimum magnification. */
  canZoomOut: boolean;
  /** Pre-translated labels (map.zoom.* keys). */
  labels: { group: string; in: string; out: string; reset: string };
};

export default function MapZoomControls(props: MapZoomControlsProps) {
  return (
    <div
      role="group"
      aria-label={props.labels.group}
      className={cn(
        'pointer-events-auto absolute right-3 top-3 z-10 flex flex-col',
        'overflow-hidden rounded-sm border border-border bg-bg/85 backdrop-blur-sm',
      )}
    >
      <ZoomButton
        label={props.labels.in}
        disabled={!props.canZoomIn}
        onClick={props.onZoomIn}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
      </ZoomButton>
      <ZoomButton
        label={props.labels.out}
        disabled={!props.canZoomOut}
        onClick={props.onZoomOut}
        className="border-t border-border"
      >
        <Minus aria-hidden className="h-3.5 w-3.5" />
      </ZoomButton>
      <ZoomButton
        label={props.labels.reset}
        onClick={props.onReset}
        className="border-t border-border"
      >
        <Scan aria-hidden className="h-3.5 w-3.5" />
      </ZoomButton>
    </div>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center transition-colors',
        // Inset focus ring: an offset/outline ring would be clipped by the
        // cluster's overflow-hidden rounding.
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
        disabled
          ? 'cursor-not-allowed text-fg-faint/50'
          : 'text-fg-muted hover:bg-surface-1 hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}
