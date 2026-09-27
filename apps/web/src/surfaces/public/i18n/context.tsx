import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { htmlLang, intlLocale, localeFromPath, locales, pathForLocale, type Locale } from './locale';
import { messages, type Messages } from './messages';

type I18nValue = {
  locale: Locale;
  intl: string;
  t: Messages;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

function upsertHead(selector: string, create: () => HTMLElement, apply: (element: HTMLElement) => void) {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  apply(element);
}

function syncDocument(locale: Locale, t: Messages) {
  const origin = window.location.origin;
  document.documentElement.lang = htmlLang(locale);
  document.title = t.meta.title;
  upsertHead('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), (meta) => meta.setAttribute('content', t.meta.description));
  upsertHead('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), (link) => link.setAttribute('href', `${origin}${pathForLocale(locale)}`));
  for (const alternate of [...locales, 'x-default'] as const) {
    const target = alternate === 'x-default' ? pathForLocale('en') : pathForLocale(alternate);
    upsertHead(`link[rel="alternate"][hreflang="${alternate}"]`, () => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = alternate;
      return link;
    }, (link) => link.setAttribute('href', `${origin}${target}`));
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => localeFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setLocaleState(localeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => syncDocument(locale, messages[locale]), [locale]);

  const setLocale = useCallback((next: Locale) => {
    const path = pathForLocale(next);
    if (window.location.pathname !== path) window.history.pushState(null, '', `${path}${window.location.search}${window.location.hash}`);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, intl: intlLocale(locale), t: messages[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n tem de ser usado dentro de I18nProvider.');
  return value;
}
