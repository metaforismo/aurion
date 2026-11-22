'use client';

// "Load game": every save on this device, with enough detail to tell them
// apart, and the housekeeping (rename, export, delete, import) in one place.

import { ArrowRight, Check, Download, FolderOpen, Pencil, Trash2, Upload, X } from 'lucide-react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button, Card, Chip, EmptyState, IconButton, Segmented, Stat, TextInput } from '../../ui';
import { useSfx } from '../../Audio';
import { useScenarioMessages } from '../../Panels/shared/useScenarioMessages';
import { Link } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';
import { money, percent } from '../../../lib/format';
import { deleteSave, renameSave, type SaveSummary } from '../../../lib/persistence';
import { getScenarioMeta, type ScenarioId } from '../../../lib/scenarios';
import { Dialog } from '../Dialog';
import { modeMeta } from '../modes';
import { downloadSave, gameDate, useSaveDigest, type SaveDigest } from '../saves';

type SortKey = 'recent' | 'name' | 'world';

export function SaveBrowser({
  saves,
  onClose,
  onChanged,
  onImport,
  importError,
}: {
  saves: SaveSummary[];
  onClose: () => void;
  /** Re-read the list after a rename or delete. */
  onChanged: () => Promise<void>;
  /** Opens the file picker owned by the title screen. */
  onImport: () => void;
  importError: string | null;
}) {
  const t = useTranslations('home.saves');
  const tCommon = useTranslations('common');
  const tAll = useTranslations();
  const locale = useLocale();
  const sfx = useSfx();

  const [sort, setSort] = useState<SortKey>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(saves[0]?.id ?? null);

  const worldName = (scenarioId: string) => {
    const meta = getScenarioMeta(scenarioId);
    return meta && tAll.has(meta.nameKey) ? tAll(meta.nameKey) : scenarioId;
  };

  const sorted = useMemo(() => {
    const rows = [...saves];
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, locale));
    else if (sort === 'world')
      rows.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId) || b.savedAt - a.savedAt);
    else rows.sort((a, b) => b.savedAt - a.savedAt);
    return rows;
  }, [saves, sort, locale]);

  // Falls back to the first row when the selected save was just deleted.
  const selected = sorted.find((s) => s.id === selectedId) ?? sorted[0] ?? null;

  return (
    <Dialog
      title={t('title')}
      subtitle={t('subtitle', { count: saves.length })}
      closeLabel={tCommon('close')}
      onClose={onClose}
      className="sm:max-w-4xl"
      testId="save-browser"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<SortKey>
          label={t('sortLabel')}
          size="sm"
          value={sort}
          onChange={(v) => {
            sfx('sfx.tab');
            setSort(v);
          }}
          options={[
            { value: 'recent', label: t('sort.recent') },
            { value: 'name', label: t('sort.name') },
            { value: 'world', label: t('sort.world') },
          ]}
        />
        <Button size="sm" icon={Upload} onClick={onImport} title={t('importHint')}>
          {t('import')}
        </Button>
      </div>

      {importError ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-[#ff5d4d]/35 bg-[#ff5d4d]/[0.08] px-3 py-2 text-xs text-[#ffb0a6]"
        >
          {importError}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState icon={FolderOpen} title={t('empty.title')} className="mt-4">
          {t('empty.body')}
        </EmptyState>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <ul className="flex flex-col gap-1.5" aria-label={t('listLabel')}>
            {sorted.map((save) => {
              const active = save.id === selected?.id;
              return (
                <li key={save.id}>
                  <SaveListRow
                    save={save}
                    world={worldName(save.scenarioId)}
                    active={active}
                    onSelect={() => setSelectedId(save.id)}
                  />
                  {/* On narrow screens the details open inside the list. */}
                  {active ? (
                    <div className="mt-1.5 lg:hidden">
                      <SaveDetails
                        key={save.id}
                        save={save}
                        world={worldName(save.scenarioId)}
                        onChanged={onChanged}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {selected ? (
            <div className="hidden lg:block">
              <div className="sticky top-0">
                <SaveDetails
                  key={selected.id}
                  save={selected}
                  world={worldName(selected.scenarioId)}
                  onChanged={onChanged}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}

function SaveListRow({
  save,
  world,
  active,
  onSelect,
}: {
  save: SaveSummary;
  world: string;
  active: boolean;
  onSelect: () => void;
}) {
  const format = useFormatter();
  const now = useNow();
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={`save-row-${save.id}`}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-accent/50 bg-accent/10'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <span
        aria-hidden
        className="h-9 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: save.thumbnailColor }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{save.name}</span>
        <span className="block truncate text-[11px] text-fg-faint">{world}</span>
      </span>
      <span className="shrink-0 font-mono text-[11px] text-fg-faint">
        {format.relativeTime(new Date(save.savedAt), now)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Details + actions for one save
// ---------------------------------------------------------------------------

function SaveDetails({
  save,
  world,
  onChanged,
}: {
  save: SaveSummary;
  world: string;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations('home.saves');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const sfx = useSfx();
  const digest = useSaveDigest(save);

  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');
  const [name, setName] = useState(save.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch {
      sfx('sfx.error');
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const submitRename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === save.name) {
      setMode('view');
      return;
    }
    void run(async () => {
      await renameSave(save.id, trimmed);
      sfx('sfx.confirm');
      await onChanged();
      setMode('view');
    }, t('renameFailed'));
  };

  const confirmDelete = () =>
    void run(async () => {
      await deleteSave(save.id);
      sfx('sfx.confirm');
      await onChanged();
    }, t('deleteFailed'));

  return (
    <Card className="flex flex-col gap-4 p-4" data-testid="save-details">
      <div className="flex items-start gap-2">
        {mode === 'rename' ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <TextInput
              autoFocus
              value={name}
              maxLength={80}
              disabled={busy}
              aria-label={t('renameLabel')}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setMode('view');
                }
              }}
            />
            <IconButton icon={Check} label={tCommon('save')} type="submit" disabled={busy} />
            <IconButton
              icon={X}
              label={tCommon('cancel')}
              disabled={busy}
              onClick={() => setMode('view')}
            />
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-fg">{save.name}</h3>
              <p className="truncate text-xs text-fg-faint">
                {t('savedAt', {
                  date: format.dateTime(new Date(save.savedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </p>
            </div>
            <IconButton
              icon={Pencil}
              label={t('rename')}
              onClick={() => {
                setName(save.name);
                setMode('rename');
              }}
            />
          </>
        )}
      </div>

      <SaveFacts save={save} world={world} digest={digest} />

      {error ? (
        <p role="alert" className="text-xs text-[#ffb0a6]">
          {error}
        </p>
      ) : null}

      {mode === 'delete' ? (
        <Card
          tone="danger"
          role="alertdialog"
          aria-label={t('deleteTitle')}
          className="flex flex-col gap-3"
        >
          <div>
            <p className="text-sm font-medium text-fg">{t('deleteTitle')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
              {t('deleteBody', { name: save.name })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              loading={busy}
              onClick={confirmDelete}
              data-testid="save-delete-confirm"
            >
              {t('deleteConfirm')}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode('view')}>
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/play/${encodeURIComponent(save.id)}`}
            data-autofocus
            data-testid="save-load"
            className={cn(
              'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-black transition-colors',
              'shadow-[0_6px_20px_-8px_rgba(232,180,90,0.7)] hover:bg-accent-strong',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
          >
            {digest && digest.outcome !== 'playing' ? t('review') : t('load')}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Button
            icon={Download}
            title={t('exportHint')}
            disabled={busy}
            onClick={() => void run(() => downloadSave(save), t('exportFailed'))}
          >
            {t('export')}
          </Button>
          <Button
            variant="ghost"
            icon={Trash2}
            className="ml-auto"
            onClick={() => setMode('delete')}
          >
            {tCommon('delete')}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** The facts grid, shared with nothing else but kept apart for legibility. */
function SaveFacts({
  save,
  world,
  digest,
}: {
  save: SaveSummary;
  world: string;
  digest: SaveDigest | null | undefined;
}) {
  const t = useTranslations('home.saves');
  const tMenu = useTranslations('menu');
  const tModes = useTranslations('modes');
  const tAll = useTranslations();
  const locale = useLocale();
  const { t: tScenario } = useScenarioMessages(save.scenarioId as ScenarioId);

  if (digest === undefined) {
    return (
      <div aria-busy="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg bg-white/[0.05] motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (digest === null) {
    return <p className="text-xs leading-relaxed text-fg-muted">{t('unreadable')}</p>;
  }

  const date = gameDate(digest.tick);
  const difficultyKey = `difficulty.${digest.difficultyId}.name`;
  const kardashev =
    digest.kardashev === null
      ? null
      : new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(digest.kardashev);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-fg">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: digest.nationColor }}
          />
          {tScenario(digest.nationKey)}
        </span>
        <span className="text-xs text-fg-faint">
          · {world} · {tMenu('gameDate', date)}
        </span>
        {digest.outcome === 'won' ? <Chip tone="success">{tMenu('outcome.won')}</Chip> : null}
        {digest.outcome === 'lost' ? <Chip tone="danger">{tMenu('outcome.lost')}</Chip> : null}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Stat
          size="sm"
          label={t('fact.mode')}
          value={tModes(`${modeMeta(digest.gameMode).key}.name`)}
        />
        <Stat
          size="sm"
          label={t('fact.difficulty')}
          value={tAll.has(difficultyKey) ? tAll(difficultyKey) : digest.difficultyId}
          tone={digest.difficultyId === 'ironMan' ? 'danger' : 'neutral'}
        />
        <Stat
          size="sm"
          label={t('fact.treasury')}
          value={money(digest.treasury, locale)}
          tone={digest.treasury < 0 ? 'danger' : 'neutral'}
        />
        <Stat
          size="sm"
          label={t('fact.economy')}
          value={money(digest.gdp, locale)}
          hint={t('fact.rank', { rank: digest.gdpRank, total: digest.nations })}
        />
        <Stat
          size="sm"
          label={t('fact.popularity')}
          value={percent(digest.popularity / 100, locale)}
        />
        {kardashev ? (
          <Stat
            size="sm"
            tone="info"
            label={t('fact.kardashev')}
            value={kardashev}
            hint={t('fact.projects', { count: digest.projectsDone ?? 0 })}
          />
        ) : null}
        {digest.victories !== null ? (
          <Stat size="sm" label={t('fact.milestones')} value={digest.victories} />
        ) : null}
      </div>
    </div>
  );
}
