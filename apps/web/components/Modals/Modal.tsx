// Aurion modal primitive: WAI-ARIA dialog with overlay, focus trap, ESC and
// click-outside dismissal. Used by EventModal, ConfirmModal and WinLossModal.
//
// Intentionally framework-light — we don't depend on any portal library; we
// render directly into the React tree at the position where ModalRoot mounts.

'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { cn } from '../../lib/cn';

export type ModalProps = {
  /** Visible heading. Wrapped in an h2; consumer may pass any node. */
  title: ReactNode;
  /**
   * Body content. The container provides padding; consumers should focus on
   * layout, not chrome.
   */
  children: ReactNode;
  /** Optional footer (typically buttons). Pinned to the bottom of the card. */
  footer?: ReactNode;
  /**
   * Called when the modal requests dismissal (ESC key, backdrop click, or
   * the consumer-provided close action). Ignored when `dismissable` is false.
   */
  onClose?: () => void;
  /**
   * When false the modal blocks dismissal: ESC and backdrop clicks are
   * ignored. Use for events that the player MUST resolve (narrative events,
   * win/loss screen). Default true.
   */
  dismissable?: boolean;
  /** Maximum width breakpoint. Default 'md' = ~520px. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className applied to the card container. */
  className?: string;
  /**
   * Optional id for the title element so consumers can wire `aria-labelledby`
   * to a custom heading. When omitted we generate one.
   */
  titleId?: string;
  /** Optional id for the description element used as `aria-describedby`. */
  descriptionId?: string;
};

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * A focus-trapping dialog. Only one Modal should be visible at a time; the
 * caller (typically `ModalRoot`) is responsible for that constraint.
 */
export function Modal({
  title,
  children,
  footer,
  onClose,
  dismissable = true,
  size = 'md',
  className,
  titleId: titleIdProp,
  descriptionId,
}: ModalProps) {
  const reactTitleId = useId();
  const titleId = titleIdProp ?? reactTitleId;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (!dismissable) return;
    onClose?.();
  }, [dismissable, onClose]);

  // ESC handler. Bound to the window so it works regardless of focus.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!dismissable) {
          // Eat the keystroke so it doesn't propagate to e.g. global shortcuts.
          e.preventDefault();
          return;
        }
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dismissable, onClose]);

  // Focus trap: remember the previously-focused element on mount, focus the
  // first focusable inside the card, and restore focus on unmount.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    if (card) {
      const target = getFirstFocusable(card) ?? card;
      // The card itself is always focusable via tabIndex={-1}.
      target.focus();
    }
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Tab trap inside the dialog so focus can't escape behind the backdrop.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const card = cardRef.current;
    if (!card) return;
    const focusables = getFocusable(card);
    if (focusables.length === 0) {
      e.preventDefault();
      card.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !card.contains(active)) {
        e.preventDefault();
        last?.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    // Only dismiss when the click landed on the backdrop itself, not when it
    // bubbled up from the card or its children.
    if (e.target !== e.currentTarget) return;
    handleClose();
  };

  const sizeClass = useMemo(() => SIZE_CLASS[size], [size]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={onBackdropClick}
      role="presentation"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex w-full flex-col rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl outline-none',
          sizeClass,
          className,
        )}
      >
        <header className="flex items-start gap-4 border-b border-slate-800 px-6 py-4">
          <h2 id={titleId} className="flex-1 text-lg font-semibold text-slate-100">
            {title}
          </h2>
          {dismissable ? (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-transparent p-1 text-slate-400 transition hover:border-slate-700 hover:text-slate-100"
              aria-label="close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 0 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z" />
              </svg>
            </button>
          ) : null}
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-200">
          {children}
        </div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
}

function getFirstFocusable(root: HTMLElement): HTMLElement | null {
  const items = getFocusable(root);
  return items[0] ?? null;
}

export default Modal;
