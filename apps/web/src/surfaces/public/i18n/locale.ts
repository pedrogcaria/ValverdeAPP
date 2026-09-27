export const locales = ['en', 'pt'] as const;
export type Locale = (typeof locales)[number];

// O inglês é a língua por omissão e vive na raiz; o português vive em /pt.
export const defaultLocale: Locale = 'en';

const intlLocales: Record<Locale, string> = { en: 'en-GB', pt: 'pt-PT' };
const htmlLangs: Record<Locale, string> = { en: 'en', pt: 'pt-PT' };

export function intlLocale(locale: Locale): string {
  return intlLocales[locale];
}

export function htmlLang(locale: Locale): string {
  return htmlLangs[locale];
}

export function localeFromPath(pathname: string): Locale {
  const segment = pathname.split('/')[1]?.toLowerCase();
  return segment === 'pt' ? 'pt' : defaultLocale;
}

export function pathForLocale(locale: Locale): string {
  return locale === defaultLocale ? '/' : `/${locale}`;
}
