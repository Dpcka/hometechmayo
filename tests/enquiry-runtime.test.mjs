import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
test('isolated workerd runtime exercises actual D1 bindings without remote resources',{skip:!process.env.HBM_MINIFLARE_MODULE},async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(process.env.HBM_MINIFLARE_MODULE).href);
 const moduleFiles=['tests/intake-runtime-harness.mjs','server/quote.mjs','server/enquiry-store.mjs','server/durable-quote.mjs','server/intake-contract.mjs','server/quote-numbering.mjs','server/quote-emails.mjs','server/enquiry-dispatcher.mjs','js/pricing-catalogue.mjs'];
 const mf=new Miniflare(convertV4MiniflareOptions({modules:moduleFiles.map(p=>({type:'ESModule',path:fileURLToPath(new URL('../'+p,import.meta.url)),contents:readFileSync(new URL('../'+p,import.meta.url),'utf8')})),compatibilityDate:'2026-11-15',d1Databases:{QUOTE_GUARD:'isolated-intake-runtime'},d1Persist:false,bindings:{SITE_ORIGIN:'https://example.invalid',BREVO_API_KEY:'synthetic',TURNSTILE_SECRET_KEY:'synthetic',TURNSTILE_SITE_KEY:'synthetic',QUOTE_FROM_EMAIL:'sender@example.invalid',QUOTE_TO_EMAIL:'owner@example.invalid',QUOTE_HASH_SECRET:'synthetic-only-'.repeat(4),QUOTE_SITE_NUMBERING_ENABLED:'true',INTAKE_KEY_VERSION:'test',INTAKE_ENCRYPTION_KEYS:JSON.stringify({test:Buffer.alloc(32,7).toString('base64')})},outboundService:()=>new Response('External network blocked',{status:503})}));
 try{
 const db=await mf.getD1Database('QUOTE_GUARD');
 for(const f of ['quote-guard.sql','migrations/0001-website-quote-numbering.sql','migrations/0002-website-enquiry-storage.sql','migrations/0003-enquiry-lease-safety.sql','migrations/0004-enquiry-recovery-backoff.sql']){const sql=readFileSync(new URL('../server/'+f,import.meta.url),'utf8').replace(/--[^\n]*/g,'');for(const s of sql.split(';').filter(s=>s.trim()))await db.prepare(s).run();}
 await db.prepare('CREATE TABLE runtime_provider_commits(source TEXT NOT NULL)').run();
 const call=async(path,source,rest={})=>{const r=await mf.dispatchFetch('http://local.invalid'+path,{method:'POST',body:JSON.stringify({source,...rest})});return {status:r.status,body:await r.json()};};
 const commits=async source=>(await db.prepare('SELECT count(*) n FROM runtime_provider_commits WHERE source=?').bind(source).first()).n;
 const state=async source=>db.prepare("SELECT o.delivery_state FROM enquiry_outbox o JOIN website_enquiries e ON e.request_key=o.request_key WHERE e.source_id=? AND o.destination='BUSINESS_EMAIL'").bind(source).first();
 const now=Date.now();
 await call('/seed','parallel');await Promise.all([call('/dispatch','parallel'),call('/dispatch','parallel')]);assert.equal(await commits('parallel'),1);assert.equal((await state('parallel')).delivery_state,'DELIVERED');await call('/dispatch','parallel');assert.equal(await commits('parallel'),1);
 const stored=await db.prepare("SELECT encrypted_payload FROM website_enquiries WHERE source_id='parallel'").first();assert.ok(!stored.encrypted_payload.includes('Synthetic runtime sentinel'));
 await call('/seed','lease');await call('/claim','lease',{now});await call('/dispatch','lease',{now:now+121000});assert.equal(await commits('lease'),1);
 await call('/seed','uncertain');await call('/claim','uncertain',{now,started:true});await call('/dispatch','uncertain',{now:now+121000});assert.equal((await state('uncertain')).delivery_state,'NEEDS_REVIEW');assert.equal(await commits('uncertain'),0);
 await call('/seed','timeout');await call('/dispatch','timeout',{mode:'timeout'});await call('/dispatch','timeout',{now:now+3600000});assert.equal(await commits('timeout'),1);assert.equal((await state('timeout')).delivery_state,'NEEDS_REVIEW');
 await call('/seed','limited');await call('/dispatch','limited',{now,mode:'429'});await call('/dispatch','limited',{now:now+60000});assert.equal(await commits('limited'),0);await call('/dispatch','limited',{now:now+121000});assert.equal(await commits('limited'),1);
 await call('/seed','rotated');await call('/dispatch','rotated',{rotate:true});assert.equal(await commits('rotated'),1);
 await call('/seed','off');await call('/dispatch','off',{disabled:true});assert.equal(await commits('off'),0);assert.equal((await state('off')).delivery_state,'READY');
 await call('/seed','recovery',{beforeNumber:true});await call('/dispatch','recovery');assert.equal(await commits('recovery'),1);
 const submit=await call('/submit','browser',{requestId:crypto.randomUUID()});assert.equal(submit.body.ok,true);const requestId=crypto.randomUUID();const a=await call('/submit','rollback',{requestId});const b=await call('/submit','rollback',{requestId,captureOff:true});assert.equal(a.body.reference,b.body.reference);assert.equal(await commits('rollback'),1);
 await call('/rollback','transaction');assert.equal(await commits('transaction'),0);
 }finally{await mf.dispose();}
});
