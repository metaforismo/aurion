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

  // Scenario bundles are authored flat ("country.aurion.name": "…"), but
  // next-intl treats "." as the nesting separator and rejects keys that
  // contain it. Expand every flat key into the nested tree so lookups like
  // `t('country.aurion.name')` resolve and validation stays clean.
  const messages = structuredClone(uiMessages.default) as MessageTree;
  for (const bundle of scenarioBundles) {
    for (const [flatKey, value] of Object.entries(bundle)) {
      setNested(messages, flatKey.split('.'), value);
    }
  }

  return {
    locale,
    messages,
  };
});

type MessageTree = { [key: string]: string | MessageTree };

/**
 * Write `value` at `path` inside `tree`, creating intermediate objects.
 * Existing leaves are never overwritten by a branch (and vice versa) — the
 * UI bundle wins on conflict so a scenario file cannot clobber core copy.
 */
function setNested(tree: MessageTree, path: string[], value: string): void {
  let node = tree;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i]!;
    const child = node[segment];
    if (child === undefined) {
      const created: MessageTree = {};
      node[segment] = created;
      node = created;
    } else if (typeof child === 'object') {
      node = child;
    } else {
      return;
    }
  }
  const leaf = path[path.length - 1]!;
  if (node[leaf] === undefined) node[leaf] = value;
}
