// next-intl per-request configuration. Resolves the matched locale segment to
// a validated locale and loads the messages bundle for it. Falls back to the
// default locale for unknown requests (e.g. Next.js's catch-all routes).
//
// Scenario content (country names, capitals, tech names, narrative events) is
// authored alongside each scenario in `content/scenarios/<id>.{locale}.json`.
// We merge those bundles into the global next-intl messages so any component
// can call `useTranslations()(key)` regardless of whether the key originated
// from the UI bundle or from a scenario data file.

import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

const SCENARIO_IDS = [
  'ascesa-aurion',
  'quick-start',
  'mondo-contemporaneo',
  'guerra-fredda',
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const uiMessages = (await import(`../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };

  // Each scenario's i18n bundle is loaded best-effort: a scenario whose JSON
  // is still in scaffolding (missing IT/EN file on disk) is skipped silently
  // so the rest of the app keeps rendering instead of crashing the request.
  const scenarioBundles = await Promise.all(
    SCENARIO_IDS.map(async (id) => {
      try {
        const mod = (await import(
          `../content/scenarios/${id}.${locale}.json`
        )) as { default: Record<string, string> };
        return mod.default;
      } catch {
        return {} as Record<string, string>;
      }
    }),
  );

  const messages: Record<string, unknown> = { ...uiMessages.default };
  for (const bundle of scenarioBundles) {
    Object.assign(messages, bundle);
  }

  return {
    locale,
    messages,
  };
});
