// Trophies: cross-game achievements, read from IndexedDB by <TrophyCase>.

'use client';

import { useTranslations } from 'next-intl';

import { TrophyCase } from '../../../components/Achievements';
import { MenuFrame, MenuTopBar, PageHeading } from '../../../components/Menu/MenuFrame';

export default function TrofeiPage() {
  const t = useTranslations('trofei');
  return (
    <MenuFrame planet={{ body: 'mars', lon: -70, lat: 5, distance: 2.4, offsetX: 0.34 }}>
      <MenuTopBar />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-6 sm:px-8">
        <PageHeading eyebrow={t('eyebrow')} title={t('pageTitle')} lead={t('lead')} />
        <div className="mt-6">
          <TrophyCase />
        </div>
      </main>
    </MenuFrame>
  );
}
