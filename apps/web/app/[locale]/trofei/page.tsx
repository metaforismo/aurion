// Trophies / Achievements page. Renders the catalogue of every achievement
// the engine ships with — locked entries display the silhouette / "???"
// fallback already implemented in <AchievementsList />. Unlock state is
// read out of IndexedDB by the component itself (lazy hydration), so this
// page stays a thin layout shell.

'use client';

import { useTranslations } from 'next-intl';

import { AchievementsList } from '../../../components/Achievements';
import { Link } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';

export default function TrofeiPage() {
  const t = useTranslations('trofei');
  const tCommon = useTranslations('common');

  return (
    <main
      className={cn(
        'relative min-h-screen w-full bg-bg',
        'bg-gradient-to-b from-bg via-bg to-surface-1/40',
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            {t('pageTitle')}
          </h1>
          <Link
            href="/"
            className="text-sm text-fg-muted hover:text-fg"
          >
            ← {tCommon('back')}
          </Link>
        </header>

        <AchievementsList />
      </div>
    </main>
  );
}
