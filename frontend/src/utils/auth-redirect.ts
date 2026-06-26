const SUPPORTED_LOCALES = new Set(["en", "vi"]);
const REDIRECT_BASE_URL = "http://mini-erp.local";

type PostLoginRedirectInput = {
  callbackUrl?: string | null;
  locale?: string;
  isStaffUser: boolean;
  roleName?: string | null;
};

const normalizeLocale = (locale?: string): string => {
  return locale && SUPPORTED_LOCALES.has(locale) ? locale : "vi";
};

const hasLocalePrefix = (pathname: string): boolean => {
  const locale = pathname.split("/").filter(Boolean)[0];
  return SUPPORTED_LOCALES.has(locale);
};

const stripLocalePrefix = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);
  if (SUPPORTED_LOCALES.has(segments[0])) {
    return `/${segments.slice(1).join("/")}`.replace(/\/+$/, "") || "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
};

const isDashboardPath = (pathname: string): boolean => {
  const pathWithoutLocale = stripLocalePrefix(pathname);
  return pathWithoutLocale === "/dashboard" || pathWithoutLocale.startsWith("/dashboard/");
};

const isGuestHomePath = (pathname: string): boolean => {
  const pathWithoutLocale = stripLocalePrefix(pathname);
  return pathWithoutLocale === "/" || pathWithoutLocale === "/landing";
};

const isLoginPath = (pathname: string): boolean => {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return (
    normalizedPathname === "/auth/login" ||
    normalizedPathname === "/en/auth/login" ||
    normalizedPathname === "/vi/auth/login"
  );
};

export const getSafeInternalRedirectPath = (
  callbackUrl?: string | null,
  locale?: string,
): string | null => {
  const rawCallbackUrl = callbackUrl?.trim();
  if (!rawCallbackUrl || !rawCallbackUrl.startsWith("/") || rawCallbackUrl.startsWith("//")) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawCallbackUrl, REDIRECT_BASE_URL);
    if (parsedUrl.origin !== REDIRECT_BASE_URL || isLoginPath(parsedUrl.pathname)) {
      return null;
    }

    const safeLocale = normalizeLocale(locale);
    const localizedPathname = hasLocalePrefix(parsedUrl.pathname)
      ? parsedUrl.pathname
      : `/${safeLocale}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`;

    return `${localizedPathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return null;
  }
};

export const getPostLoginRedirectPath = ({
  callbackUrl,
  locale,
  isStaffUser,
  roleName,
}: PostLoginRedirectInput): string => {
  const safeLocale = normalizeLocale(locale);
  const safeCallbackPath = getSafeInternalRedirectPath(callbackUrl, locale);
  if (safeCallbackPath) {
    const callbackPathname = new URL(safeCallbackPath, REDIRECT_BASE_URL).pathname;

    if (isStaffUser) {
      if (isGuestHomePath(callbackPathname)) {
        // If it's a customer, redirect to /dashboard/portal, otherwise /dashboard
        return roleName === 'CUSTOMER' ? `/${safeLocale}/dashboard/portal` : `/${safeLocale}/dashboard`;
      }
      return safeCallbackPath;
    }

    return isDashboardPath(callbackPathname) ? `/${safeLocale}` : safeCallbackPath;
  }

  if (isStaffUser) {
    return roleName === 'CUSTOMER' ? `/${safeLocale}/dashboard/portal` : `/${safeLocale}/dashboard`;
  }

  return `/${safeLocale}`;
};
