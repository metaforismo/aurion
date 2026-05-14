// Locale-scoped root layout. This is the actual <html>/<body> root because
// every visible route lives under /[locale]. The non-localised /app/layout.tsx
// is intentionally absent so Next.js uses this one.

import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { routing } from '../../i18n/routing';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Aurion',
  description: 'Real-time pausable geopolitical strategy',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for messages in this segment.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className="h-full">
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
