import { defineMiddleware } from 'astro:middleware';

type SupportedLang = 'es' | 'en';

/**
 * Countries where Spanish is the primary language (LATAM + Spain).
 * Used as fallback when Accept-Language is not available.
 */
const SPANISH_COUNTRIES = new Set<string>([
  'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC',
  'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PY', 'SV', 'UY',
  'VE', 'PR', 'ES',
]);

/** Parses Accept-Language header respecting quality values (q-factors). */
function detectLangFromAcceptLanguage(header: string): SupportedLang {
  const tags = header
    .split(',')
    .map((entry) => {
      const [rawLang, rawQ] = entry.trim().split(';q=');
      return {
        lang: (rawLang ?? '').trim().toLowerCase(),
        q: rawQ !== undefined ? parseFloat(rawQ) : 1.0,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of tags) {
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('en')) return 'en';
  }

  return 'en';
}

/** Maps a country code to a supported language using the SPANISH_COUNTRIES set. */
function detectLangFromCountry(countryCode: string): SupportedLang {
  return SPANISH_COUNTRIES.has(countryCode.toUpperCase()) ? 'es' : 'en';
}

/**
 * Middleware for automatic language detection and redirection.
 *
 * Priority order:
 *  1. Cookie "lang"
 *  2. Accept-Language header
 *  3. GeoIP via x-vercel-ip-country (Vercel) or cf-ipcountry (Cloudflare)
 *  4. Default → /en/
 *
 * Redirect loops are prevented by skipping paths that already start with /es or /en.
 */
export const onRequest = defineMiddleware(({ request, cookies }, next) => {
  const { pathname } = new URL(request.url);

  // Skip: already on a language-prefixed path (avoids redirect loops)
  if (pathname.startsWith('/es') || pathname.startsWith('/en')) {
    return next();
  }

  // 1. Cookie
  const cookieLang = cookies.get('lang')?.value;
  if (cookieLang === 'es' || cookieLang === 'en') {
    return Response.redirect(new URL(`/${cookieLang}/`, request.url), 302);
  }

  // 2. Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const lang = detectLangFromAcceptLanguage(acceptLanguage);
    return Response.redirect(new URL(`/${lang}/`, request.url), 302);
  }

  // 3. GeoIP — Vercel injects x-vercel-ip-country; Cloudflare injects cf-ipcountry
  const countryCode =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry');

  if (countryCode) {
    const lang = detectLangFromCountry(countryCode);
    return Response.redirect(new URL(`/${lang}/`, request.url), 302);
  }

  // 4. Default fallback
  return Response.redirect(new URL('/en/', request.url), 302);
});
