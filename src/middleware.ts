import { defineMiddleware } from 'astro:middleware';

type SupportedLang = 'es' | 'en';

/**
 * Countries where Spanish is primary language (LATAM + Spain).
 */
const SPANISH_COUNTRIES = new Set<string>([
  'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC',
  'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PY', 'SV', 'UY',
  'VE', 'PR', 'ES',
]);

/** Builds a 302 redirect response with cache prevention headers. */
function redirect(base: URL, lang: SupportedLang): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(`/${lang}/`, base).toString(),
      'Cache-Control': 'no-store',
    },
  });
}

/** Detect language from Accept-Language header */
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

/** Detect language from country code */
function detectLangFromCountry(countryCode: string): SupportedLang {
  return SPANISH_COUNTRIES.has(countryCode.toUpperCase()) ? 'es' : 'en';
}

export const onRequest = defineMiddleware(({ request, cookies }, next) => {
  const url = new URL(request.url);
  const { pathname } = url;

  // 🚫 Evitar loops
  if (pathname.startsWith('/es') || pathname.startsWith('/en')) {
    return next();
  }

  // 1️⃣ Cookie (máxima prioridad)
  const cookieLang = cookies.get('lang')?.value;
  if (cookieLang === 'es' || cookieLang === 'en') {
    return redirect(url, cookieLang);
  }

  // 2️⃣ Geo (Vercel / Cloudflare)
  const countryCode =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry');

  if (countryCode) {
    return redirect(url, detectLangFromCountry(countryCode));
  }

  // 3️⃣ Accept-Language (fallback)
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    return redirect(url, detectLangFromAcceptLanguage(acceptLanguage));
  }

  // 4️⃣ Default final
  return redirect(url, 'en');
});