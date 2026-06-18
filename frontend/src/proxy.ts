import { auth } from "@/auth"
import createMiddleware from "next-intl/middleware"
import { NextResponse } from "next/server"
import { routing, type AppLocale } from "./i18n/routing"
import { canAccessDashboardPath, getAccessRoleName } from "./lib/access-control"

const intlMiddleware = createMiddleware(routing)
const PUBLIC_PAGES = ['/', '/landing', '/about', '/products', '/auth/login', '/auth/register', '/auth/verify'];
const PUBLIC_PATH_PREFIXES = ['/portal/sign/', '/auth/verify/'];
const CHROME_DEVTOOLS_CONFIG_PATH = '/.well-known/appspecific/com.chrome.devtools.json';

const getPathLocale = (pathname: string): AppLocale | null => {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return routing.locales.includes(firstSegment as AppLocale) ? firstSegment as AppLocale : null;
};

const stripLocalePrefix = (pathname: string): string => {
  const locale = getPathLocale(pathname);
  if (!locale) return pathname;

  return pathname.replace(`/${locale}`, '') || '/';
};

const withPathnameHeader = (res: NextResponse, pathname: string): NextResponse => {
  res.headers.set('x-middleware-request-x-pathname', pathname);
  return res;
};

const redirectToLocalizedPath = (req: Parameters<typeof intlMiddleware>[0]): NextResponse => {
  const localizedUrl = req.nextUrl.clone();
  localizedUrl.pathname = `/${routing.defaultLocale}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
  return NextResponse.redirect(localizedUrl);
};

const getLegacyPartnerRedirect = (
  req: Parameters<typeof intlMiddleware>[0],
  pathWithoutLocale: string,
  locale: AppLocale,
): NextResponse | null => {
  const match = pathWithoutLocale.match(/^\/admin\/(partners|suppliers)\/([^/]+)\/?$/i);
  if (!match) return null;

  const [, partnerPath, partnerRef] = match;
  if (!partnerPath || !partnerRef) return null;

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = `/${locale}/dashboard/partners`;
  redirectUrl.searchParams.set('partner_ref', partnerRef);
  redirectUrl.searchParams.set('partner_type', partnerPath.toLowerCase() === 'suppliers' ? 'SUPPLIER' : 'CUSTOMER');

  return NextResponse.redirect(redirectUrl);
};

const isChromeDevtoolsProbe = (pathname: string): boolean => {
  if (pathname === CHROME_DEVTOOLS_CONFIG_PATH) return true;

  const firstSegment = getPathLocale(pathname);
  if (!firstSegment) return false;

  return pathname === `/${firstSegment}${CHROME_DEVTOOLS_CONFIG_PATH}`;
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth && req.auth.error !== 'RefreshAccessTokenError';
  const pathLocale = getPathLocale(nextUrl.pathname);

  if (isChromeDevtoolsProbe(nextUrl.pathname)) {
    return new Response(null, { status: 204 });
  }

  const publicPathnameRegex = RegExp(
    `^(/(${routing.locales.join('|')}))?(${PUBLIC_PAGES
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  );

  const pathWithoutLocale = stripLocalePrefix(nextUrl.pathname);
  const isPublicPage = publicPathnameRegex.test(nextUrl.pathname)
    || PUBLIC_PATH_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));

  if (isPublicPage) {
    return withPathnameHeader(intlMiddleware(req), req.nextUrl.pathname);
  }

  const legacyPartnerRedirect = getLegacyPartnerRedirect(req, pathWithoutLocale, pathLocale || routing.defaultLocale);
  if (legacyPartnerRedirect) {
    return legacyPartnerRedirect;
  }

  if (!isLoggedIn) {
      let from = nextUrl.pathname;
      if (nextUrl.search) {
        from += nextUrl.search;
      }

      const locale = pathLocale || routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", from);
      
      return NextResponse.redirect(loginUrl);
  }

  if (!pathLocale) {
    return redirectToLocalizedPath(req);
  }

  const pathForAccessCheck = stripLocalePrefix(nextUrl.pathname);
  const roleName = getAccessRoleName(req.auth?.user);
  if (
    pathForAccessCheck.startsWith('/dashboard')
    && pathForAccessCheck !== '/dashboard/access-denied'
    && !canAccessDashboardPath(pathForAccessCheck, roleName)
  ) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = `/${pathLocale}/dashboard/access-denied`;
    deniedUrl.searchParams.set('from', `${nextUrl.pathname}${nextUrl.search}`);

    return NextResponse.redirect(deniedUrl);
  }

  const res = intlMiddleware(req);
  res.cookies.set('NEXT_LOCALE', pathLocale, { path: '/', sameSite: 'lax' });
  return withPathnameHeader(res, req.nextUrl.pathname);
})

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)']
};
