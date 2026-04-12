import es from './es.json';
import en from './en.json';

export const languages = ['es', 'en'] as const;
export type Lang = (typeof languages)[number];
export const defaultLang: Lang = 'es';

const translations: Record<string, Record<string, unknown>> = { es, en };

/**
 * Get a translated value by dot-separated key path.
 * Falls back to the default language if the key is missing, then to the key itself.
 */
export function t(lang: Lang, key: string): any {
  const keys = key.split('.');

  let value: any = translations[lang];
  for (const k of keys) {
    if (value === undefined || value === null) break;
    value = value[k];
  }
  if (value !== undefined && value !== null) return value;

  // Fallback to default language
  let fallback: any = translations[defaultLang];
  for (const k of keys) {
    if (fallback === undefined || fallback === null) break;
    fallback = fallback[k];
  }
  return fallback ?? key;
}

/** Returns static paths array for Astro's getStaticPaths */
export function getStaticLangPaths() {
  return languages.map((lang) => ({ params: { lang } }));
}
