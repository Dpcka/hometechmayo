import {CATALOGUE, CATEGORIES, AREAS, MATERIALS, VERSION, calculate, money} from './pricing-catalogue.mjs';

const root = document.querySelector('#quote-calculator');
const form = document.querySelector('#quote-form');
const selected = document.querySelector('#selected-services');
const summary = document.querySelector('#estimate-summary');
const status = document.querySelector('#quote-status');
const area = form.elements.area;
const submit = document.querySelector('#quote-submit');
const basket = new Map();
let siteConfig, widgetId, turnstileToken = '', sending = false, finished = false;
const requestId = crypto.randomUUID();
const make = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
function labelControl(parent, text, input) {
  const label = make('label', undefined, 'calc-field');
  label.append(make('span', text), input);
  parent.append(label);
  return input;
}
function selectControl(choices, value) {
  const input = make('select');
  for (const [key, label] of choices) {const opt = make('option', label); opt.value = key; input.append(opt);}
  input.value = value;
  return input;
}
function items() {return [...basket.values()];}
function refresh() {
  summary.replaceChildren();
  document.querySelector('#quote-customer').hidden = !basket.size;
  const count = document.querySelector('#selection-count');
  count.textContent = `${basket.size} service${basket.size === 1 ? '' : 's'} selected`;
  if (!basket.size) {summary.append(make('p', 'Add services to see your estimate.')); submit.disabled = true; return;}
  let estimate;
  try {estimate = calculate(items(), area.value);} catch (error) {summary.append(make('p', error.message, 'calc-error')); submit.disabled = true; return;}
  summary.append(make('h3', 'Your estimate'));
  for (const line of estimate.lines) summary.append(make('p', `${line.name} × ${line.quantity}: ${line.customWork ? 'Custom Quote; known portion ' : 'from '}${money(line.known)}`));
  const dl = make('dl', undefined, 'calc-totals');
  for (const [label, value] of [
    ['Labour', money(estimate.labour)],
    [`Multi-service discount (${estimate.discountPercent}%)`, `−${money(estimate.discount)}`],
    ['Minimum labour adjustment', money(estimate.minimumAdjustment)],
    ['Travel — once per visit', estimate.travel === null ? 'Custom Quote — not included' : money(estimate.travel)],
    ['Materials', 'Quoted separately where needed'],
    ['Estimated known total', `${money(estimate.total)}${estimate.incomplete ? '+' : ''}`]
  ]) dl.append(make('dt', label), make('dd', value));
  summary.append(dl, make('p', `${estimate.eligibleUnits} eligible main service unit(s). 6–10: 5%; 11+: 10%. Add-ons, hourly work and packages do not increase the tier.`));
  if (estimate.customOnly) summary.append(make('p', 'Labour requires a Custom Quote; minimum €50 per separate visit.', 'calc-warning'));
  if (estimate.incomplete) summary.append(make('p', 'Custom work, unconfirmed materials and/or unknown travel are not included. The + total is only the known portion.', 'calc-warning'));
  summary.append(make('p', 'Indicative starting-price estimate, subject to confirmation. One visit only; each additional visit has its own €50 minimum and travel.'));
  submit.disabled = !siteConfig?.enabled || !turnstileToken || sending || finished;
  setupTurnstile();
}
function addService(service) {
  if (basket.has(service.id)) {document.getElementById(`selected-${service.id}`).focus(); return;}
  const item = {id: service.id, quantity: 1, materials: 'unsure', options: {}};
  for (const [key, def] of Object.entries(service.options)) item.options[key] = def.number ? 0 : def.choices[0].value;
  basket.set(service.id, item);
  const card = make('fieldset', undefined, 'calc-selection');
  card.id = `selected-${service.id}`; card.tabIndex = -1;
  card.append(make('legend', service.name));
  const controls = make('div', undefined, 'calc-controls');
  const qty = make('input'); qty.type = 'number'; qty.min = service.unit ? '0.1' : '1'; qty.max = service.kind === 'package' ? '1' : '100'; qty.step = service.unit ? '0.1' : '1'; qty.value = '1'; qty.required = true;
  labelControl(controls, service.unit ? `Area (${service.unit})` : service.kind === 'hourly' ? 'Estimated hours' : service.kind === 'package' ? 'Package (one per visit)' : 'Quantity', qty);
  qty.addEventListener('input', () => {item.quantity = qty.valueAsNumber; refresh();});
  const optionControls = {};
  function syncBundleControls() {
    if (service.id === 'tv-mount' && optionControls.cables) {
      const bundled = item.options.installation === 'inclusive';
      optionControls.cables.closest('label').hidden = bundled;
      optionControls.cables.disabled = bundled;
    }
  }
  for (const [key, def] of Object.entries(service.options)) {
    let input;
    if (def.number) {input = make('input'); input.type = 'number'; input.min = '0'; input.max = '24'; input.step = '1'; input.value = '0'; input.required = true;}
    else input = selectControl(def.choices.map(c => [c.value, c.label]), item.options[key]);
    labelControl(controls, def.label, input);
    optionControls[key] = input;
    input.addEventListener('change', () => {item.options[key] = def.number ? input.valueAsNumber : input.value; syncBundleControls(); refresh();});
  }
  syncBundleControls();
  const material = selectControl(Object.entries(MATERIALS), item.materials);
  labelControl(controls, 'Will you supply the materials for this service?', material);
  material.addEventListener('change', () => {item.materials = material.value; refresh();});
  card.append(controls);
  if (service.note) card.append(make('p', service.note, 'calc-note'));
  if (service.includedMaterials) card.append(make('p', 'Standard thermal paste is included; it will not be charged again. Replacement parts require confirmation.'));
  const remove = make('button', 'Remove service', 'calc-remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${service.name}`);
  remove.addEventListener('click', () => {basket.delete(service.id); card.remove(); document.querySelector(`[data-add="${service.id}"]`).focus(); refresh();});
  card.append(remove); selected.append(card); card.focus(); refresh();
}
const categories = document.querySelector('#service-categories');
for (const category of CATEGORIES) {
  const details = make('details', undefined, 'calc-category');
  details.append(make('summary', category));
  const list = make('div', undefined, 'calc-service-list');
  for (const service of CATALOGUE.filter(s => s.category === category)) {
    const row = make('div', undefined, 'calc-service');
    const info = make('div'); info.append(make('strong', service.name), make('span', service.price === null ? 'Custom Quote' : `From ${money(service.price)}${service.kind === 'hourly' ? ' / hour' : ''}`));
    const button = make('button', 'Add', 'btn btn-primary'); button.type = 'button'; button.dataset.add = service.id; button.setAttribute('aria-label', `Add ${service.name}`);
    button.addEventListener('click', () => addService(service));
    row.append(info, button); list.append(row);
  }
  details.append(list); categories.append(details);
}
for (const [key, charge] of Object.entries(AREAS)) {const opt = make('option', key === 'Other' ? 'Other areas — Custom travel quote' : `${key} — ${money(charge)} travel`); opt.value = key; area.append(opt);}
area.addEventListener('change', refresh);
document.querySelector('#service-search').addEventListener('keydown', event => {if (event.key === 'Enter') event.preventDefault();});
document.querySelector('#service-search').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  for (const details of categories.children) {
    let matches = 0;
    for (const row of details.querySelectorAll('.calc-service')) {row.hidden = !`${details.firstChild.textContent} ${row.textContent}`.toLowerCase().includes(query); if (!row.hidden) matches++;}
    details.hidden = !matches; details.open = Boolean(query && matches);
  }
});
async function setupTurnstile() {
  if (!basket.size || !siteConfig?.enabled || widgetId !== undefined || !window.turnstile) return;
  widgetId = window.turnstile.render('#quote-turnstile', {sitekey: siteConfig.siteKey, action: 'quote', size: 'compact', callback: token => {turnstileToken = token; refresh();}, 'expired-callback': () => {turnstileToken = ''; refresh();}, 'error-callback': () => {turnstileToken = ''; status.textContent = 'Security check could not load. Check your connection or contact us by email.'; refresh();}});
}
async function loadConfig() {
  try {
    const response = await fetch('/api/quote-config', {cache: 'no-store'});
    if (!response.ok) throw new Error();
    siteConfig = await response.json();
    if (siteConfig.version !== VERSION) {status.textContent = 'The calculator has been updated. Reload the page before submitting.'; siteConfig.enabled = false;}
    else if (!siteConfig.enabled) status.textContent = 'Estimates are available. Online quote requests are not configured yet; please email info@hometechmayo.ie or call 083 349 8496.';
    else {
      status.textContent = 'Complete the security check before sending your request.';
      const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
      script.addEventListener('load', setupTurnstile);
      script.addEventListener('error', () => {status.textContent = 'The security check could not load. Please contact us by email or phone.';});
      document.head.append(script);
    }
  } catch {status.textContent = 'Online requests are temporarily unavailable. You can still calculate an estimate and contact info@hometechmayo.ie.';}
  refresh();
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || finished || !form.reportValidity() || !turnstileToken || !siteConfig?.enabled) return;
  try {calculate(items(), area.value);} catch (error) {status.textContent = error.message; status.focus(); return;}
  sending = true; submit.textContent = 'Sending…'; refresh();
  status.textContent = 'Sending your quote request. Please keep this page open.';
  const data = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch('/api/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...data, consent: form.elements.consent.checked, version: VERSION, items: items(), requestId, turnstileToken})});
    const result = await response.json().catch(() => {throw new Error('The server response could not be confirmed. Keep this page open and retry with the same details, or contact us directly.');});
    if (!response.ok || !result.ok) {if (result.reference) finished = true; throw new Error(result.error || 'The request could not be sent. Please contact us directly.');}
    finished = true;
    status.textContent = `Your request ${result.reference} has been accepted for email delivery to Home Tech. This is not a confirmed booking or quotation.${data.email ? result.acknowledgement ? ' An acknowledgement email has also been accepted for delivery.' : ' The acknowledgement email could not be confirmed; your request to Home Tech was accepted.' : ''} Please keep this reference.`;
  } catch (error) {status.textContent = error.message === 'Failed to fetch' ? 'The connection was interrupted and delivery is uncertain. Keep this page open and retry with the same details, or contact us directly.' : error.message;}
  finally {
    sending = false; turnstileToken = ''; submit.textContent = finished ? 'Request recorded — see status' : 'Send quote request';
    if (widgetId !== undefined) window.turnstile.reset(widgetId);
    refresh(); status.focus();
  }
});
root.classList.add('is-ready');
refresh(); loadConfig();
