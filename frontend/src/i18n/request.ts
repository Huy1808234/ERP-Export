import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export type Locale = (typeof routing.locales)[number];

export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;

  // Type guard to ensure locale is valid
  if (!locale || !routing.locales.includes(locale as Locale)) {
    return {
      locale: routing.defaultLocale,
      messages: (await import(`../../messages/${routing.defaultLocale}.json`)).default
    };
  }

  return {
    locale: locale as Locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
