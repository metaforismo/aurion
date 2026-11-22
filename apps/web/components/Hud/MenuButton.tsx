// HUD menu — gear icon dropdown with Save / Load / Export JSON / Import JSON
// / Exit. Save/load route through the store; export/import delegate to
// `lib/persistence`. Exit is gated by a confirm modal so the player doesn't
// accidentally lose their session.

'use client';

import {
  BookOpen,
  ChevronLeft,
  Download,
  FolderOpen,
  LogOut,
  Menu,
  Play,
  Save,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
import { useTicker } from '../../lib/ticker';
import { IconButton, Kbd } from '../ui';

export type MenuButtonProps = {
  /** Toast emitter so menu actions can surface feedback in the play page. */
  onNotify?: (message: string) => void;
};

export function MenuButton({ onNotify }: MenuButtonProps) {
  const t = useTranslations('hud');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tIronMan = useTranslations('hud.ironMan');
  const tMenu = useTranslations('pauseMenu');
  const locale = useLocale();
  const ticker = useTicker();
  const saveName = useGameStore((s) => s.saveName);
  // Speed to restore when the menu closes: opening it pauses the game.
  const resumeSpeed = useRef<number | null>(null);
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
    if (!showSaves || saves !== null) return;
    void listSaves()
      .then((entries) => setSaves(entries))
      .catch(() => setSaves([]));
  }, [showSaves, saves]);

  const openMenu = () => {
    resumeSpeed.current = ticker.speed;
    if (ticker.speed !== 0) ticker.setSpeed(0);
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    setShowSaves(false);
    const speed = resumeSpeed.current;
    resumeSpeed.current = null;
    if (speed === 1 || speed === 2 || speed === 4) ticker.setSpeed(speed);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // closeMenu only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lazy-load save list when the user expands the "Load" submenu.
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
  // Single hint resolver so every storage-gated item explains WHY it's
  // locked: Iron Man rules first (more specific), then missing IndexedDB.
  const storageDisabledHint = ironManLocked
    ? tIronMan('menuDisabled')
    : !persistenceOk
      ? t('persistenceUnavailable')
      : undefined;

  return (
    <div ref={containerRef}>
      <IconButton icon={Menu} label={t('menu')} onClick={openMenu} aria-haspopup="menu" aria-expanded={open} />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void handleImportChange(e)}
      />

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--color-bg) 62%, transparent)',
            backdropFilter: 'blur(3px)',
            animation: 'modal-backdrop-enter 180ms cubic-bezier(0, 0, 0.2, 1) both',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeMenu();
          }}
          role="presentation"
        >
          <div
            role="menu"
            aria-label={t('menu')}
            className="glass-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl"
            style={{ animation: 'rise-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
          >
            <header className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-fg">{tMenu('title')}</h2>
              {saveName ? <p className="mt-0.5 truncate text-xs text-fg-faint">{tMenu('savedAs', { name: saveName })}</p> : null}
            </header>

            <div className="thin-scroll flex flex-col gap-1 overflow-y-auto p-2">
              {showSaves ? (
                <>
                  <MenuItem icon={ChevronLeft} onClick={() => setShowSaves(false)}>
                    {tMenu('loadBack')}
                  </MenuItem>
                  <div role="group" aria-label={t('savesList')} className="flex flex-col gap-1">
                    {saves === null ? (
                      <p className="px-3 py-2 text-xs text-fg-faint">{tCommon('loading')}</p>
                    ) : saves.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-fg-faint">{t('noSaves')}</p>
                    ) : (
                      saves.map((s) => (
                        <MenuItem key={s.id} icon={FolderOpen} onClick={() => void handleLoad(s.id)}>
                          <span className="truncate">{s.name}</span>
                        </MenuItem>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <MenuItem icon={Play} onClick={closeMenu} primary autoFocus>
                    {tMenu('resume')}
                  </MenuItem>
                  <MenuItem
                    icon={Save}
                    onClick={() => void handleSave()}
                    disabled={ironManLocked || !persistenceOk}
                    hint={storageDisabledHint}
                  >
                    {t('save')}
                  </MenuItem>
                  <MenuItem
                    icon={FolderOpen}
                    onClick={() => setShowSaves(true)}
                    disabled={!persistenceOk}
                    hint={!persistenceOk ? t('persistenceUnavailable') : undefined}
                  >
                    {t('load')}
                  </MenuItem>
                  <MenuItem
                    icon={Download}
                    onClick={() => void handleExport()}
                    disabled={ironManLocked || !persistenceOk}
                    hint={storageDisabledHint}
                  >
                    {t('export')}
                  </MenuItem>
                  <MenuItem icon={Upload} onClick={handleImportPick}>
                    {t('import')}
                  </MenuItem>
                  <a
                    role="menuitem"
                    href={`/${locale}/guida`}
                    target="_blank"
                    rel="noreferrer"
                    className={ITEM_CLASS}
                  >
                    <BookOpen aria-hidden className="h-4 w-4 text-fg-faint" />
                    <span className="flex-1">{tMenu('guide')}</span>
                    <span className="text-[10px] text-fg-faint">{tMenu('guideHint')}</span>
                  </a>

                  <section aria-label={tMenu('shortcuts')} className="mx-1 my-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-faint">{tMenu('shortcuts')}</h3>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
                      <dt><Kbd>{tMenu('space')}</Kbd></dt>
                      <dd>{tMenu('keys.pause')}</dd>
                      <dt><Kbd>1</Kbd>–<Kbd>8</Kbd></dt>
                      <dd>{tMenu('keys.panels')}</dd>
                      <dt><Kbd>{tMenu('arrows')}</Kbd></dt>
                      <dd>{tMenu('keys.map')}</dd>
                      <dt><Kbd>+</Kbd> <Kbd>−</Kbd></dt>
                      <dd>{tMenu('keys.zoom')}</dd>
                      <dt><Kbd>1</Kbd>–<Kbd>3</Kbd></dt>
                      <dd>{tMenu('keys.choice')}</dd>
                      <dt><Kbd>Esc</Kbd></dt>
                      <dd>{tMenu('keys.deselect')}</dd>
                    </dl>
                  </section>

                  <MenuItem icon={LogOut} onClick={handleExit} danger>
                    {t('exit')}
                  </MenuItem>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const ITEM_CLASS =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:bg-transparent';

function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  hint,
  primary,
  danger,
  autoFocus,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Why the item is disabled — shown inline, not only as a tooltip. */
  hint?: string;
  primary?: boolean;
  danger?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      autoFocus={autoFocus}
      className={cn(
        ITEM_CLASS,
        primary && 'bg-accent font-semibold text-black hover:bg-accent-strong',
        danger && 'text-[#ff8a7d] hover:bg-[#ff5d4d]/15',
      )}
    >
      <Icon aria-hidden className={cn('h-4 w-4 shrink-0', primary ? 'text-black' : danger ? 'text-[#ff8a7d]' : 'text-fg-faint')} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">{children}</span>
        {disabled && hint ? <span className="text-[11px] font-normal text-fg-faint">{hint}</span> : null}
      </span>
    </button>
  );
}

export default MenuButton;
