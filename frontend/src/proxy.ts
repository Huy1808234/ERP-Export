import { auth } from "@/auth"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

const intlMiddleware = createMiddleware(routing)
const PUBLIC_PAGES = ['/', '/landing', '/auth/login', '/auth/register', '/auth/verify'];
const CHROME_DEVTOOLS_CONFIG_PATH = '/.well-known/appspecific/com.chrome.devtools.json';

const isChromeDevtoolsProbe = (pathname: string): boolean => {
  if (pathname === CHROME_DEVTOOLS_CONFIG_PATH) return true;

  const firstSegment = pathname.split('/').filter(Boolean)[0];
  if (!firstSegment || !routing.locales.includes(firstSegment as "en" | "vi")) return false;

  return pathname === `/${firstSegment}${CHROME_DEVTOOLS_CONFIG_PATH}`;
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  if (isChromeDevtoolsProbe(nextUrl.pathname)) {
    return new Response(null, { status: 204 });
  }

  const publicPathnameRegex = RegExp(
    `^(/(${routing.locales.join('|')}))?(${PUBLIC_PAGES
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  );

  const isPublicPage = publicPathnameRegex.test(nextUrl.pathname);

  if (isPublicPage) {
    const res = intlMiddleware(req);
    res.headers.set('x-middleware-request-x-pathname', req.nextUrl.pathname);
    return res;
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

  const res = intlMiddleware(req);
  res.headers.set('x-middleware-request-x-pathname', req.nextUrl.pathname);
  return res;
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
