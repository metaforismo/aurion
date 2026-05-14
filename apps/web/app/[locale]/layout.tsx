// Locale-scoped root layout. This is the actual <html>/<body> root because
// every visible route lives under /[locale]. The non-localised /app/layout.tsx
// is intentionally absent so Next.js uses this one.

import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { routing } from '../../i18n/routing';
import '../globals.css';

// Editorial geometric sans for the UI. Slightly wider apertures than Inter,
// which gives the geopolitical-thriller HUD a little more presence without
// veering into "display" territory.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

// Crisp monospace for treasury, dates, percentages — anywhere a digit
// scrubs in real time. Tabular by default in globals.css.
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

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
    <html
      lang={locale}
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} h-full`}
    >
      <body className="min-h-full bg-bg font-sans text-fg antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
