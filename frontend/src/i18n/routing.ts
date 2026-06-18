import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';
 
export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'vi'],
 
  // Used when no locale matches
  defaultLocale: 'vi',

  // The App Router tree is rooted at /[locale], so all navigable URLs must
  // carry an explicit locale prefix.
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
 
// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);

export default routing;
