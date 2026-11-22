'use client';

// Searchable, sortable list of countries. It replaces every "pick a target"
// dropdown: each row already shows the fact that matters for the panel it
// sits in (attitude, strength, intel), so choosing is also reading.

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { Button, Row, Segmented, TextInput } from '../../ui';

import { CountryDot } from './parts';

export type PickerItem = {
  id: string;
  name: string;
  color: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Values the list can be ordered by; numbers sort high→low, text A→Z. */
  sort: Record<string, number | string>;
  /** Tags a filter can match on. */
  tags?: readonly string[];
  /** Rows that are shown for context but cannot be picked (the player). */
  inert?: boolean;
};

export type PickerOption = { id: string; label: string };

/** Lower-cased and stripped of accents, so "peru" finds "Perù". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function CountryPicker({
  items,
  sorts,
  filters,
  selectedId,
  onPick,
  limit,
  label,
  testIdPrefix,
}: {
  items: readonly PickerItem[];
  /** First entry is the default order. Must include every key used. */
  sorts: readonly PickerOption[];
  /** Optional tag filters; the list always offers "all" first. */
  filters?: readonly PickerOption[];
  selectedId?: string | null;
  onPick: (id: string) => void;
  /** Rows shown before "show all"; the full list while searching. */
  limit?: number;
  /** Accessible name of the list. */
  label: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('panelDiplomacy.picker');
  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState(sorts[0]?.id ?? 'name');
  const [filterId, setFilterId] = useState('all');
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    const rows = items.filter(
      (it) =>
        (q === '' || fold(it.name).includes(q)) &&
        (filterId === 'all' || (it.tags ?? []).includes(filterId)),
    );
    return rows.sort((a, b) => {
      const av = a.sort[sortId];
      const bv = b.sort[sortId];
      if (typeof av === 'number' && typeof bv === 'number' && av !== bv) return bv - av;
      if (typeof av === 'string' && typeof bv === 'string' && av !== bv) return av.localeCompare(bv);
      return a.name.localeCompare(b.name);
    });
  }, [items, query, sortId, filterId]);

  const capped = limit !== undefined && !expanded && query.trim() === '';
  const shown = capped ? visible.slice(0, limit) : visible;
  // Keep the current target in view even when it falls below the fold.
  const pinned =
    capped && selectedId && !shown.some((it) => it.id === selectedId)
      ? visible.find((it) => it.id === selectedId)
      : undefined;
  const rows = pinned ? [...shown, pinned] : shown;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="h-9 pl-8 text-[13px]"
          data-testid={`${testIdPrefix}-search`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters && filters.length > 0 ? (
          <Segmented
            size="sm"
            label={t('filterLabel')}
            value={filterId}
            onChange={setFilterId}
            options={[{ value: 'all', label: t('all') }, ...filters.map((f) => ({ value: f.id, label: f.label }))]}
            className="flex-1"
          />
        ) : null}
        {sorts.length > 1 ? (
          <Segmented
            size="sm"
            label={t('sortLabel')}
            value={sortId}
            onChange={setSortId}
            options={sorts.map((s) => ({ value: s.id, label: s.label }))}
            className="flex-1"
          />
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center text-xs text-fg-faint">
          {t('noMatch')}
        </p>
      ) : (
        <ul aria-label={label} className="flex flex-col gap-1">
          {rows.map((it) => (
            <li key={it.id}>
              <Row
                testId={`${testIdPrefix}-${it.id}`}
                leading={<CountryDot color={it.color} />}
                title={it.name}
                subtitle={it.subtitle}
                trailing={it.trailing}
                selected={it.id === selectedId}
                onClick={it.inert ? undefined : () => onPick(it.id)}
                className={it.inert ? 'border-accent/30 bg-accent/[0.06] py-1.5' : 'py-1.5'}
              />
            </li>
          ))}
        </ul>
      )}
      {limit !== undefined && query.trim() === '' && visible.length > limit ? (
        <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? t('showLess') : t('showAll', { n: visible.length })}
        </Button>
      ) : null}
    </div>
  );
}
