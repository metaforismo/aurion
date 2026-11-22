// Hook that lazily loads scenario-scoped messages (country names, tech labels,
// capital names) for the current locale. Returns a getter that falls back to
// the raw key when the bundle hasn't loaded yet — this keeps the UI usable
// during the loading window instead of flashing empty strings.

'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { isAppLocale } from '../../../i18n/routing';
import {
  loadScenarioMessages,
  type ScenarioId,
} from '../../../lib/scenarios';

export type ScenarioStringGetter = (key: string | undefined | null) => string;

const EMPTY_BUNDLE: Record<string, string> = Object.freeze({});

export function useScenarioMessages(scenarioId: ScenarioId | null): {
  messages: Record<string, string>;
  t: ScenarioStringGetter;
  loading: boolean;
} {
  const locale = useLocale();
  const safeLocale = isAppLocale(locale) ? locale : 'it';

  const [messages, setMessages] = useState<Record<string, string>>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState<boolean>(scenarioId !== null);

  useEffect(() => {
    let cancelled = false;
    if (!scenarioId) {
      // Schedule on the microtask queue so we don't trigger a synchronous
      // cascading render from inside the effect body.
      queueMicrotask(() => {
        if (cancelled) return;
        setMessages(EMPTY_BUNDLE);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    void loadScenarioMessages(scenarioId, safeLocale)
      .then((bundle) => {
        if (cancelled) return;
        setMessages(bundle);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages(EMPTY_BUNDLE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, safeLocale]);

  // Scenario copy first; keys it does not own (space-age events, shared
  // victory names) fall back to the app bundle. The key itself is returned
  // when nothing matches, so callers can detect a miss.
  const tApp = useTranslations();
  const t: ScenarioStringGetter = (key) => {
    if (!key) return '';
    const own = messages[key];
    if (own !== undefined) return own;
    return tApp.has(key) ? tApp(key) : key;
  };

  return { messages, t, loading };
}
