import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleQuote} from '../server/quote.mjs';
import {VERSION} from '../js/pricing-catalogue.mjs';
import {unseal} from '../server/enquiry-store.mjs';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of ['quote-guard.sql','migrations/0001-website-quote-numbering.sql','migrations/0002-website-enquiry-storage.sql'])sql.exec(readFileSync(new URL('../server/'+file,import.meta.url),'utf8'));
 const state={sql,fault:null,mails:[],mode:'ok'};
 const prepare=query=>{let args=[];const stmt={bind(...values){args=values;return stmt;},first:async()=>sql.prepare(query).get(...args),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),execute:()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),query};return stmt;};
 const db={prepare,batch:async statements=>{if(state.fault&&statements.some(s=>s.query.includes(state.fault))){state.fault=null;throw new Error('synthetic crash');}sql.exec('BEGIN');try{const r=statements.map(s=>s.execute());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const env={SITE_ORIGIN:'https://example.invalid',BREVO_API_KEY:'synthetic',TURNSTILE_SECRET_KEY:'synthetic',TURNSTILE_SITE_KEY:'synthetic',QUOTE_FROM_EMAIL:'sender@example.invalid',QUOTE_TO_EMAIL:'owner@example.invalid',QUOTE_HASH_SECRET:'synthetic-only-'.repeat(4),QUOTE_GUARD:db,QUOTE_SITE_NUMBERING_ENABLED:'true',QUOTE_DURABLE_ENABLED:'true',INTAKE_SOURCE_ID:'synthetic',INTAKE_KEY_VERSION:'test',INTAKE_ENCRYPTION_KEYS:JSON.stringify({test:Buffer.alloc(32,7).toString('base64')})};
 const body={name:'Synthetic privacy sentinel',phone:'0830000000',email:'',area:'Castlebar',consent:true,version:VERSION,items:[{id:'wifi-printer',quantity:1,materials:'yes',options:{}}],requestId:crypto.randomUUID(),turnstileToken:'synthetic'};
 const fetcher=async(url,options)=>{if(url.includes('siteverify'))return Response.json({success:true,hostname:'example.invalid',action:'quote'});state.mails.push(JSON.parse(options.body));if(state.mode==='ackFail' && state.mails.length>1)return Response.json({error:'synthetic'},{status:503});if(state.mode==='timeout')throw new Error('Synthetic privacy sentinel');if(state.mode==='fail')return Response.json({error:'Synthetic privacy sentinel'},{status:503});return Response.json({messageId:'synthetic'});};
 const call=(value=body)=>handleQuote({request:new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(value)}),env},fetcher);
 return {...state,env,body,call,shared:state,count:t=>sql.prepare('SELECT count(*) n FROM '+t).get().n};
}
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
 const s=setup();s.env.QUOTE_DURABLE_ENABLED='false';const a=await(await s.call()).json();s.env.QUOTE_DURABLE_ENABLED='true';const b=await(await s.call()).json();assert.equal(a.reference,b.reference);assert.equal(b.duplicate,true);assert.equal(s.count('website_enquiries'),0);assert.equal(s.shared.mails.length,1);
 const t=setup();t.env.QUOTE_DURABLE_ENABLED='false';t.shared.mode='fail';await t.call();t.env.QUOTE_DURABLE_ENABLED='true';assert.equal((await t.call()).status,409);assert.equal(t.shared.mails.length,1);
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
 const s=setup();s.shared.fault='UPDATE enquiry_outbox SET state=';assert.equal((await s.call()).status,502);assert.equal(s.shared.mails.length,1);assert.equal((await s.call()).status,409);assert.equal(s.shared.mails.length,1);assert.equal(s.count('website_enquiries'),1);
});
test('customer acknowledgement failure preserves business success and is never resent',async()=>{
 const s=setup();s.body.email='customer@example.invalid';s.shared.mode='ackFail';const base=s.call;
 // A failed acknowledgement never resends the accepted business email.
 const first=await(await base()).json();assert.equal(first.ok,true);assert.equal(first.acknowledgement,false);const repeated=await(await base()).json();assert.equal(repeated.ok,true);assert.equal(repeated.acknowledgement,false);assert.equal(s.shared.mails.length,2);assert.equal(s.count('enquiry_outbox'),3);
});
test('ciphertext tampering fails closed without mail replay or sensitive error output',async()=>{
 const s=setup();s.shared.fault='INSERT INTO quote_reference_counters';await s.call();s.sql.exec("UPDATE website_enquiries SET encrypted_payload='{}'");const r=await s.call();assert.equal(r.status,502);assert.ok(!JSON.stringify(await r.json()).includes(s.body.name));assert.equal(s.shared.mails.length,0);
});