'use client';

// The title-screen menu: a short vertical list where every row says where
// it leads. Rows are real links/buttons; arrow keys walk the list.

import { ChevronRight, Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Link } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';

export type MenuItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  /** Small figure on the right (save count, trophy progress). */
  aside?: ReactNode;
  busy?: boolean;
} & ({ href: string; onSelect?: undefined } | { href?: undefined; onSelect: () => void });

const ROW = cn(
  'group relative flex w-full items-center gap-3.5 rounded-xl px-3 py-2 text-left transition-colors',
  'hover:bg-white/[0.06] focus-visible:bg-white/[0.06]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'disabled:cursor-progress',
);

export function MainMenu({ items, label }: { items: readonly MenuItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="-mx-3 flex flex-col gap-0.5">
        {items.map((item, index) => {
          const body = <RowBody item={item} />;
          // Staggered entrance; the global reduced-motion rule flattens it.
          const style = {
            animation: `rise-in 420ms ${120 + index * 55}ms cubic-bezier(0, 0, 0.2, 1) both`,
          };
          return (
            <li key={item.id} style={style}>
              {item.href !== undefined ? (
                <Link
                  href={item.href}
                  data-menu-item
                  data-testid={`menu-${item.id}`}
                  aria-label={item.label}
                  aria-describedby={`menu-hint-${item.id}`}
                  className={ROW}
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  data-menu-item
                  data-testid={`menu-${item.id}`}
                  aria-label={item.label}
                  aria-describedby={`menu-hint-${item.id}`}
                  aria-busy={item.busy || undefined}
                  disabled={item.busy}
                  onClick={item.onSelect}
                  className={ROW}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function RowBody({ item }: { item: MenuItem }) {
  const Icon = item.busy ? Loader2 : item.icon;
  return (
    <>
      {/* Gold rule that grows in on hover/focus: the "cursor" of the menu. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-2 left-0 w-0.5 origin-center scale-y-0 rounded-full bg-accent transition-transform duration-200',
          'group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-fg-muted transition-colors',
          'group-hover:border-accent/40 group-hover:text-accent group-focus-visible:border-accent/40 group-focus-visible:text-accent',
        )}
      >
        <Icon className={cn('h-4 w-4', item.busy && 'animate-spin')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-fg">{item.label}</span>
        <span id={`menu-hint-${item.id}`} className="block truncate text-xs text-fg-faint [@media(max-height:800px)]:hidden">
          {item.hint}
        </span>
      </span>
      {item.aside ? (
        <span className="shrink-0 font-mono text-[11px] text-fg-muted numeric-tabular">
          {item.aside}
        </span>
      ) : null}
      <ChevronRight
        aria-hidden
        className={cn(
          'h-4 w-4 shrink-0 text-fg-faint transition-transform',
          'group-hover:translate-x-0.5 group-hover:text-fg-muted motion-reduce:transform-none',
        )}
      />
    </>
  );
}

/**
 * Arrow-key navigation across every `[data-menu-item]` inside `root`.
 * Returns true when the key was handled.
 */
export function moveMenuFocus(root: HTMLElement, key: string): boolean {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return false;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-menu-item]')).filter(
    (el) => !el.hasAttribute('disabled'),
  );
  if (items.length === 0) return false;
  const current = items.indexOf(document.activeElement as HTMLElement);
  let next: number;
  if (key === 'Home') next = 0;
  else if (key === 'End') next = items.length - 1;
  else if (current < 0) next = key === 'ArrowDown' ? 0 : items.length - 1;
  else next = (current + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
  return true;
}
