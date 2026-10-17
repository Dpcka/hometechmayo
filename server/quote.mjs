import {calculate, VERSION} from '../js/pricing-catalogue.mjs';
import {createQuoteEmails} from './quote-emails.mjs';

export const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
export function configured(env) {
  return Boolean(env.BREVO_API_KEY && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.QUOTE_GUARD && env.QUOTE_HASH_SECRET?.length >= 32 && env.SITE_ORIGIN && EMAIL.test(env.QUOTE_FROM_EMAIL || '') && EMAIL.test(env.QUOTE_TO_EMAIL || '') && !/[\r\n]/.test((env.QUOTE_FROM_NAME || '') + env.QUOTE_FROM_EMAIL + env.QUOTE_TO_EMAIL));
}
export function publicConfig(env) {
  return json({enabled: configured(env), siteKey: configured(env) ? env.TURNSTILE_SITE_KEY : null, version: VERSION});
}
function field(input, key, max, required = false, multiline = false) {
  const value = input[key] ?? '';
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || (!multiline && /[\r\n]/.test(value))) throw new Error(`Check ${key}.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${key} is required.`);
  return result;
}
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request.');
  const customer = {
    name: field(body, 'name', 100, true), phone: field(body, 'phone', 40, true),
    email: field(body, 'email', 254), eircode: field(body, 'eircode', 10).toUpperCase(),
    description: field(body, 'description', 3000, false, true), availability: field(body, 'availability', 300),
    materialsInformation: field(body, 'materialsInformation', 1000, false, true)
  };
  if (!/^[+()\d .-]{7,40}$/.test(customer.phone) || customer.phone.replace(/\D/g, '').length < 7) throw new Error('Enter a valid phone number.');
  if (customer.email && !EMAIL.test(customer.email)) throw new Error('Enter a valid email address.');
  if (customer.eircode && !/^[A-Z][0-9A-Z]{2}\s?[0-9A-Z]{4}$/.test(customer.eircode)) throw new Error('Enter a valid Eircode or leave it blank.');
  if (body.consent !== true) throw new Error('Privacy consent is required.');
  if (body.website) throw new Error('Submission rejected.');
  if (body.version !== VERSION) throw new Error('The price catalogue has changed. Reload this page before requesting a quote.');
  if (!Array.isArray(body.items) || !body.items.length) throw new Error('Add at least one service.');
  if (typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new Error('Invalid request identifier.');
  const estimate = calculate(body.items, body.area);
  return {customer, estimate, consent: true, version: VERSION};
}
async function digest(secret, text) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(text)))).map(x => x.toString(16).padStart(2, '0')).join('');
}
async function limitedJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Use a JSON request.');
  if (Number(request.headers.get('content-length') || 0) > 32768) throw new Error('Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body is required.');
  let size = 0, chunks = [];
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {await reader.cancel(); throw new Error('Request is too large.');}
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {all.set(chunk, offset); offset += chunk.length;}
  return JSON.parse(new TextDecoder().decode(all));
}
export async function sendMail(env, message, fetcher) {
  const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: {'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json'},
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({sender: {email: env.QUOTE_FROM_EMAIL, name: env.QUOTE_FROM_NAME || 'Home Tech Solutions & Services'}, ...message})
  });
  if (!response.ok) throw new Error('Email provider rejected the request.');
  const result = await response.json();
  if (!result.messageId) throw new Error('Email provider acceptance could not be confirmed.');
}
export async function handleQuote({request, env}, fetcher = fetch) {
  if (request.method !== 'POST') return json({error: 'Method not allowed.'}, 405);
  const origin = request.headers.get('origin');
  if (!env.SITE_ORIGIN || origin !== env.SITE_ORIGIN || new URL(request.url).origin !== env.SITE_ORIGIN) return json({error: 'This request origin is not allowed.'}, 403);
  let body, validated;
  try {body = await limitedJSON(request); validated = validate(body);} catch (error) {return json({error: error instanceof SyntaxError ? 'Invalid JSON request.' : error.message}, 400);}
  if (!configured(env)) return json({error: 'Online quote requests are not configured yet. Please email info@hometechmayo.ie or call 083 349 8496.'}, 503);
  let reservation;
  try {
    const normalized = {...validated, estimate: {...validated.estimate, lines: [...validated.estimate.lines].sort((a, b) => a.id.localeCompare(b.id))}};
    const payloadHash = await digest(env.QUOTE_HASH_SECRET, JSON.stringify(normalized));
    const key = await digest(env.QUOTE_HASH_SECRET, body.requestId);
    const ipHash = await digest(env.QUOTE_HASH_SECRET, request.headers.get('CF-Connecting-IP') || 'unknown');
    const now = Date.now();
    const previous = await env.QUOTE_GUARD.prepare('SELECT * FROM quote_guard WHERE request_key = ?').bind(key).first();
    if (previous) {
      if (previous.payload_hash !== payloadHash) return json({error: 'This request identifier was already used for different details. Reload the page.'}, 409);
      if (previous.status === 'sent') return json({ok: true, reference: previous.reference, acknowledgement: previous.ack === 1, duplicate: true});
      return json({error: `Request ${previous.reference} is already being processed or its delivery is uncertain. Please contact us with this reference instead of submitting again.`, reference: previous.reference}, 409);
    }
    const token = field(body, 'turnstileToken', 2048, true);
    const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: request.headers.get('CF-Connecting-IP') || undefined})
    });
    if (!verification.ok) return json({error: 'Security verification is temporarily unavailable. Please try again.'}, 503);
    const check = await verification.json();
    if (!check.success || check.hostname !== new URL(env.SITE_ORIGIN).hostname || check.action !== 'quote') return json({error: 'Security verification failed or expired. Please complete it again.'}, 400);
    const reference = `HT-${new Date(now).toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    // One atomic INSERT reserves both the key and fingerprint and enforces an
    // hourly IP limit across isolates; no best-effort in-memory/KV lock.
    const results = await env.QUOTE_GUARD.batch([
      env.QUOTE_GUARD.prepare('DELETE FROM quote_guard WHERE created_at < ?').bind(now - 86400000),
      env.QUOTE_GUARD.prepare(`INSERT OR IGNORE INTO quote_guard (request_key, payload_hash, ip_hash, reference, created_at, status, ack)
        SELECT ?, ?, ?, ?, ?, 'pending', 0 WHERE
        (SELECT COUNT(*) FROM quote_guard WHERE ip_hash = ? AND created_at > ?) < 5`).bind(key, payloadHash, ipHash, reference, now, ipHash, now - 3600000)
    ]);
    if (results[1].meta.changes !== 1) return json({error: 'This enquiry was already submitted, or the submission limit was reached. Please wait or contact us by phone/email.'}, 429);
    reservation = {key, reference};
    const {customer: c, estimate} = validated;
    const emails = createQuoteEmails({customer:c, estimate, reference, receivedAt:now, version:VERSION}, env);
    await sendMail(env, emails.business, fetcher);
    // Record business acceptance BEFORE any customer acknowledgement. Never resend
    // the business request to recover an acknowledgement failure.
    await env.QUOTE_GUARD.prepare("UPDATE quote_guard SET status = 'sent' WHERE request_key = ?").bind(key).run();
    let acknowledgement = false;
    if (c.email) {
      try {
        await sendMail(env, emails.acknowledgement, fetcher);
        acknowledgement = true;
        await env.QUOTE_GUARD.prepare('UPDATE quote_guard SET ack = 1 WHERE request_key = ?').bind(key).run();
      } catch { /* Business request succeeded; tell the browser acknowledgement failed. */ }
    }
    return json({ok: true, reference, acknowledgement});
  } catch {
    // No provider response bodies, customer details or secrets are logged/returned.
    // Keep an uncertain reservation to prevent duplicate mail after timeout.
    return json({error: reservation ? `Delivery could not be confirmed for ${reservation.reference}. Please contact us with this reference; do not submit again.` : 'The quote service is temporarily unavailable. Please try later or email info@hometechmayo.ie.', ...(reservation ? {reference: reservation.reference} : {})}, reservation ? 502 : 503);
  }
}
