'use client';

// Modal dialog for the menu pages (save browser, confirmations). Local to
// the menus: traps Tab, closes on Escape / backdrop, restores focus.

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { IconButton } from '../ui';
import { cn } from '../../lib/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
  footer,
  className,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    // Lock the page behind the dialog.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      style={{ animation: 'modal-backdrop-enter 160ms ease-out both' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ animation: 'rise-in 220ms cubic-bezier(0, 0, 0.2, 1) both' }}
        className={cn(
          'glass-panel flex max-h-[92dvh] w-full flex-col rounded-t-2xl outline-none sm:max-h-[86dvh] sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-fg-faint">{subtitle}</p> : null}
          </div>
          <IconButton icon={X} label={closeLabel} onClick={onClose} />
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-white/[0.08] px-4 py-3 sm:px-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
