import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Pin Turbopack to the monorepo root so it doesn't pick up an unrelated
  // lockfile in the user's home directory.
  turbopack: {
    root: path.resolve(__dirname, '..', '..'),
  },
};

export default withNextIntl(nextConfig);
