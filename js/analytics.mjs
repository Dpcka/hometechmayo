import {MEASUREMENT_ID, GOOGLE_CONFIGURATION_VERIFIED, COOKIE_PREFIX, DEBUG_KEY, CONSENT_MAX_AGE, landingContext, trackingEnvironment, eventParameters} from './analytics-policy.mjs';

// Capture only sanitized landing metadata in memory, before URL/category changes.
// No attribution storage, Google requests or event buffering before consent.
export function createAnalytics(win = window, doc = document, {configurationVerified = GOOGLE_CONFIGURATION_VERIFIED} = {}) {
  const landing = landingContext(win.location.href, doc.referrer);
  let debug = false;
  try {debug = win.sessionStorage.getItem(DEBUG_KEY) === '1';} catch { /* Optional diagnostic flag only. */ }
  const environmentAllowed = trackingEnvironment(win.location.hostname, debug) && configurationVerified;
  const disableKey = `ga-disable-${MEASUREMENT_ID}`;
  win[disableKey] = true;
  let consent = false, ready = false, loading, scriptLoaded = false, initialized = false, viewed = false, leadSeen = false;
  let pending = [], lastStep;
  function gtag() {win.dataLayer.push(arguments);}
  function clearCookies() {
    // Only our namespaced GA cookies; keep consent, WhatsApp and security state.
    const names = doc.cookie.split(';').map(c => c.trim().split('=')[0]).filter(name => name === `${COOKIE_PREFIX}_ga` || name.startsWith(`${COOKIE_PREFIX}_ga_`));
    const domains = ['', win.location.hostname, '.hometechmayo.ie', 'hometechmayo.ie'];
    for (const name of names) for (const domain of domains) {
      doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? '; Domain=' + domain : ''}`;
    }
  }
  function event(name, values = {}) {
    const safe = eventParameters(name, values);
    if (!consent || !environmentAllowed || !safe) return false;
    if (!ready) {if (pending.length < 20) pending.push([name, safe]); return true;}
    gtag('event', name, {...landing, ...safe, ...(debug ? {debug_mode: true} : {})});
    return true;
  }
  function activate() {
    if (!consent || !environmentAllowed) return;
    win[disableKey] = false;
    if (!initialized) {
      gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      gtag('js', new Date());
      gtag('set', {...landing, allow_google_signals: false, allow_ad_personalization_signals: false, ads_data_redaction: true, url_passthrough: false});
      gtag('consent', 'update', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      gtag('config', MEASUREMENT_ID, {...landing, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_prefix: COOKIE_PREFIX, cookie_domain: 'none', cookie_path: '/', cookie_expires: CONSENT_MAX_AGE / 1000, cookie_update: false,
        cookie_flags: win.location.protocol === 'https:' ? 'SameSite=Lax;Secure' : 'SameSite=Lax',
        linker: {accept_incoming: false, decorate_forms: false}, ...(debug ? {debug_mode: true} : {})});
      initialized = true;
    } else gtag('consent', 'update', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    ready = true;
    if (!viewed) {viewed = true; gtag('event', 'page_view', {...landing, ...(debug ? {debug_mode: true} : {})});}
    const events = pending; pending = [];
    for (const [name, params] of events) event(name, params);
  }
  function enable() {
    if (!environmentAllowed) return;
    if (loading) {if (scriptLoaded) activate(); return;}
    // Refuse a second independent installation instead of silently duplicating it.
    if (doc.querySelector('script[src*="googletagmanager.com/"],script[src*="google-analytics.com/"]') || win.gtag || win.dataLayer?.length) return;
    win.dataLayer = win.dataLayer || [];
    win.gtag = gtag;
    const script = doc.createElement('script');
    script.id = 'htss-ga-tag'; script.async = true; script.referrerPolicy = 'no-referrer';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    loading = script;
    script.addEventListener('load', () => {scriptLoaded = true; activate();});
    script.addEventListener('error', () => {pending = []; /* Analytics failure never interrupts the site. */ });
    doc.head.append(script);
  }
  function setConsent(allowed) {
    const was = consent; consent = allowed === true;
    if (consent) {if (!was) enable();}
    else {
      win[disableKey] = true; ready = false; pending = [];
      // ga-disable blocks all GA sends/cookies before this local consent update.
      if (initialized) gtag('consent', 'update', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      clearCookies();
    }
  }
  function placement(node) {
    if (node.closest('header')) return 'header';
    if (node.closest('footer')) return 'footer';
    if (node.closest('.whatsapp-float')) return 'floating';
    return node.closest('#quote-calculator') ? 'calculator' : 'content';
  }
  doc.addEventListener('click', e => {
    const node = e.target.closest?.('a,button');
    if (!node || node.disabled) return;
    if (node.tagName === 'A') {
      const raw = node.getAttribute('href') || '';
      if (raw.startsWith('tel:')) {event('phone_click', {placement: placement(node)}); return;}
      try {
        const link = new URL(raw, win.location.href);
        if (['wa.me', 'api.whatsapp.com', 'www.whatsapp.com'].includes(link.hostname)) {event('whatsapp_click', {placement: placement(node)}); return;}
        if (link.origin === win.location.origin) {
          if (['/quote', '/quote/', '/quote.html'].includes(link.pathname) || link.hash === '#quote-calculator') event('quote_interaction', {action: 'open', placement: placement(node)});
          else if (link.hash === '#contact') event('quote_interaction', {action: 'contact', placement: placement(node)});
        }
      } catch { /* Not an eligible website navigation. */ }
    } else if (node.hasAttribute('data-add')) event('quote_interaction', {action: 'service_add', placement: 'calculator'});
    else if (node.classList.contains('calc-remove')) event('quote_interaction', {action: 'service_remove', placement: 'calculator'});
  }, true);
  doc.addEventListener('htss:quote-step', e => {
    const step = e.detail?.step;
    if (![1, 2, 3].includes(step) || step === lastStep) return;
    lastStep = step;
    event('quote_interaction', {action: ['step_services', 'step_estimate', 'step_request'][step - 1], placement: 'calculator'});
  });
  doc.addEventListener('htss:quote-submitted', () => {
    if (leadSeen) return;
    leadSeen = true; event('generate_lead');
  });
  return {setConsent};
}
