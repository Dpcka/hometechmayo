import {CATALOGUE, BY_ID, AREAS, MATERIALS, VERSION, calculate, money} from './pricing-catalogue.mjs';
import {QUOTE_CATEGORIES, categoryById} from './quote-categories.mjs';

const form = document.querySelector('#quote-form');
const category = document.querySelector('#service-category');
const search = document.querySelector('#service-search');
const results = document.querySelector('#service-results');
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
    const add = el('button', 'Add', 'calc-add');
    add.type = 'button'; add.dataset.add = service.id;
    add.disabled = basket.has(service.id) && (service.kind === 'package' || basket.get(service.id).quantity >= 100);
    add.setAttribute('aria-label', `Add ${service.name}`);
    add.addEventListener('click', () => addService(service));
    const actions = el('div', undefined, 'service-add-actions');
    const count = el('span', '', 'service-added'); count.dataset.added = service.id;
    count.setAttribute('role', 'status');
    actions.append(add, count); card.append(info, actions); results.append(card);
  }
  syncAddButtons();
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
function removeService(id) {
  const focused = document.activeElement;
  const fromCart = focused?.closest('[data-cart-service]');
  const activeSummary = focused?.closest('.calc-summary');
  const nextInput = fromCart?.nextElementSibling?.querySelector('input') || fromCart?.previousElementSibling?.querySelector('input');
  basket.delete(id);
  renderMaterials(); renderResults(); refresh();
  if (fromCart) (nextInput || activeSummary.querySelector('summary')).focus({preventScroll: true});
  else (results.querySelector(`[data-add="${id}"]`) || category).focus();
}
function updateQuantity(id, value) {
  const item = basket.get(id);
  if (!item || sending || finished) return;
  if (value === 0) {removeService(id); return;}
  // Keep invalid drafts visible and let the authoritative engine reject them.
  // No estimate or submission may use the previous quantity instead.
  item.quantity = value;
  refresh();
}
function syncAddButtons() {
  for (const button of results.querySelectorAll('[data-add]')) {
    const service = BY_ID.get(button.dataset.add), item = basket.get(service.id);
    button.disabled = Boolean(item && (service.kind === 'package' || item.quantity >= 100));
    const count = results.querySelector(`[data-added="${service.id}"]`);
    count.textContent = item ? `Added: ${Number.isFinite(item.quantity) ? item.quantity : '—'}` : '';
  }
}

function addService(service) {
  if (basket.has(service.id)) {
    if (service.kind !== 'package') updateQuantity(service.id, Math.min(100, Math.round(((basket.get(service.id).quantity || 0) + 1) * 10) / 10));
    return;
  }
  const item = {id: service.id, quantity: 1, materials: 'unsure', options: {}};
  for (const [key, def] of Object.entries(service.options)) item.options[key] = def.number ? 0 : def.choices[0].value;
  basket.set(service.id, item);
  clearError(); renderMaterials(); refresh();
}

// One native modal editor, opened only from a selected service in the cart.
// Its controls are outside the customer form and never add fields to its payload.
const editor = document.querySelector('#service-editor');
const editorControls = document.querySelector('#service-editor-controls');
let editorServiceId, editorTrigger;
function closeEditor() {
  for (const input of editorControls.querySelectorAll('input, select')) {
    if (!input.reportValidity()) return;
  }
  editor.close();
}
document.querySelector('#service-editor-done').addEventListener('click', closeEditor);
editor.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('input')) {event.preventDefault(); closeEditor();}
  if (event.key === 'Tab') {
    const controls = [...editor.querySelectorAll('input, select, button')].filter(node => !node.disabled && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
  }
});
editor.addEventListener('close', () => {
  editorServiceId = undefined;
  if (editorTrigger?.isConnected) editorTrigger.focus({preventScroll: true});
});
function openEditor(id, trigger) {
  if (sending || finished || !basket.has(id)) return;
  const item = basket.get(id), service = BY_ID.get(id);
  editorServiceId = id; editorTrigger = trigger;
  document.querySelector('#service-editor-title').textContent = service.name;
  editorControls.replaceChildren();
  document.querySelector('#service-editor-note').textContent = service.note || '';
  document.querySelector('#service-editor-note').hidden = !service.note;
  const controls = {};
  function syncBundle() {
    if (id === 'tv-mount' && controls.cables) {
      const bundled = item.options.installation === 'inclusive';
      controls.cables.closest('label').hidden = bundled;
      controls.cables.disabled = bundled;
    }
  }
  for (const [key, def] of Object.entries(service.options)) {
    let input;
    if (def.number) {
      input = el('input'); input.type = 'number'; input.min = '0'; input.max = '24'; input.step = '1';
      input.value = String(item.options[key]); input.required = true;
    } else input = select(def.choices.map(choice => [choice.value, choice.label]), item.options[key]);
    field(editorControls, def.label, input); input.dataset.serviceOption = key; controls[key] = input;
    input.addEventListener(def.number ? 'input' : 'change', () => {
      // Invalid option drafts are not applied. Escape dismisses such a draft;
      // Done requires validity, while all valid edits apply immediately.
      input.setAttribute('aria-invalid', String(!input.validity.valid));
      if (!input.validity.valid) return;
      item.options[key] = def.number ? input.valueAsNumber : input.value;
      syncBundle(); refresh();
    });
  }
  syncBundle(); refresh(); editor.showModal();
}

