import {CATALOGUE, BY_ID, AREAS, MATERIALS, VERSION, calculate, money} from './pricing-catalogue.mjs';
import {QUOTE_CATEGORIES, categoryById} from './quote-categories.mjs';

const form = document.querySelector('#quote-form');
const category = document.querySelector('#service-category');
const search = document.querySelector('#service-search');
const results = document.querySelector('#service-results');
const selected = document.querySelector('#selected-services');
const materialChoices = document.querySelector('#materials-choices');
const status = document.querySelector('#quote-status');
const errorBox = document.querySelector('#wizard-error');
const submit = document.querySelector('#quote-submit');
const area = form.elements.area;
const basket = new Map();
const steps = [...document.querySelectorAll('.wizard-step')];
const requestId = crypto.randomUUID();
const PAGE_SIZE = 6;
let step = 1, resultPage = 0, siteConfig, widgetId;
let turnstileToken = '', sending = false, finished = false;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function field(parent, text, input) {
  const label = el('label', undefined, 'calc-field');
  label.append(el('span', text), input);
  parent.append(label);
  return input;
}
function select(choices, value) {
  const node = el('select');
  for (const [key, label] of choices) {
    const option = el('option', label); option.value = key; node.append(option);
  }
  node.value = value;
  return node;
}
const items = () => [...basket.values()];
const priceLabel = service => service.price === null ? 'Custom Quote' : `From ${money(service.price)}${service.kind === 'hourly' ? ' / hour' : service.kind === 'package' ? ' / package' : ''}`;
function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
  if (message) errorBox.focus();
}
function clearError() {errorBox.hidden = true; errorBox.textContent = '';}
function setStep(next) {
  step = next;
  clearError();
  for (const panel of steps) {
    const active = Number(panel.dataset.step) === step;
    panel.hidden = !active;
    panel.querySelector('.wizard-fields').disabled = !active || sending || finished;
  }
  for (const button of document.querySelectorAll('[data-go]')) {
    if (button.closest('.wizard-progress')) {
      if (Number(button.dataset.go) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    button.disabled = sending || finished;
  }
  document.querySelector(`#step-${step}-title`).focus({preventScroll: true});
  document.querySelector('.wizard-progress').scrollIntoView({block: 'start', behavior: 'instant'});
  refresh();
  document.dispatchEvent(new CustomEvent('htss:quote-step', {detail: {step: next}}));
}
function checkSelections() {
  if (!basket.size) throw new Error('Add at least one service before continuing.');
  // Area/material selections are completed in step 2. The existing engine is
  // used here only to validate selections, never to imply free travel.
  calculate(items(), area.value || 'Castlebar');
}
function go(next) {
  if (sending || finished) return;
  try {
    if (next >= 2) checkSelections();
    if (next === 3 && !area.value) {
      setStep(2);
      area.reportValidity();
      return;
    }
    if (next === 3) calculate(items(), area.value);
    setStep(next);
  } catch (error) {
    if (next > 1) setStep(1);
    showError(error.message);
  }
}
for (const button of document.querySelectorAll('[data-go]')) button.addEventListener('click', () => go(Number(button.dataset.go)));

function renderResults() {
  const query = search.value.trim().toLowerCase();
  const chosen = categoryById(category.value);
  const services = CATALOGUE.filter(service => query
    ? `${service.name} ${service.category}`.toLowerCase().includes(query)
    : service.category === chosen.name);
  const pages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  resultPage = Math.min(resultPage, pages - 1);
  results.replaceChildren();
  const visible = services.slice(resultPage * PAGE_SIZE, (resultPage + 1) * PAGE_SIZE);
  document.querySelector('#service-results-status').textContent = services.length
    ? `${query ? 'Search results' : chosen.name} · ${resultPage * PAGE_SIZE + 1}–${resultPage * PAGE_SIZE + visible.length} of ${services.length}`
    : 'No matching services. Try a different search.';
  for (const service of visible) {
    const card = el('article', undefined, 'calc-service');
    const info = el('div');
    info.append(el('h3', service.name), el('p', priceLabel(service), 'service-price'));
    if (query) info.append(el('p', service.category, 'service-category-label'));
    const add = el('button', basket.has(service.id) ? 'Added' : 'Add', 'calc-add');
    add.type = 'button'; add.dataset.add = service.id;
    add.disabled = basket.has(service.id);
    add.setAttribute('aria-label', `Add ${service.name}`);
    add.addEventListener('click', () => addService(service));
    card.append(info, add); results.append(card);
  }
  document.querySelector('#service-pagination').hidden = pages === 1;
  document.querySelector('#services-page').textContent = `${resultPage + 1} / ${pages}`;
  document.querySelector('#services-prev').disabled = resultPage === 0;
  document.querySelector('#services-next').disabled = resultPage === pages - 1;
}
for (const item of QUOTE_CATEGORIES) {
  const option = el('option', item.name); option.value = item.id; category.append(option);
}
const initialCategory = new URL(location.href).searchParams.get('category');
category.value = categoryById(initialCategory)?.id || QUOTE_CATEGORIES[0].id;
category.addEventListener('change', () => {
  search.value = ''; resultPage = 0;
  const url = new URL(location.href); url.searchParams.set('category', category.value);
  history.replaceState(null, '', url);
  renderResults();
});
search.addEventListener('input', () => {resultPage = 0; renderResults();});
search.addEventListener('keydown', event => {if (event.key === 'Enter') event.preventDefault();});
for (const [id, direction] of [['services-prev', -1], ['services-next', 1]]) {
  document.getElementById(id).addEventListener('click', () => {
    resultPage += direction; renderResults();
    results.querySelector('h3')?.setAttribute('tabindex', '-1');
    results.querySelector('h3')?.focus();
  });
}
function renderMaterials() {
  materialChoices.replaceChildren();
  for (const item of basket.values()) {
    const service = BY_ID.get(item.id);
    const row = el('div', undefined, 'material-row');
    const input = select(Object.entries(MATERIALS), item.materials);
    input.dataset.materials = item.id;
    field(row, service.name, input);
    if (service.includedMaterials) row.append(el('p', 'Standard thermal paste is included. Replacement parts require confirmation.', 'calc-note'));
    input.addEventListener('change', () => {item.materials = input.value; refresh();});
    materialChoices.append(row);
  }
}
function addService(service) {
  if (basket.has(service.id)) return;
  const item = {id: service.id, quantity: 1, materials: 'unsure', options: {}};
  for (const [key, def] of Object.entries(service.options)) item.options[key] = def.number ? 0 : def.choices[0].value;
  basket.set(service.id, item);
  const card = el('fieldset', undefined, 'calc-selection');
  card.id = `selected-${service.id}`;
  card.append(el('legend', service.name));
  const row = el('div', undefined, 'selection-row');
  row.append(el('span', priceLabel(service), 'calc-note'));
  const quantity = el('input');
  quantity.type = 'number'; quantity.required = true;
  quantity.min = service.unit ? '0.1' : '1'; quantity.max = service.kind === 'package' ? '1' : '100';
  quantity.step = service.unit ? '0.1' : '1'; quantity.value = '1'; quantity.dataset.quantity = service.id;
  field(row, service.unit ? `Area (${service.unit})` : service.kind === 'hourly' ? 'Hours' : 'Quantity', quantity);
  quantity.addEventListener('input', () => {item.quantity = quantity.valueAsNumber; refresh();});
  const remove = el('button', 'Remove', 'calc-remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${service.name}`);
  remove.addEventListener('click', () => {
    basket.delete(service.id); card.remove(); renderMaterials(); renderResults(); refresh();
    const add = results.querySelector(`[data-add="${service.id}"]`);
    (add || category).focus();
  });
  row.append(remove); card.append(row);
  if (Object.keys(service.options).length || service.note) {
    const details = el('details', undefined, 'selection-options');
    details.append(el('summary', Object.keys(service.options).length ? 'Options & details' : 'Service details'));
    const controls = el('div', undefined, 'calc-controls');
    const optionControls = {};
    function syncBundle() {
      if (service.id === 'tv-mount' && optionControls.cables) {
        const bundled = item.options.installation === 'inclusive';
        optionControls.cables.closest('label').hidden = bundled;
        optionControls.cables.disabled = bundled;
      }
    }
    for (const [key, def] of Object.entries(service.options)) {
      let input;
      if (def.number) {
        input = el('input'); input.type = 'number'; input.min = '0'; input.max = '24'; input.step = '1'; input.value = '0'; input.required = true;
      } else input = select(def.choices.map(c => [c.value, c.label]), item.options[key]);
      field(controls, def.label, input); optionControls[key] = input;
      input.addEventListener('change', () => {item.options[key] = def.number ? input.valueAsNumber : input.value; syncBundle(); refresh();});
    }
    syncBundle(); details.append(controls);
    if (service.note) details.append(el('p', service.note, 'calc-note'));
    card.append(details);
  }
  selected.append(card);
  clearError(); renderMaterials();
  // Keep keyboard focus on the service browser; do not jump a mobile customer
  // down the page after every addition.
  for (const button of results.querySelectorAll('[data-add]')) {
    if (button.dataset.add === service.id) {button.textContent = 'Added'; button.disabled = true;}
  }
  refresh();
}
for (const [name, cost] of Object.entries(AREAS)) {
  const option = el('option', cost === null ? 'Other areas — Custom travel quote' : `${name} — ${money(cost)} travel`);
  option.value = name; area.append(option);
}
area.addEventListener('change', refresh);
// One read-only cart per step; all service editing stays in the left workspace.
const summaryNodes = ['order-summary', 'estimate-summary', 'final-summary'].map(id => document.getElementById(id));
const compactSummary = window.matchMedia('(max-width: 900px)');
function setupSummary(node) {
  const disclosure = el('details', undefined, 'cart-disclosure');
  disclosure.open = !compactSummary.matches;
  const heading = el('summary', undefined, 'cart-heading');
  const title = el('span', undefined, 'cart-heading-label');
  title.append(el('strong', 'Order summary'), el('span', '', 'cart-count'));
  const amount = el('span', undefined, 'cart-heading-total');
  amount.append(el('span', 'Known labour', 'cart-total-label'), el('span', '—', 'estimate-amount'));
  heading.append(title, amount);
  const body = el('div', undefined, 'cart-body');
  disclosure.append(heading, body); node.replaceChildren(disclosure);
}
for (const node of summaryNodes) setupSummary(node);
compactSummary.addEventListener('change', event => {
  for (const node of summaryNodes) node.querySelector('.cart-disclosure').open = !event.matches;
});
// Follow the actual fixed header height rather than assuming desktop/mobile sizes.
function updateSummaryOffset() {
  const height = document.querySelector('header').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--quote-summary-top', `${Math.ceil(height) + 12}px`);
}
updateSummaryOffset();
if ('ResizeObserver' in window) new ResizeObserver(updateSummaryOffset).observe(document.querySelector('header'));
else window.addEventListener('resize', updateSummaryOffset);
function renderEstimate(node, estimate, final = false) {
  const body = node.querySelector('.cart-body');
  body.replaceChildren();
  node.querySelector('.cart-count').textContent = `${basket.size} service${basket.size === 1 ? '' : 's'}`;
  node.querySelector('.cart-total-label').textContent = area.value ? 'Estimated known total' : 'Known labour · travel pending';
  const amount = node.querySelector('.estimate-amount');
  if (!estimate) {
    amount.textContent = '—';
    body.append(el('p', basket.size ? 'Check service quantities and options to see your estimate.' : 'Add services to build your estimate.', 'cart-note'));
    return;
  }
  const incomplete = estimate.incomplete || !area.value;
  amount.textContent = `${money(estimate.total)}${incomplete ? '+' : ''}`;
  const table = el('table', undefined, 'cart-table');
  table.append(el('caption', 'Starting labour prices including selected options, before discounts and the visit minimum.', 'cart-sr-only'));
  const columns = el('colgroup');
  for (const name of ['service', 'quantity', 'unit', 'line']) columns.append(el('col', undefined, `cart-col-${name}`));
  table.append(columns);
  const head = el('thead'), header = el('tr');
  for (const label of ['Service', 'Qty', 'Unit', 'Line total']) {
    const cell = el('th', label); cell.scope = 'col'; header.append(cell);
  }
  head.append(header); table.append(head);
  const rows = el('tbody');
  for (const line of estimate.lines) {
    const row = el('tr'); row.dataset.cartService = line.id;
    const name = el('th', line.name, 'cart-service-name'); name.scope = 'row';
    const unit = line.unit === 'hours' ? ' h' : line.unit === 'm²' ? ' m²' : '';
    const quantity = el('td', `${line.quantity}${unit}`, 'cart-quantity');
    quantity.setAttribute('aria-label', `${line.quantity} ${line.unit}`);
    // Display the authoritative known price for the chosen options, not a
    // separate price calculation. Unknown work never becomes a €0 fixed price.
    const unitPrice = line.customWork && !line.known ? 'Quote' : `${money(line.known / line.quantity)}${line.customWork ? '+' : ''}`;
    const linePrice = line.customWork && !line.known ? 'Quote' : `${money(line.known)}${line.customWork ? '+' : ''}`;
    row.append(name, quantity, el('td', unitPrice, 'cart-unit-price'), el('td', linePrice, 'cart-line-price'));
    rows.append(row);
  }
  table.append(rows); body.append(table);
  const totals = el('dl', undefined, 'calc-totals');
  for (const [label, value] of [
    ['Labour', money(estimate.labour)], [`Discount (${estimate.discountPercent}%)`, `−${money(estimate.discount)}`],
    ['Minimum labour adjustment', money(estimate.minimumAdjustment)],
    [area.value ? `Travel · ${estimate.area}` : 'Travel', !area.value ? 'Choose area in step 2' : estimate.travel === null ? 'Custom Quote — excluded' : money(estimate.travel)],
    ['Materials', estimate.lines.some(line => line.materialUnknown) ? 'Unconfirmed costs excluded' : 'Customer supplied / included']
  ]) totals.append(el('dt', label), el('dd', value));
  body.append(totals);
  if (estimate.customOnly) body.append(el('p', 'Labour needs a Custom Quote; minimum €50 per visit.', 'cart-note'));
  if (incomplete) body.append(el('p', '+ excludes custom work, unknown materials and/or unconfirmed travel. Quote means Custom Quote, not zero-cost work.', 'cart-note'));
  body.append(el('p', 'Unit and line prices include selected options, before discounts. Indicative only; one visit, subject to confirmation.', 'cart-note'));
  if (!final) body.append(el('p', `${estimate.eligibleUnits} qualifying main units. Add-ons do not increase the discount tier.`, 'cart-note'));
}
function refresh() {
  const count = basket.size;
  document.querySelector('#selection-count').textContent = count ? `${count} service${count === 1 ? '' : 's'} selected` : 'No services selected';
  document.querySelector('.selection-hint').hidden = Boolean(count);
  let estimate;
  if (count) {
    // Before step 2, show known labour only and explicitly mark travel pending.
    try {estimate = calculate(items(), area.value || 'Castlebar');} catch { /* Navigation exposes the actionable selection error. */ }
  }
  renderEstimate(summaryNodes[0], estimate);
  renderEstimate(summaryNodes[1], estimate);
  renderEstimate(summaryNodes[2], estimate, true);
  submit.disabled = step !== 3 || !area.value || !estimate || !siteConfig?.enabled || !turnstileToken || sending || finished;
  setupTurnstile();
}
function setupTurnstile() {
  if (step !== 3 || !siteConfig?.enabled || widgetId !== undefined || !window.turnstile) return;
  widgetId = window.turnstile.render('#quote-turnstile', {
    sitekey: siteConfig.siteKey, action: 'quote', size: 'compact',
    callback: token => {turnstileToken = token; refresh();},
    'expired-callback': () => {turnstileToken = ''; refresh();},
    'error-callback': () => {turnstileToken = ''; status.textContent = 'Security verification could not load. Try again or contact us by email.'; refresh();}
  });
}
async function loadConfig() {
  try {
    const response = await fetch('/api/quote-config', {cache: 'no-store'});
    if (!response.ok) throw new Error();
    siteConfig = await response.json();
    if (siteConfig.version !== VERSION) {status.textContent = 'The catalogue has changed. Reload this page before submitting.'; siteConfig.enabled = false;}
    else if (!siteConfig.enabled) status.textContent = 'Online quote requests are not configured yet. Your estimate still works; please email info@hometechmayo.ie or call 083 349 8496.';
    else {
      status.textContent = 'Complete the security check before sending your request.';
      const script = el('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
      script.addEventListener('load', setupTurnstile);
      script.addEventListener('error', () => {status.textContent = 'Security verification is unavailable. Please email or call us.';});
      document.head.append(script);
    }
  } catch {status.textContent = 'Online requests are temporarily unavailable. Please email info@hometechmayo.ie or call 083 349 8496.';}
  refresh();
}
function lockForm(locked) {
  for (const panel of steps) panel.querySelector('.wizard-fields').disabled = locked || Number(panel.dataset.step) !== step;
  for (const button of document.querySelectorAll('[data-go]')) button.disabled = locked;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (step !== 3 || sending || finished || !siteConfig?.enabled || !turnstileToken) return;
  if (!form.reportValidity()) return;
  try {checkSelections(); calculate(items(), area.value);} catch (error) {go(1); showError(error.message); return;}
  // Capture fields before disabling inactive/processing controls. Area and basket
  // are explicit because previous-step fieldsets are intentionally disabled.
  const data = Object.fromEntries(new FormData(form));
  const payload = {...data, area: area.value, items: items(), consent: form.elements.consent.checked, version: VERSION, requestId, turnstileToken};
  sending = true; lockForm(true); submit.textContent = 'Sending…'; refresh();
  status.textContent = 'Sending your request. Please keep this page open.';
  try {
    const response = await fetch('/api/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
    const result = await response.json().catch(() => {throw new Error('The server response could not be confirmed. Keep this page open and retry with the same details, or contact us directly.');});
    if (!response.ok || !result.ok) {
      if (result.reference) finished = true;
      throw new Error(result.error || 'The request could not be sent. Please contact us directly.');
    }
    finished = true;
    if (result.ok === true) document.dispatchEvent(new CustomEvent('htss:quote-submitted'));
    status.textContent = `Request ${result.reference} has been accepted for email delivery to Home Tech.${data.email ? result.acknowledgement ? ' An acknowledgement has also been accepted for delivery.' : ' Your request was accepted, but the acknowledgement could not be confirmed.' : ''} Keep this reference. This is not a confirmed quotation or booking.`;
  } catch (error) {
    status.textContent = error.message === 'Failed to fetch' ? 'The connection was interrupted and delivery is uncertain. Keep this page open and retry with the same details, or contact us directly.' : error.message;
  } finally {
    sending = false; turnstileToken = ''; lockForm(finished);
    submit.textContent = finished ? 'Request recorded — see status' : 'Send quote request';
    if (widgetId !== undefined) window.turnstile.reset(widgetId);
    refresh(); status.focus();
  }
});
renderResults(); refresh(); loadConfig();
document.querySelector('#wizard-content').hidden = false;
