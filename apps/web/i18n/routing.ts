// next-intl routing configuration. Single source of truth for the locale list,
// default locale, and locale-prefix strategy used by middleware, navigation,
// and getRequestConfig.

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['it', 'en'] as const,
  defaultLocale: 'it',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}
