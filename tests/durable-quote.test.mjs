import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleQuote} from '../server/quote.mjs';
import {VERSION} from '../js/pricing-catalogue.mjs';
import {unseal} from '../server/enquiry-store.mjs';
import {setup} from './intake-fixture.mjs';

test('same identity replays success; changed payload conflicts; only one Q-SITE',async()=>{
 const s=setup(),a=await (await s.call()).json(),b=await(await s.call()).json();assert.equal(a.ok,true);assert.equal(a.reference,b.reference);assert.equal(b.duplicate,true);assert.equal(s.shared.mails.length,1);assert.equal((await s.call({...s.body,name:'Changed synthetic'})).status,409);assert.equal(s.count('website_enquiries'),1);assert.equal(s.count('quote_public_references'),1);assert.equal(s.count('enquiry_outbox'),2);
 const row=s.sql.prepare('SELECT * FROM website_enquiries').get();const p=await unseal(s.env,row);assert.equal(p.contacts.name,s.body.name);assert.ok(!row.encrypted_payload.includes(s.body.name));
});
test('parallel identical requests never duplicate number or email',async()=>{
 const s=setup(),r=await Promise.all([s.call(),s.call(),s.call()]);assert.ok(r.some(x=>x.status===200));assert.equal(s.count('website_enquiries'),1);assert.equal(s.count('quote_public_references'),1);assert.equal(s.shared.mails.length,1);
});
for(const [label,fault] of [['before numbering','INSERT INTO quote_reference_counters'],['after numbering','UPDATE website_enquiries']])test('crash '+label+' recovers retained payload and same Q-SITE',async()=>{
 const s=setup();s.shared.fault=fault;assert.equal((await s.call()).status,502);assert.equal(s.count('website_enquiries'),1);assert.equal(s.shared.mails.length,0);assert.equal((await s.call()).status,200);assert.equal((await s.call()).status,200);assert.equal(s.count('quote_public_references'),1);assert.equal(s.shared.mails.length,1);assert.equal(s.count('enquiry_outbox'),2);
});
for(const mode of ['fail','timeout'])test('Brevo '+mode+' preserves payload and does not blindly resend',async()=>{
 const s=setup();s.shared.mode=mode;const r=await s.call();assert.equal(r.status,502);assert.ok(!JSON.stringify(await r.json()).includes(s.body.name));assert.equal((await s.call()).status,409);assert.equal(s.count('website_enquiries'),1);assert.equal(s.shared.mails.length,1);assert.equal(s.sql.prepare("SELECT state FROM enquiry_outbox WHERE destination='BUSINESS_EMAIL'").get().state,'UNCERTAIN');
});
test('atomic capture rollback leaves no reservation, payload or number',async()=>{
 const s=setup();s.shared.fault='INSERT INTO website_enquiries';assert.equal((await s.call()).status,503);assert.equal(s.count('quote_guard'),0);assert.equal(s.count('website_enquiries'),0);assert.equal(s.count('quote_public_references'),0);assert.equal((await s.call()).status,200);
});
test('guard cleanup cannot remove durable payload or reuse its Q-SITE',async()=>{
 const s=setup();const a=await(await s.call()).json();s.sql.exec('DELETE FROM quote_guard');assert.equal(s.count('quote_public_references'),0);const b=await(await s.call()).json();assert.equal(b.reference,a.reference);assert.equal(s.shared.mails.length,1);assert.equal(s.sql.prepare('SELECT last_sequence FROM quote_reference_counters').get().last_sequence,1);
});
test('legacy sent and uncertain requests remain compatible without inventing payload',async()=>{
 const s=setup();s.env.QUOTE_DURABLE_ENABLED='false';delete s.env.INTAKE_SOURCE_ID;const a=await(await s.call()).json();s.env.QUOTE_DURABLE_ENABLED='true';s.env.INTAKE_SOURCE_ID='synthetic';const b=await(await s.call()).json();assert.equal(a.reference,b.reference);assert.equal(b.duplicate,true);assert.equal(s.count('website_enquiries'),0);assert.equal(s.shared.mails.length,1);
 const t=setup();t.env.QUOTE_DURABLE_ENABLED='false';delete t.env.INTAKE_SOURCE_ID;t.shared.mode='fail';await t.call();t.env.QUOTE_DURABLE_ENABLED='true';t.env.INTAKE_SOURCE_ID='synthetic';assert.equal((await t.call()).status,409);assert.equal(t.shared.mails.length,1);
});
test('missing crypto key fails closed before reservation and mail',async()=>{
 const s=setup();delete s.env.INTAKE_ENCRYPTION_KEYS;assert.equal((await s.call()).status,503);assert.equal(s.count('quote_guard'),0);assert.equal(s.shared.mails.length,0);
});
test('logs contain no customer payload on failing delivery',async()=>{
 const s=setup(),logs=[],original=console.error;console.error=(...a)=>logs.push(a);try{s.shared.mode='timeout';await s.call();assert.equal(logs.length,0);}finally{console.error=original;}
});

test('concurrent changed payload cannot overwrite the winning encrypted record',async()=>{
 const s=setup();const r=await Promise.all([s.call(),s.call({...s.body,name:'Other synthetic'})]);assert.ok(r.some(x=>x.status===200));assert.ok(r.some(x=>x.status===409));assert.equal(s.count('website_enquiries'),1);assert.equal(s.count('quote_public_references'),1);assert.equal(s.shared.mails.length,1);
});
test('crash recording provider acceptance remains conservative, no duplicate mail',async()=>{
 const s=setup();s.shared.fault='UPDATE enquiry_outbox SET state=?,delivery_state=';assert.equal((await s.call()).status,502);assert.equal(s.shared.mails.length,1);assert.equal((await s.call()).status,409);assert.equal(s.shared.mails.length,1);assert.equal(s.count('website_enquiries'),1);
});
test('customer acknowledgement failure preserves business success and is never resent',async()=>{
 const s=setup();s.body.email='customer@example.invalid';s.shared.mode='ackFail';const base=s.call;
 // A failed acknowledgement never resends the accepted business email.
 const first=await(await base()).json();assert.equal(first.ok,true);assert.equal(first.acknowledgement,false);const repeated=await(await base()).json();assert.equal(repeated.ok,true);assert.equal(repeated.acknowledgement,false);assert.equal(s.shared.mails.length,2);assert.equal(s.count('enquiry_outbox'),3);
});
test('ciphertext tampering fails closed without mail replay or sensitive error output',async()=>{
 const s=setup();s.shared.fault='INSERT INTO quote_reference_counters';await s.call();s.sql.exec("UPDATE website_enquiries SET encrypted_payload='{}'");const r=await s.call();assert.equal(r.status,502);assert.ok(!JSON.stringify(await r.json()).includes(s.body.name));assert.equal(s.shared.mails.length,0);
});
test('rollback flag retains durable receipt after guard cleanup and cannot send new email-only requests',async()=>{
 const s=setup();const a=await(await s.call()).json();s.sql.exec('DELETE FROM quote_guard');s.env.QUOTE_DURABLE_ENABLED='false';const b=await(await s.call()).json();assert.equal(b.reference,a.reference);assert.equal(s.shared.mails.length,1);assert.equal((await s.call({...s.body,requestId:crypto.randomUUID()})).status,503);
});
