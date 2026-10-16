import {createAnalytics} from './analytics.mjs';
import {CONSENT_KEY, CONSENT_MAX_AGE, consentRecord, parseConsent} from './analytics-policy.mjs';

// The entry point is shared by every page. ES module caching prevents repeat init.
const analytics = createAnalytics();
let choice, expiryTimer, restoreFocus;
function readChoice() {
  try {return parseConsent(localStorage.getItem(CONSENT_KEY));} catch {return null;}
}
choice = readChoice();
const banner = document.createElement('aside');
banner.className = 'cookie-banner'; banner.id = 'cookie-banner'; banner.tabIndex = -1;
banner.setAttribute('role', 'region'); banner.setAttribute('aria-labelledby', 'cookie-banner-title');
banner.innerHTML = `<div><h2 id="cookie-banner-title">Your privacy choices</h2><p>May we use optional analytics cookies to understand visits and improve this website? Your choice does not affect quotes or contact options. <a href="privacy.html#analytics-cookies">Privacy information</a></p></div><div class="cookie-actions"><button type="button" data-choice="reject">Reject analytics</button><button type="button" data-choice="accept">Accept analytics</button><button type="button" class="cookie-manage">Manage preferences</button></div>`;
const dialog = document.createElement('dialog');
dialog.className = 'cookie-dialog'; dialog.setAttribute('aria-labelledby', 'cookie-dialog-title');
dialog.innerHTML = `<h2 id="cookie-dialog-title">Cookie settings</h2><p>You can use all website features with analytics turned off.</p><div class="cookie-option"><label><input type="checkbox" checked disabled /> Essential storage — always on</label><p>Remembers your privacy choice and supports required website features.</p></div><div class="cookie-option"><label><input id="cookie-analytics-toggle" type="checkbox" /> Allow Google Analytics</label><p>Optional visit statistics, contact clicks and confirmed quote requests. No contact details or form contents are sent to Analytics.</p></div><p><a href="privacy.html#analytics-cookies">Read the privacy information</a>. Change or withdraw your choice here at any time. Preferences expire after 180 days.</p><div class="cookie-actions"><button type="button" id="cookie-save">Save preferences</button><button type="button" id="cookie-cancel">Cancel</button></div>`;
const announcement = document.createElement('p');
announcement.className = 'cookie-announcement'; announcement.setAttribute('role', 'status');
document.body.append(banner, dialog, announcement);
const toggle = dialog.querySelector('#cookie-analytics-toggle');
function expireLater() {
  clearTimeout(expiryTimer);
  if (choice) {
    const remaining = choice.savedAt + CONSENT_MAX_AGE - Date.now();
    expiryTimer = setTimeout(() => {
      if (!choice) return;
      if (Date.now() >= choice.savedAt + CONSENT_MAX_AGE) {
        choice = null; analytics.setConsent(false); refresh();
      } else expireLater();
    }, Math.max(0, Math.min(remaining, 2147483647)));
  }
}
function refresh() {
  banner.hidden = Boolean(choice);
  toggle.checked = choice?.analytics === true;
  for (const button of document.querySelectorAll('[data-cookie-settings]')) button.hidden = false;
  expireLater();
}
function focusContent() {
  const main = document.querySelector('main');
  if (main) {if (!main.hasAttribute('tabindex')) main.tabIndex = -1;main.focus({preventScroll: true});}
}
function save(allowed) {
  const fromBanner = banner.contains(document.activeElement);
  choice = consentRecord(allowed);
  let persisted = true;
  try {localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));} catch {persisted = false;}
  analytics.setConsent(choice.analytics);
  refresh();
  announcement.textContent = (allowed ? 'Analytics permission saved.' : 'Analytics disabled. Your quote and contact options are unchanged.') + (persisted ? '' : ' Your browser could not save this choice; it applies to this page only.');
  if (dialog.open) dialog.close();
  else if (fromBanner) focusContent();
}
function openSettings(trigger) {
  restoreFocus = trigger;
  toggle.checked = choice?.analytics === true;
  if (!dialog.open) dialog.showModal();
}
banner.querySelector('[data-choice="reject"]').addEventListener('click', () => save(false));
banner.querySelector('[data-choice="accept"]').addEventListener('click', () => save(true));
banner.querySelector('.cookie-manage').addEventListener('click', e => openSettings(e.currentTarget));
for (const button of document.querySelectorAll('[data-cookie-settings]')) button.addEventListener('click', e => openSettings(e.currentTarget));
dialog.querySelector('#cookie-save').addEventListener('click', () => save(toggle.checked));
dialog.querySelector('#cookie-cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (restoreFocus?.isConnected && restoreFocus.getClientRects().length) restoreFocus.focus({preventScroll: true});
  else if (banner.hidden) focusContent();
});
window.addEventListener('storage', event => {
  if (event.key !== CONSENT_KEY && event.key !== null) return;
  choice = readChoice(); analytics.setConsent(choice?.analytics === true); refresh();
});
window.addEventListener('pageshow', () => {
  // A page restored from the back-forward cache must respect another tab's choice.
  choice = readChoice(); analytics.setConsent(choice?.analytics === true); refresh();
});
analytics.setConsent(choice?.analytics === true);
refresh();