for (const [name, cost] of Object.entries(AREAS)) {
  const option = el('option', cost === null ? 'Other areas — Custom travel quote' : `${name} — ${money(cost)} travel`);
  option.value = name; area.append(option);
}
area.addEventListener('change', refresh);
// Each step shares the same basket and opens the same service-options editor.
const summaryNodes = ['order-summary', 'estimate-summary', 'final-summary'].map(id => document.getElementById(id));
const compactSummary = window.matchMedia('(max-width: 900px)');
function setupSummary(node) {
  const disclosure = el('details', undefined, 'cart-disclosure');
  disclosure.open = !compactSummary.matches;
  const heading = el('summary', undefined, 'cart-heading');
  const title = el('span', undefined, 'cart-heading-label');
  title.append(el('strong', 'Order summary'), el('span', '', 'cart-count'));
  const amount = el('span', undefined, 'cart-heading-total');
  const total = el('span', '—', 'estimate-amount');
  total.setAttribute('aria-live', 'polite'); total.setAttribute('aria-atomic', 'true');
  amount.append(el('span', 'Known labour', 'cart-total-label'), total);
  heading.append(title, amount);
  const body = el('div', undefined, 'cart-body');
  disclosure.append(heading, body); node.replaceChildren(disclosure);
}
for (const node of summaryNodes) setupSummary(node);
for (const button of document.querySelectorAll('[data-open-summary]')) button.addEventListener('click', () => {
  const node = summaryNodes[step - 1];
  node.querySelector('details').open = true;
  node.scrollIntoView({block: 'start', behavior: 'instant'});
  node.querySelector('summary').focus({preventScroll: true});
});
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
  node.querySelector('.cart-count').textContent = `${basket.size} service${basket.size === 1 ? '' : 's'}`;
  node.querySelector('.cart-total-label').textContent = area.value ? 'Estimated known total' : 'Known labour · travel pending';
  const amount = node.querySelector('.estimate-amount');
  const incomplete = estimate && (estimate.incomplete || !area.value);
  amount.textContent = estimate ? `${money(estimate.total)}${incomplete ? '+' : ''}` : '—';
  let table = body.querySelector('.cart-table');
  if (!table) {
    table = el('table', undefined, 'cart-table');
    table.append(el('caption', 'Starting labour prices including selected options, before discounts and the visit minimum. Set quantity to zero to remove a service.', 'cart-sr-only'));
    const columns = el('colgroup');
    for (const name of ['service', 'quantity', 'line']) columns.append(el('col', undefined, `cart-col-${name}`));
    const head = el('thead'), header = el('tr');
    for (const label of ['Service', 'Qty', 'Line total']) {
      const cell = el('th', label); cell.scope = 'col'; header.append(cell);
    }
    head.append(header); table.append(columns, head, el('tbody'));
    body.append(table, el('div', undefined, 'cart-breakdown'));
    const hint = el('p', 'Select an underlined service name to edit its options or view details.', 'cart-note');
    hint.classList.add('cart-options-hint'); body.append(hint);
  }
  table.hidden = !basket.size;
  body.querySelector('.cart-options-hint').hidden = ![...basket.keys()].some(id => Object.keys(BY_ID.get(id).options).length || BY_ID.get(id).note);
  const rows = table.querySelector('tbody');
  for (const row of [...rows.children]) if (!basket.has(row.dataset.cartService)) row.remove();
  for (const item of basket.values()) {
    const service = BY_ID.get(item.id);
    const line = estimate?.lines.find(line => line.id === item.id);
    let row = [...rows.children].find(row => row.dataset.cartService === item.id);
    if (!row) {
      row = el('tr'); row.dataset.cartService = item.id;
      const name = el('th', undefined, 'cart-service-name'); name.scope = 'row';
      if (Object.keys(service.options).length || service.note) {
        const edit = el('button', service.name, 'cart-service-edit'); edit.type = 'button';
        edit.setAttribute('aria-label', `Options and details for ${service.name}`);
        edit.setAttribute('aria-haspopup', 'dialog'); edit.setAttribute('aria-controls', 'service-editor');
        edit.addEventListener('click', () => openEditor(item.id, edit)); name.append(edit);
      } else name.append(el('span', service.name));
      name.append(el('span', '', 'cart-unit-price'));
      const quantity = el('td', undefined, 'cart-quantity');
      const control = el('div', undefined, 'cart-quantity-control');
      const input = el('input'); input.type = 'number'; input.required = true;
      input.min = '0'; input.max = service.kind === 'package' ? '1' : '100';
      input.step = service.unit ? '0.1' : '1'; input.inputMode = service.unit ? 'decimal' : 'numeric';
      input.dataset.quantity = item.id;
      input.setAttribute('aria-label', `${service.unit ? 'Area in square metres' : service.kind === 'hourly' ? 'Hours' : 'Quantity'} for ${service.name}; zero removes service`);
      input.addEventListener('input', () => updateQuantity(item.id, input.valueAsNumber));
      // Enter in a quantity input must not submit the customer form.
      input.addEventListener('keydown', event => {if (event.key === 'Enter') {event.preventDefault(); input.reportValidity();}});
      for (const [label, direction] of [['−', -1], ['+', 1]]) {
        const button = el('button', label); button.type = 'button';
        button.dataset.quantityDirection = direction;
        button.setAttribute('aria-label', `${direction < 0 ? 'Decrease' : 'Increase'} quantity for ${service.name}`);
        button.addEventListener('click', () => updateQuantity(item.id, Math.max(0, Math.min(Number(input.max), Math.round(((item.quantity || 0) + direction * Number(input.step)) * 10) / 10))));
        control.append(button);
        if (direction < 0) control.append(input);
      }
      quantity.append(control);
      row.append(name, quantity, el('td', '', 'cart-line-price')); rows.append(row);
    }
    const input = row.querySelector('input');
    // Leave the active draft untouched, including an empty or partially typed number.
    if (document.activeElement !== input) input.value = Number.isFinite(item.quantity) ? String(item.quantity) : '';
    input.setAttribute('aria-invalid', String(!input.validity.valid));
    row.querySelector('[data-quantity-direction="1"]').disabled = item.quantity >= Number(input.max);
    const suffix = service.unit ? ` / ${service.unit}` : service.kind === 'hourly' ? ' / h' : '';
    row.querySelector('.cart-unit-price').textContent = line
      ? `${line.customWork && !line.known ? 'Quote' : `${money(line.known / line.quantity)}${line.customWork ? '+' : ''}`}${suffix}` : priceLabel(service);
    row.querySelector('.cart-line-price').textContent = line
      ? line.customWork && !line.known ? 'Quote' : `${money(line.known)}${line.customWork ? '+' : ''}` : '—';
  }
  const breakdown = body.querySelector('.cart-breakdown');
  breakdown.replaceChildren();
  if (!estimate) {
    breakdown.append(el('p', basket.size ? 'Enter a valid quantity (up to 100; packages: 1). Use whole units, or increments of 0.1 m² for flooring. Set zero to remove a service. Check service options too.' : 'Add services to build your estimate.', 'cart-note'));
    return;
  }
  const totals = el('dl', undefined, 'calc-totals');
  for (const [label, value] of [
    ['Labour', money(estimate.labour)], [`Discount (${estimate.discountPercent}%)`, `−${money(estimate.discount)}`],
    ['Minimum labour adjustment', money(estimate.minimumAdjustment)],
    [area.value ? `Travel · ${estimate.area}` : 'Travel', !area.value ? 'Choose area in step 2' : estimate.travel === null ? 'Custom Quote — excluded' : money(estimate.travel)],
    ['Materials', estimate.lines.some(line => line.materialUnknown) ? 'Unconfirmed costs excluded' : 'Customer supplied / included']
  ]) totals.append(el('dt', label), el('dd', value));
  breakdown.append(totals);
  if (estimate.customOnly) breakdown.append(el('p', 'Labour needs a Custom Quote; minimum €50 per visit.', 'cart-note'));
  if (incomplete) breakdown.append(el('p', '+ excludes custom work, unknown materials and/or unconfirmed travel. Quote means Custom Quote, not zero-cost work.', 'cart-note'));
  breakdown.append(el('p', 'Unit and line prices include selected options, before discounts. Indicative only; one visit, subject to confirmation.', 'cart-note'));
  if (!final) breakdown.append(el('p', `${estimate.eligibleUnits} qualifying main units. Add-ons do not increase the discount tier.`, 'cart-note'));
}
function refresh() {
  const count = basket.size;
  syncAddButtons();
  let estimate;
  if (count) {
    // Before step 2, show known labour only and explicitly mark travel pending.
    try {estimate = calculate(items(), area.value || 'Castlebar');} catch { /* Navigation exposes the actionable selection error. */ }
  }
  renderEstimate(summaryNodes[0], estimate);
  renderEstimate(summaryNodes[1], estimate);
  renderEstimate(summaryNodes[2], estimate, true);
  if (editorServiceId) {
    const line = estimate?.lines.find(line => line.id === editorServiceId);
    document.querySelector('#service-editor-estimate').textContent = line
      ? `Service labour before discounts and visit minimum: ${line.customWork && !line.known ? 'Custom Quote' : `${money(line.known)}${line.customWork ? '+ (custom work excluded)' : ''}`}.`
      : 'Check the service quantities and options to see the estimate.';
  }
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
