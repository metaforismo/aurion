'use client';

// "How to play": a reference to skim, not a manual to read. Seven short
// sections, an anchor nav that follows the scroll, and a diagram wherever
// a picture is quicker than a paragraph.

import {
  Atom,
  Coins,
  Compass,
  Eye,
  Globe2,
  Handshake,
  Keyboard,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Microscope,
  Rocket,
  Skull,
  Swords,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { Card, Chip, Glass, Kbd } from '../../ui';
import { Link } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';
import { PageHeading } from '../MenuFrame';
import { MODES } from '../modes';
import { KardashevLadder } from './KardashevLadder';
import { ScreenDiagram } from './ScreenDiagram';

const SECTIONS = [
  { id: 'goal', icon: Target },
  { id: 'modes', icon: Compass },
  { id: 'screen', icon: LayoutDashboard },
  { id: 'systems', icon: Atom },
  { id: 'cosmos', icon: Rocket },
  { id: 'lose', icon: Skull },
  { id: 'keys', icon: Keyboard },
] as const satisfies readonly { id: string; icon: LucideIcon }[];

type SectionId = (typeof SECTIONS)[number]['id'];

/** The eight systems, in dock order — the number is also the hotkey. */
const SYSTEMS: readonly { id: string; icon: LucideIcon }[] = [
  { id: 'economy', icon: Coins },
  { id: 'research', icon: Microscope },
  { id: 'military', icon: Swords },
  { id: 'intel', icon: Eye },
  { id: 'diplomacy', icon: Handshake },
  { id: 'politics', icon: Users },
  { id: 'un', icon: Landmark },
  { id: 'cosmos', icon: Rocket },
];

const PILLARS = ['glance', 'levers', 'long'] as const;
const LOSSES = ['popularity', 'bankruptcy', 'capital', 'factions'] as const;
const COSMOS_RULES = ['cost', 'time', 'sites', 'tech', 'rivals', 'cancel'] as const;
const SHORTCUTS: readonly { id: string; keys: readonly string[] }[] = [
  { id: 'pause', keys: ['space'] },
  { id: 'systems', keys: ['1', '…', '8'] },
  { id: 'rotate', keys: ['←', '↑', '↓', '→'] },
  { id: 'zoom', keys: ['+', '−'] },
  { id: 'escape', keys: ['Esc'] },
];

export function Codex() {
  const t = useTranslations('guide');
  const tModes = useTranslations('modes');
  const active = useActiveSection();

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-6 sm:px-8">
      <PageHeading eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label={t('navLabel')}
          className="sticky top-0 z-20 -mx-4 lg:top-6 lg:mx-0 lg:self-start"
        >
          <ul className="thin-scroll flex gap-1 overflow-x-auto bg-[#010206]/85 px-4 py-2 backdrop-blur lg:flex-col lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {SECTIONS.map(({ id, icon: Icon }, i) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'location' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                    active === id
                      ? 'bg-accent/10 text-fg'
                      : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  )}
                >
                  <span
                    className={cn(
                      'hidden font-mono text-[10px] lg:inline',
                      active === id ? 'text-accent' : 'text-fg-faint',
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Icon
                    aria-hidden
                    className={cn('h-3.5 w-3.5', active === id ? 'text-accent' : 'text-fg-faint')}
                  />
                  <span className="whitespace-nowrap">{t(`nav.${id}`)}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <Section id="goal" title={t('goal.title')}>
            <p className="max-w-3xl text-pretty text-[15px] leading-relaxed text-fg">
              {t('goal.body')}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {PILLARS.map((id) => (
                <Card key={id}>
                  <h3 className="text-sm font-semibold text-fg">{t(`goal.pillar.${id}.title`)}</h3>
                  <p className="mt-1 text-pretty text-xs leading-relaxed text-fg-muted">
                    {t(`goal.pillar.${id}.body`)}
                  </p>
                </Card>
              ))}
            </div>
            <Tip>{t('goal.tip')}</Tip>
          </Section>

          <Section id="modes" title={t('modes.title')} lead={t('modes.lead')}>
            <div className="grid gap-3 md:grid-cols-2">
              {MODES.map((mode) => (
                <Card key={mode.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-accent"
                    >
                      <mode.icon className="h-4 w-4" />
                    </span>
                    <h3 className="flex-1 text-sm font-semibold text-fg">
                      {tModes(`${mode.key}.name`)}
                    </h3>
                    <Chip>{tModes(`${mode.key}.lengthShort`)}</Chip>
                  </div>
                  <p className="text-pretty text-xs leading-relaxed text-fg-muted">
                    {tModes(`${mode.key}.do`)}
                  </p>
                  <dl className="mt-auto grid gap-1.5 border-t border-white/[0.07] pt-2 text-xs leading-relaxed">
                    <div className="flex gap-2">
                      <dt className="w-12 shrink-0 font-medium text-success">{t('modes.win')}</dt>
                      <dd className="text-fg-muted">{tModes(`${mode.key}.win`)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-12 shrink-0 font-medium text-[#ff8a7d]">
                        {t('modes.lose')}
                      </dt>
                      <dd className="text-fg-muted">{tModes(`${mode.key}.lose`)}</dd>
                    </div>
                  </dl>
                </Card>
              ))}
              <Card tone="accent" className="flex flex-col justify-center gap-2">
                <p className="text-pretty text-sm leading-relaxed text-fg">{t('modes.cta')}</p>
                <Link
                  href="/new"
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t('modes.ctaLink')} →
                </Link>
              </Card>
            </div>
          </Section>

          <Section id="screen" title={t('screen.title')} lead={t('screen.lead')}>
            <ScreenDiagram />
          </Section>

          <Section id="systems" title={t('systems.title')} lead={t('systems.lead')}>
            <div className="grid gap-3 md:grid-cols-2">
              {SYSTEMS.map(({ id, icon: Icon }, i) => (
                <Card
                  key={id}
                  tone={id === 'cosmos' ? 'info' : 'neutral'}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]',
                        id === 'cosmos' ? 'text-[#8ad8ff]' : 'text-fg-muted',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="flex-1 text-sm font-semibold text-fg">
                      {t(`systems.${id}.name`)}
                    </h3>
                    <Kbd>{i + 1}</Kbd>
                  </div>
                  <p className="text-pretty text-xs leading-relaxed text-fg-muted">
                    {t(`systems.${id}.what`)}
                  </p>
                  <p className="mt-auto flex gap-2 border-t border-white/[0.07] pt-2 text-pretty text-xs leading-relaxed text-fg">
                    <Lightbulb aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <span>{t(`systems.${id}.tip`)}</span>
                  </p>
                </Card>
              ))}
            </div>
          </Section>

          <Section id="cosmos" title={t('cosmos.title')} lead={t('cosmos.lead')}>
            <KardashevLadder />
            <ul className="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-2">
              {COSMOS_RULES.map((id) => (
                <li key={id} className="flex gap-3">
                  <Globe2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#8ad8ff]" />
                  <p className="text-pretty text-[13px] leading-relaxed text-fg-muted">
                    <span className="font-medium text-fg">{t(`cosmos.rule.${id}.title`)}</span>{' '}
                    {t(`cosmos.rule.${id}.body`)}
                  </p>
                </li>
              ))}
            </ul>
            <Tip>{t('cosmos.tip')}</Tip>
          </Section>

          <Section id="lose" title={t('lose.title')} lead={t('lose.lead')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {LOSSES.map((id) => (
                <Card key={id} tone="danger">
                  <h3 className="text-sm font-semibold text-fg">{t(`lose.${id}.title`)}</h3>
                  <p className="mt-1 text-pretty text-xs leading-relaxed text-fg-muted">
                    {t(`lose.${id}.body`)}
                  </p>
                  <p className="mt-2 text-pretty text-xs leading-relaxed text-fg">
                    <span className="font-medium text-success">{t('lose.avoid')}</span>{' '}
                    {t(`lose.${id}.avoid`)}
                  </p>
                </Card>
              ))}
            </div>
            <p className="mt-3 text-pretty text-xs leading-relaxed text-fg-faint">
              {t('lose.note')}
            </p>
          </Section>

          <Section id="keys" title={t('keys.title')} lead={t('keys.lead')}>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {SHORTCUTS.map(({ id, keys }) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-2"
                >
                  <dt className="text-[13px] text-fg-muted">{t(`keys.${id}`)}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {keys.map((k) =>
                      k === '…' ? (
                        <span key={k} aria-hidden className="text-fg-faint">
                          …
                        </span>
                      ) : (
                        <Kbd key={k}>{k === 'space' ? t('keys.spaceKey') : k}</Kbd>
                      ),
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: SectionId;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <Glass
      id={id}
      role="region"
      aria-labelledby={`${id}-title`}
      className="scroll-mt-16 p-4 sm:p-6 lg:scroll-mt-6"
    >
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-fg">
        {title}
      </h2>
      {lead ? (
        <p className="mb-4 mt-1 max-w-3xl text-pretty text-sm leading-relaxed text-fg-muted">
          {lead}
        </p>
      ) : (
        <div className="h-3" />
      )}
      {children}
    </Glass>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex gap-2.5 rounded-xl border border-accent/30 bg-accent/[0.08] p-3 text-pretty text-[13px] leading-relaxed text-fg">
      <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>{children}</span>
    </p>
  );
}

/** Which section is under the reader's eyes, for the anchor nav. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('goal');
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      // A band across the upper part of the viewport decides the section.
      { rootMargin: '-15% 0px -60% 0px' },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}
