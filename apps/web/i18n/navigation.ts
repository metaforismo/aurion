// Locale-aware navigation primitives. Use these instead of `next/link` and
// `next/navigation` so locale prefixes are added/stripped automatically.

import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
