// HUD menu — gear icon dropdown with Save / Load / Export JSON / Import JSON
// / Exit. Save/load route through the store; export/import delegate to
// `lib/persistence`. Exit is gated by a confirm modal so the player doesn't
// accidentally lose their session.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { useRouter } from '../../i18n/navigation';
import { cn } from '../../lib/cn';
import {
  exportSave,
  importSave,
  isPersistenceAvailable,
  listSaves,
  SaveLockedError,
  type SaveSummary,
} from '../../lib/persistence';
import { selectIronMan, useGameStore } from '../../lib/store';

export type MenuButtonProps = {
  /** Toast emitter so menu actions can surface feedback in the play page. */
  onNotify?: (message: string) => void;
};

export function MenuButton({ onNotify }: MenuButtonProps) {
  const t = useTranslations('hud');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tIronMan = useTranslations('hud.ironMan');
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [saves, setSaves] = useState<SaveSummary[] | null>(null);

  const saveId = useGameStore((s) => s.saveId);
  const persistedSave = useGameStore((s) => s.saveGame);
  const requestConfirm = useGameStore((s) => s.confirm);
  const reset = useGameStore((s) => s.reset);
  const loadGame = useGameStore((s) => s.loadGame);
  const ironMan = useGameStore(selectIronMan);
  const winLoss = useGameStore((s) => s.state?.winLoss ?? 'playing');

  // Iron Man permadeath rules: while the run is in `playing`, the player
  // cannot save / load / export / import — only `Esci` stays enabled (with
  // an extra warning in the confirm modal). Once the game resolves to `won`
  // / `lost`, we unlock save + export so the final state can be preserved.
  const ironManLocked = ironMan && winLoss === 'playing';

  // Close on outside click. Capturing click + tab.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
        setShowSaves(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close with ESC.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowSaves(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Lazy-load save list when the user expands the "Load" submenu.
  useEffect(() => {
    if (!showSaves || saves !== null) return;
    void listSaves()
      .then((entries) => setSaves(entries))
      .catch(() => setSaves([]));
  }, [showSaves, saves]);

  const closeMenu = () => {
    setOpen(false);
    setShowSaves(false);
  };

  const handleSave = async () => {
    closeMenu();
    try {
      await persistedSave();
      onNotify?.(t('toast.saveOk'));
    } catch (err) {
      if (err instanceof SaveLockedError) {
        onNotify?.(tErrors('saveLocked'));
        return;
      }
      onNotify?.(err instanceof Error ? err.message : 'error');
    }
  };

  const handleExport = async () => {
    closeMenu();
    if (!saveId) return;
    try {
      const blob = await exportSave(saveId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${saveId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotify?.(t('toast.exportOk'));
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'error');
    }
  };

  const handleImportPick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    closeMenu();
    try {
      const entry = await importSave(file);
      onNotify?.(t('toast.importOk'));
      router.replace(`/play/${encodeURIComponent(entry.id)}`);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'error');
    }
  };

  const handleLoad = async (id: string) => {
    closeMenu();
    try {
      await loadGame(id);
      router.replace(`/play/${encodeURIComponent(id)}`);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'error');
    }
  };

  const handleExit = () => {
    closeMenu();
    // Iron Man uses a stronger warning copy: there is no autosave to fall
    // back on, so leaving the page actively abandons the run forever.
    const descriptionKey = ironManLocked
      ? 'hud.ironMan.exitWarning'
      : 'modals.confirm.exitGame.description';
    requestConfirm({
      titleKey: 'modals.confirm.exitGame.title',
      descriptionKey,
      confirmKey: 'modals.confirm.exitGame.confirm',
      cancelKey: 'common.cancel',
      tone: 'danger',
      onConfirm: () => {
        reset();
        router.push('/');
      },
    });
  };

  const persistenceOk = isPersistenceAvailable();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu')}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-sm transition-colors',
          open ? 'text-accent' : 'text-fg-muted hover:text-accent',
        )}
      >
        <GearIcon />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t('menu')}
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-lg border border-border-strong bg-surface-1/95 text-sm shadow-2xl backdrop-blur"
        >
          {ironManLocked ? (
            <div
              role="note"
              className="border-b border-danger/30 bg-danger/10 px-3 py-2 text-[11px] leading-snug text-danger"
            >
              {tIronMan('menuHint')}
            </div>
          ) : null}
          <MenuItem
            label={t('save')}
            onSelect={handleSave}
            disabled={!persistenceOk || ironManLocked}
            disabledHint={ironManLocked ? tIronMan('menuDisabled') : undefined}
          />
          <MenuItem
            label={t('load')}
            onSelect={() => setShowSaves((v) => !v)}
            disabled={!persistenceOk || ironManLocked}
            disabledHint={ironManLocked ? tIronMan('menuDisabled') : undefined}
            expanded={ironManLocked ? undefined : showSaves}
          />
          {showSaves && !ironManLocked ? (
            <ul
              className="max-h-56 overflow-y-auto border-t border-border bg-bg/40 px-1 py-1"
              aria-label={t('savesList')}
            >
              {saves === null ? (
                <li className="px-3 py-2 text-xs text-fg-faint">
                  {tCommon('loading')}
                </li>
              ) : saves.length === 0 ? (
                <li className="px-3 py-2 text-xs text-fg-faint">
                  {t('noSaves')}
                </li>
              ) : (
                saves.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleLoad(s.id)}
                      className={cn(
                        'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition hover:bg-surface-2/70',
                        s.id === saveId && 'bg-accent/10',
                      )}
                    >
                      <span className="truncate text-xs font-semibold text-fg">
                        {s.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-fg-faint">
                        {new Date(s.savedAt).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
          <MenuItem
            label={t('export')}
            onSelect={handleExport}
            disabled={!saveId || ironManLocked}
            disabledHint={ironManLocked ? tIronMan('menuDisabled') : undefined}
          />
          <MenuItem
            label={t('import')}
            onSelect={handleImportPick}
            disabled={!persistenceOk || ironManLocked}
            disabledHint={ironManLocked ? tIronMan('menuDisabled') : undefined}
          />
          <div className="border-t border-border" />
          <MenuItem label={t('exit')} onSelect={handleExit} tone="danger" />
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportChange}
      />
    </div>
  );
}

function MenuItem({
  label,
  onSelect,
  disabled,
  disabledHint,
  tone = 'default',
  expanded,
}: {
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Tooltip shown when the item is disabled (typed in by the caller). */
  disabledHint?: string;
  tone?: 'default' | 'danger';
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabled ? disabledHint : undefined}
      aria-expanded={typeof expanded === 'boolean' ? expanded : undefined}
      className={cn(
        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold transition',
        tone === 'danger'
          ? 'text-danger hover:bg-danger/10'
          : 'text-fg-muted hover:bg-surface-2/70',
        disabled && 'cursor-not-allowed text-fg-faint hover:bg-transparent',
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {disabled && disabledHint ? (
          <span className="text-[10px] font-normal normal-case tracking-normal text-fg-faint">
            {disabledHint}
          </span>
        ) : null}
      </span>
      {typeof expanded === 'boolean' ? (
        <span aria-hidden="true" className="text-fg-faint">
          {expanded ? '▾' : '▸'}
        </span>
      ) : null}
    </button>
  );
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.34 1.804a1 1 0 0 1 1.32 0l1.027.91a1 1 0 0 0 .82.245l1.36-.214a1 1 0 0 1 1.143.66l.46 1.293a1 1 0 0 0 .576.578l1.293.46a1 1 0 0 1 .66 1.143l-.214 1.36a1 1 0 0 0 .245.82l.91 1.026a1 1 0 0 1 0 1.32l-.91 1.026a1 1 0 0 0-.245.82l.214 1.36a1 1 0 0 1-.66 1.143l-1.293.46a1 1 0 0 0-.578.576l-.46 1.293a1 1 0 0 1-1.143.66l-1.36-.214a1 1 0 0 0-.82.245l-1.026.91a1 1 0 0 1-1.32 0l-1.026-.91a1 1 0 0 0-.82-.245l-1.36.214a1 1 0 0 1-1.143-.66l-.46-1.293a1 1 0 0 0-.578-.576l-1.293-.46a1 1 0 0 1-.66-1.143l.214-1.36a1 1 0 0 0-.245-.82l-.91-1.026a1 1 0 0 1 0-1.32l.91-1.026a1 1 0 0 0 .245-.82l-.214-1.36a1 1 0 0 1 .66-1.143l1.293-.46a1 1 0 0 0 .578-.578l.46-1.293a1 1 0 0 1 1.143-.66l1.36.214a1 1 0 0 0 .82-.245l1.026-.91Zm.66 11.696a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default MenuButton;
