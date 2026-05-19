// Generic confirmation dialog. Reads the pending request from the store and
// renders title / description / two buttons. Translation keys come from the
// caller via the `confirm()` store action.

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';

import { Modal } from './Modal';

export function ConfirmModal() {
  const request = useGameStore((s) => s.pendingConfirm);
  const cancelConfirm = useGameStore((s) => s.cancelConfirm);
  // Two namespaces: one for the (optional) labels supplied by caller and
  // `common` for the confirm/cancel button defaults. We read the active
  // translator with no namespace so callers can pass full dotted keys like
  // `modals.confirm.exitGame.title`.
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  if (!request) return null;

  const titleKey = request.titleKey;
  const descriptionKey = request.descriptionKey;
  const confirmKey = request.confirmKey ?? 'common.confirm';
  const cancelKey = request.cancelKey ?? 'common.cancel';
  const tone = request.tone ?? 'primary';

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.resolve(request.onConfirm());
    } finally {
      setBusy(false);
      cancelConfirm();
    }
  };

  const handleCancel = () => {
    if (busy) return;
    cancelConfirm();
  };

  return (
    <Modal
      title={t(titleKey)}
      onClose={handleCancel}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="rounded-sm border border-border bg-transparent px-4 py-2 text-xs font-semibold text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            {t(cancelKey)}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={cn(
              'rounded-sm border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50',
              tone === 'danger'
                ? 'border-border bg-transparent text-danger hover:border-danger'
                : 'border-accent bg-accent text-bg hover:border-accent-strong hover:bg-accent-strong',
            )}
          >
            {t(confirmKey)}
          </button>
        </>
      }
    >
      <p className="leading-relaxed text-fg">{t(descriptionKey)}</p>
    </Modal>
  );
}

export default ConfirmModal;
