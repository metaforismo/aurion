// next-intl locale-routing proxy. Runs before pages render so the
// `[locale]` segment is always populated and unprefixed URLs are redirected
// to the user's preferred locale. Next.js 16 renamed the convention from
// `middleware` to `proxy`; the next-intl 4 import path remains
// `next-intl/middleware` until upstream renames it.

import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except internal Next.js paths and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
