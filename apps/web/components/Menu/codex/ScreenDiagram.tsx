'use client';

// A schematic of the play screen: where each part sits and what it's for.
// Drawn with plain boxes so it stays crisp at any size and in any language.

import { useTranslations } from 'next-intl';

import { cn } from '../../../lib/cn';

const PARTS = ['hud', 'dock', 'stage', 'briefing', 'views', 'card'] as const;
type Part = (typeof PARTS)[number];

/** Number badge matching a region of the diagram to its legend entry. */
function Badge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        'grid h-5 w-5 place-items-center rounded-full bg-accent font-mono text-[10px] font-bold text-black',
        className,
      )}
    >
      {n}
    </span>
  );
}

const BOX = 'absolute rounded-md border border-white/20 bg-white/[0.06]';

export function ScreenDiagram() {
  const t = useTranslations('guide.screen');
  const number = (part: Part) => PARTS.indexOf(part) + 1;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div
        role="img"
        aria-label={t('diagramLabel')}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_60%,#12324f_0%,#06101d_55%,#010206_100%)]"
      >
        {/* the planet */}
        <span className="absolute left-1/2 top-[58%] aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#3b7fb0_0%,#173a5c_45%,#07182b_100%)] shadow-[0_0_60px_-10px_#5cc8ff66]" />
        <Badge n={number('stage')} className="absolute left-1/2 top-[56%] -translate-x-1/2" />

        <span className={cn(BOX, 'inset-x-[3%] top-[4%] h-[9%]')}>
          <Badge n={number('hud')} className="absolute left-2 top-1/2 -translate-y-1/2" />
        </span>
        <span className={cn(BOX, 'bottom-[16%] left-[3%] top-[17%] w-[7%]')}>
          <Badge n={number('dock')} className="absolute left-1/2 top-2 -translate-x-1/2" />
        </span>
        <span className={cn(BOX, 'bottom-[16%] right-[3%] top-[17%] w-[21%]')}>
          <Badge n={number('briefing')} className="absolute right-2 top-2" />
        </span>
        <span
          className={cn(BOX, 'bottom-[4%] left-1/2 h-[8%] w-[26%] -translate-x-1/2 rounded-full')}
        >
          <Badge n={number('views')} className="absolute left-2 top-1/2 -translate-y-1/2" />
        </span>
        <span className={cn(BOX, 'bottom-[16%] left-[13%] h-[20%] w-[22%]')}>
          <Badge n={number('card')} className="absolute left-2 top-2" />
        </span>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {PARTS.map((part) => (
          <li key={part} className="flex gap-3">
            <Badge n={number(part)} className="mt-0.5 shrink-0" />
            <p className="text-pretty text-[13px] leading-relaxed text-fg-muted">
              <span className="font-medium text-fg">{t(`${part}.name`)}</span> {t(`${part}.body`)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
