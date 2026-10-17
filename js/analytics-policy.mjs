// Public, intentionally narrow configuration. No API keys or customer data.
export const MEASUREMENT_ID = 'G-7H312MNH9B';
// Account configuration and intercepted real-tag audit verified; activation
// approved on 17 October 2026. Consent is still required before loading Google.
export const GOOGLE_CONFIGURATION_VERIFIED = true;
export const CONSENT_KEY = 'htss_cookie_consent';
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
export const DEBUG_KEY = 'htss_ga_debug';
export const COOKIE_PREFIX = 'htss';
const PAGES = {
  '/': ['/', 'Home Tech Mayo'], '/index.html': ['/', 'Home Tech Mayo'],
  '/services': ['/services.html', 'Services'], '/services.html': ['/services.html', 'Services'],
  '/pricing': ['/pricing.html', 'Pricing'], '/pricing.html': ['/pricing.html', 'Pricing'],
  '/quote': ['/quote.html', 'Request a Quote'], '/quote/': ['/quote.html', 'Request a Quote'], '/quote.html': ['/quote.html', 'Request a Quote'],
  '/privacy': ['/privacy.html', 'Privacy Policy'], '/privacy.html': ['/privacy.html', 'Privacy Policy'],
  '/404': ['/404.html', 'Page Not Found'], '/404.html': ['/404.html', 'Page Not Found']
};
// Only these exact, non-personal campaign labels may enter Analytics. Extend
// deliberately for real campaigns, never by accepting arbitrary URL values.
export const CAMPAIGNS = {
  utm_source: ['google', 'bing', 'facebook', 'instagram', 'whatsapp', 'email', 'newsletter', 'flyer', 'google_business_profile'],
  utm_medium: ['organic', 'cpc', 'ppc', 'social', 'paid_social', 'email', 'referral', 'offline', 'qr'],
  utm_campaign: ['website', 'launch', 'mayo', 'furniture', 'tv-mounting', 'ventilation', 'wifi', 'smart-home', 'handyman', 'spring', 'summer', 'autumn', 'winter']
};
const REFERRERS = {
  'www.google.com': 'https://www.google.com/', 'www.google.ie': 'https://www.google.ie/',
  'google.com': 'https://www.google.com/', 'google.ie': 'https://www.google.ie/',
  'www.google.co.uk': 'https://www.google.co.uk/',
  'www.bing.com': 'https://www.bing.com/', 'bing.com': 'https://www.bing.com/',
  'facebook.com': 'https://www.facebook.com/', 'www.facebook.com': 'https://www.facebook.com/', 'm.facebook.com': 'https://www.facebook.com/', 'l.facebook.com': 'https://www.facebook.com/', 'lm.facebook.com': 'https://www.facebook.com/',
  'instagram.com': 'https://www.instagram.com/', 'www.instagram.com': 'https://www.instagram.com/', 'l.instagram.com': 'https://www.instagram.com/',
  'duckduckgo.com': 'https://duckduckgo.com/', 'www.linkedin.com': 'https://www.linkedin.com/', 't.co': 'https://t.co/'
};
export function parseConsent(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== CONSENT_VERSION || typeof value.analytics !== 'boolean' || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= CONSENT_MAX_AGE) return null;
    return {version: CONSENT_VERSION, analytics: value.analytics, savedAt: value.savedAt};
  } catch {return null;}
}
export function consentRecord(analytics, now = Date.now()) {
  return {version: CONSENT_VERSION, analytics: analytics === true, savedAt: now};
}
export function trackingEnvironment(hostname, debug = false) {
  return ['hometechmayo.ie', 'www.hometechmayo.ie'].includes(hostname) || debug && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
export function safePage(pathname) {
  const [path, title] = PAGES[pathname] || ['/404.html', 'Page Not Found'];
  return {page_location: 'https://hometechmayo.ie' + path, page_title: title};
}
export function landingContext(href, referrer = '') {
  const url = new URL(href);
  const result = {...safePage(url.pathname), page_referrer: ''};
  for (const [key, allowed] of Object.entries(CAMPAIGNS)) {
    const values = url.searchParams.getAll(key);
    if (values.length === 1 && allowed.includes(values[0])) result[key === 'utm_campaign' ? 'campaign_name' : key.replace('utm_', 'campaign_')] = values[0];
  }
  // No utm_term, utm_content, gclid, fbclid, raw hashes, arbitrary query strings,
  // personal referrer paths, credentials, custom subdomains or unknown domains.
  try {
    const previous = new URL(referrer);
    if (previous.origin === url.origin || ['hometechmayo.ie', 'www.hometechmayo.ie'].includes(previous.hostname)) {
      result.page_referrer = safePage(previous.pathname).page_location;
    } else if (['https:', 'http:'].includes(previous.protocol) && Object.hasOwn(REFERRERS, previous.hostname)) {
      result.page_referrer = REFERRERS[previous.hostname];
    } else if (['https:', 'http:'].includes(previous.protocol) && !result.campaign_source) {
      result.campaign_source = 'external-referral'; result.campaign_medium = 'referral';
    }
  } catch { /* Empty/invalid referrer is treated as direct traffic. */ }
  return Object.freeze(result);
}
export function eventParameters(name, values = {}) {
  const places = ['header', 'footer', 'calculator', 'floating', 'content'];
  if (name === 'whatsapp_click' || name === 'phone_click') return {placement: places.includes(values.placement) ? values.placement : 'content'};
  if (name === 'quote_interaction') {
    const actions = ['open', 'contact', 'service_add', 'service_remove', 'step_services', 'step_estimate', 'step_request'];
    if (!actions.includes(values.action)) return null;
    return {action: values.action, placement: places.includes(values.placement) ? values.placement : 'calculator'};
  }
  if (name === 'generate_lead') return {method: 'website_quote_form'};
  return null;
}
