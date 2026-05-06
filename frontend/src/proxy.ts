import { auth } from "@/auth"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

/**
 * Senior-level Middleware Consolidation
 * Standardized as 'proxy.ts' for Next.js 16 compliance.
 */

const intlMiddleware = createMiddleware(routing)
const PUBLIC_PAGES = ['/', '/landing', '/auth/login', '/auth/register', '/auth/verify'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const publicPathnameRegex = RegExp(
    `^(/(${routing.locales.join('|')}))?(${PUBLIC_PAGES
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  );

  const isPublicPage = publicPathnameRegex.test(nextUrl.pathname);

  if (isPublicPage) {
    return intlMiddleware(req);
  }

  if (!isLoggedIn) {
      let from = nextUrl.pathname;
      if (nextUrl.search) {
        from += nextUrl.search;
      }

      const locale = nextUrl.pathname.split('/')[1] || routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", from);
      
      return Response.redirect(loginUrl);
  }

  return intlMiddleware(req);
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
