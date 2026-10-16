import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleQuote, validate, publicConfig} from '../server/quote.mjs';
import {VERSION} from '../js/pricing-catalogue.mjs';
function db() {
 const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('../server/quote-guard.sql', import.meta.url), 'utf8'));
 const prepare = query => ({bind(...args) {return {first: async () => sql.prepare(query).get(...args), run: async () => ({meta: {changes: Number(sql.prepare(query).run(...args).changes)}}), execute: () => ({meta: {changes: Number(sql.prepare(query).run(...args).changes)}})};}});
 return {prepare, batch: async statements => {sql.exec('BEGIN'); try {const r = statements.map(s => s.execute()); sql.exec('COMMIT'); return r;} catch (e) {sql.exec('ROLLBACK'); throw e;}}};
}
const payload = (extra = {}) => ({name: 'Test Customer', phone: '0831234567', email: '', eircode: '', area: 'Castlebar', consent: true, version: VERSION, items: [{id: 'wifi-printer', quantity: 1, materials: 'yes', options: {}}], requestId: crypto.randomUUID(), turnstileToken: 'test-token-only', ...extra});
const environment = () => ({SITE_ORIGIN: 'https://hometechmayo.ie', BREVO_API_KEY: 'test-only-not-a-real-key', TURNSTILE_SECRET_KEY: 'test-only', TURNSTILE_SITE_KEY: 'test-only', QUOTE_FROM_EMAIL: 'info@hometechmayo.ie', QUOTE_TO_EMAIL: 'info@hometechmayo.ie', QUOTE_HASH_SECRET: 'test-only-hmac-value-at-least-32-characters', QUOTE_GUARD: db()});
const request = (body, origin = 'https://hometechmayo.ie') => new Request('https://hometechmayo.ie/api/quote', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10'}, body: JSON.stringify(body)});
function provider({businessFail = false, ackFail = false, turnstile = {success: true, hostname: 'hometechmayo.ie', action: 'quote'}} = {}) {
 const mails = [];
 const fetcher = async (url, options) => {
  if (url.includes('siteverify')) return Response.json(turnstile);
  const mail = JSON.parse(options.body); mails.push(mail);
  if (businessFail || ackFail && mails.length > 1) return Response.json({error: 'provider details must not leak'}, {status: 500});
  return Response.json({messageId: 'test-message'});
 };
 return {mails, fetcher};
}
test('invalid and missing fields rejected server-side', () => {
 for (const fields of [{name: ''}, {phone: 'bad'}, {email: 'broken@'}, {email: 'a@example.com\r\nBcc: x'}, {consent: false}, {items: []}, {website: 'spam'}, {version: 'old'}, {eircode: '!!'}, {name: 'x\r\nheader'}]) assert.throws(() => validate(payload(fields)));
});
test('missing Brevo credentials safely return 503, never call provider', async () => {
 const env = environment(); delete env.BREVO_API_KEY;
 const r = await handleQuote({request: request(payload()), env}, () => {throw new Error('must not call provider');});
 assert.equal(r.status, 503); assert.equal((await publicConfig(env).json()).enabled, false); assert.match((await r.json()).error, /not configured/);
});
test('invalid origin, JSON, oversized body and method rejected', async () => {
 const env = environment();
 assert.equal((await handleQuote({request: request(payload(), 'https://evil.example'), env})).status, 403);
 const bad = new Request('https://hometechmayo.ie/api/quote', {method: 'POST', headers: {Origin: env.SITE_ORIGIN, 'Content-Type': 'application/json'}, body: '{'});
 assert.equal((await handleQuote({request: bad, env})).status, 400);
 assert.equal((await handleQuote({request: request(payload({description: 'a'.repeat(40000)})), env})).status, 400);
 assert.equal((await handleQuote({request: new Request('https://hometechmayo.ie/api/quote'), env})).status, 405);
});
test('Turnstile failure, wrong hostname and wrong action rejected', async () => {
 for (const t of [{success: false}, {success: true, hostname: 'evil.example', action: 'quote'}, {success: true, hostname: 'hometechmayo.ie', action: 'other'}]) {
  const p = provider({turnstile: t}); const r = await handleQuote({request: request(payload()), env: environment()}, p.fetcher); assert.equal(r.status, 400); assert.equal(p.mails.length, 0);
 }
});
test('authoritative itemised business mail only, optional email absent', async () => {
 const p = provider(), env = environment(); const r = await handleQuote({request: request(payload({total: 1})), env}, p.fetcher);
 assert.equal(r.status, 200); const result = await r.json(); assert.equal(result.ok, true); assert.match(result.reference, /^HT-/); assert.equal(p.mails.length, 1);
 assert.equal(p.mails[0].to[0].email, 'info@hometechmayo.ie'); assert.match(p.mails[0].textContent, /€50.00/); assert.equal(p.mails[0].htmlContent, undefined);
});
test('customer acknowledgement only when email supplied; no unsafe HTML', async () => {
 const p = provider(); const r = await handleQuote({request: request(payload({email: 'customer@example.com', name: '<script>test</script>'})), env: environment()}, p.fetcher);
 assert.equal((await r.json()).acknowledgement, true); assert.equal(p.mails.length, 2); assert.equal(p.mails[0].replyTo.email, 'customer@example.com'); assert.equal(p.mails[1].to[0].email, 'customer@example.com'); assert.equal(p.mails[0].htmlContent, undefined);
});
test('ack failure does not lose business success or resend business mail', async () => {
 const p = provider({ackFail: true}), env = environment(), body = payload({email: 'customer@example.com'});
 const first = await handleQuote({request: request(body), env}, p.fetcher); assert.equal((await first.json()).acknowledgement, false);
 const second = await handleQuote({request: request(body), env}, p.fetcher); assert.equal((await second.json()).ok, true); assert.equal(p.mails.length, 2);
});
test('business API failure never reports success and locks uncertain retries', async () => {
 const p = provider({businessFail: true}), env = environment(), body = payload();
 const r = await handleQuote({request: request(body), env}, p.fetcher); assert.equal(r.status, 502); const result = await r.json(); assert.equal(result.ok, undefined); assert.ok(result.reference); assert.doesNotMatch(result.error, /provider details/);
 assert.equal((await handleQuote({request: request(body), env}, p.fetcher)).status, 409); assert.equal(p.mails.length, 1);
});
test('same key with changed payload rejected; new key with same payload blocked', async () => {
 const p = provider(), env = environment(), body = payload();
 await handleQuote({request: request(body), env}, p.fetcher);
 assert.equal((await handleQuote({request: request({...body, name: 'Changed'}), env}, p.fetcher)).status, 409);
 assert.equal((await handleQuote({request: request({...body, requestId: crypto.randomUUID()}), env}, p.fetcher)).status, 429); assert.equal(p.mails.length, 1);
});
test('five requests per IP/hour; sixth blocked', async () => {
 const env = environment(), p = provider();
 for (let i = 0; i < 5; i++) assert.equal((await handleQuote({request: request(payload({name: `Customer ${i}`})), env}, p.fetcher)).status, 200);
 assert.equal((await handleQuote({request: request(payload({name: 'Sixth'})), env}, p.fetcher)).status, 429); assert.equal(p.mails.length, 5);
});
test('concurrent duplicates reserve once using real SQLite constraints', async () => {
 const env = environment(), p = provider(), body = payload();
 const responses = await Promise.all([handleQuote({request: request(body), env}, p.fetcher), handleQuote({request: request(body), env}, p.fetcher)]);
 assert.equal(p.mails.length, 1); assert.ok(responses.some(r => r.status === 200));
});
test('missing database fails closed without email or details leakage', async () => {
 const env = environment(); env.QUOTE_GUARD = {prepare() {throw new Error('private infrastructure details');}}; const p = provider();
 const r = await handleQuote({request: request(payload()), env}, p.fetcher); assert.equal(r.status, 503); assert.equal(p.mails.length, 0); assert.doesNotMatch((await r.json()).error, /private/);
});
