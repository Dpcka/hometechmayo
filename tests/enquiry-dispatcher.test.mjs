import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './intake-fixture.mjs';
import worker,{runDispatcher,retryTime} from '../server/enquiry-dispatcher.mjs';
import {claimDelivery,markDeliveryStarted,finishDelivery,seal} from '../server/enquiry-store.mjs';
async function seeded({email=false}={}){
 const s=setup();if(email)s.body.email='customer@example.invalid';
 s.shared.fault="UPDATE enquiry_outbox SET state='SENDING'";
 assert.equal((await s.call()).status,502);assert.equal(s.shared.mails.length,0);
 s.env.INTAKE_DISPATCHER_ENABLED='true';s.env.INTAKE_DISPATCHER_EMAIL_ENABLED='true';
 s.clock=Date.now()+1000;s.options={now:()=>s.clock,random:()=>0.5,fetcher:async()=>{s.shared.mails.push({synthetic:true});return Response.json({messageId:'synthetic-receipt'});}};
 s.state=dest=>s.sql.prepare('SELECT * FROM enquiry_outbox WHERE destination=?').get(dest);
 s.run=()=>runDispatcher(s.env,s.options);return s;
}
test('two dispatcher instances claim exactly one delivery; HBM never marked delivered',async()=>{
 const s=await seeded();await Promise.all([s.run(),s.run()]);assert.equal(s.shared.mails.length,1);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'DELIVERED');assert.equal(s.state('HBM').delivery_state,'READY');await s.run();assert.equal(s.shared.mails.length,1);
});
test('disabled dispatcher performs zero binding or network operations',async()=>{
 assert.deepEqual(await runDispatcher({INTAKE_DISPATCHER_ENABLED:'false',get QUOTE_GUARD(){throw new Error();}}),{disabled:true});
 const s=await seeded();s.env.INTAKE_DISPATCHER_ENABLED='false';await s.run();assert.equal(s.shared.mails.length,0);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'READY');
});
test('crash after lease but before send recovers after expiry',async()=>{
 const s=await seeded(),job=s.state('BUSINESS_EMAIL');await claimDelivery(s.env,job.request_key,'BUSINESS_EMAIL',s.clock);await s.run();assert.equal(s.shared.mails.length,0);s.clock+=121000;await s.run();assert.equal(s.shared.mails.length,1);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'DELIVERED');
});
test('expired sender is fenced and cannot mark a recovered lease delivered',async()=>{
 const s=await seeded(),job=s.state('BUSINESS_EMAIL'),claim=await claimDelivery(s.env,job.request_key,'BUSINESS_EMAIL',s.clock);s.clock+=121000;assert.equal(await markDeliveryStarted(s.env,claim,s.clock),false);assert.equal(await finishDelivery(s.env,claim,true,s.clock),false);await s.run();assert.equal(s.shared.mails.length,1);
});
test('crash after network start is NEEDS_REVIEW, never blind retry',async()=>{
 const s=await seeded(),j=s.state('BUSINESS_EMAIL'),claim=await claimDelivery(s.env,j.request_key,'BUSINESS_EMAIL',s.clock);await markDeliveryStarted(s.env,claim,s.clock);s.clock+=121000;await s.run();await s.run();assert.equal(s.shared.mails.length,0);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');
});
test('crash after provider success before local ACK cannot duplicate email',async()=>{
 const s=await seeded();s.shared.fault='UPDATE enquiry_outbox SET state=?,delivery_state=';await s.run();assert.equal(s.shared.mails.length,1);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'LEASED');s.clock+=121000;await s.run();assert.equal(s.shared.mails.length,1);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');
});
test('timeout after provider commit retains payload and requests reconciliation',async()=>{
 const s=await seeded();let commits=0;s.options.fetcher=async()=>{commits++;throw new Error('private synthetic provider body');};await s.run();s.clock+=3600000;await s.run();assert.equal(commits,1);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');assert.equal(s.count('website_enquiries'),1);assert.equal(s.count('enquiry_receipts'),1);
});
test('missing Brevo credentials retries without marking send_started; restart succeeds',async()=>{
 const s=await seeded();delete s.env.BREVO_API_KEY;await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'RETRY_WAIT');assert.equal(s.state('BUSINESS_EMAIL').send_started_at,null);assert.equal(s.shared.mails.length,0);s.env.BREVO_API_KEY='synthetic';s.clock+=60000;await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'DELIVERED');
});
test('429 honors Retry-After and retries only when due',async()=>{
 const s=await seeded();let calls=0;s.options.fetcher=async()=>{calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'120'}}):Response.json({messageId:'receipt'});};await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'RETRY_WAIT');assert.ok(s.state('BUSINESS_EMAIL').next_attempt_at>=s.clock+120000);s.clock+=60000;await s.run();assert.equal(calls,1);s.clock+=60001;await s.run();assert.equal(calls,2);assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'DELIVERED');
});
test('ambiguous 5xx and connection failure are not blindly resent',async()=>{
 for(const fail of [async()=>new Response('private',{status:503}),async()=>{throw new Error('connection');}]){const s=await seeded();s.options.fetcher=fail;await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');assert.equal(s.count('website_enquiries'),1);}
});
test('invalid encrypted payload cannot send and does not disappear',async()=>{
 const s=await seeded();s.sql.exec("UPDATE website_enquiries SET encrypted_payload='{}'");await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');assert.equal(s.shared.mails.length,0);assert.equal(s.count('website_enquiries'),1);
});
test('key rotation keeps existing payload readable; missing historical key needs review',async()=>{
 const s=await seeded();s.env.INTAKE_KEY_VERSION='new';s.env.INTAKE_ENCRYPTION_KEYS=JSON.stringify({...JSON.parse(s.env.INTAKE_ENCRYPTION_KEYS),new:Buffer.alloc(32,8).toString('base64')});await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'DELIVERED');
 const t=await seeded();t.env.INTAKE_KEY_VERSION='new';t.env.INTAKE_ENCRYPTION_KEYS=JSON.stringify({new:Buffer.alloc(32,8).toString('base64')});await t.run();assert.equal(t.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');assert.equal(t.shared.mails.length,0);
});
test('acknowledgement waits for business delivery and has its own receipt',async()=>{
 const s=await seeded({email:true});await s.run();assert.equal(s.shared.mails.length,1);await s.run();assert.equal(s.shared.mails.length,2);assert.equal(s.state('CUSTOMER_ACK').delivery_state,'DELIVERED');assert.equal(s.state('CUSTOMER_ACK').remote_receipt,'synthetic-receipt');await s.run();assert.equal(s.shared.mails.length,2);
});
test('dispatcher disabled never blocks fresh durable intake',async()=>{
 const s=setup();s.env.INTAKE_DISPATCHER_ENABLED='false';assert.equal((await s.call()).status,200);assert.equal(s.count('website_enquiries'),1);
});
test('abandoned RECEIVED capture recovers numbering and outbox without browser retry',async()=>{
 const s=setup();s.shared.fault='INSERT INTO quote_reference_counters';assert.equal((await s.call()).status,502);s.env.INTAKE_DISPATCHER_ENABLED='true';s.env.INTAKE_DISPATCHER_EMAIL_ENABLED='false';const result=await runDispatcher(s.env);assert.equal(result.recoveryFailures,0);assert.equal(s.count('quote_public_references'),1);assert.equal(s.count('enquiry_outbox'),2);assert.equal(s.shared.mails.length,0);
});
test('retry delay is exponential, jittered and respects HTTP-date Retry-After',()=>{
 assert.ok(retryTime(2,0,null,()=>0.5)>retryTime(1,0,null,()=>0.5));assert.notEqual(retryTime(1,0,null,()=>0),retryTime(1,0,null,()=>1));assert.ok(retryTime(1,0,'Thu, 01 Jan 1970 00:02:00 GMT',()=>0.5)>=120000);
});
test('scheduled entry awaits lifecycle, logs aggregate only, no public dispatch endpoint',async()=>{
 const logs=[],old=console.log;console.log=(...a)=>logs.push(a);try{let task;await worker.scheduled({}, {INTAKE_DISPATCHER_ENABLED:'false'}, {waitUntil(p){task=p;}});await task;assert.ok(JSON.stringify(logs).includes('enquiry_dispatch'));assert.ok(!JSON.stringify(logs).includes('Synthetic privacy'));assert.equal(worker.fetch().status,404);}finally{console.log=old;}
});
test('authenticated but invalid schema payload is quarantined without network',async()=>{
 const s=await seeded(),row=s.sql.prepare('SELECT * FROM website_enquiries').get();
 const bad=await seal(s.env,{schema_version:99,idempotency_key:row.request_key});s.sql.prepare('UPDATE website_enquiries SET encrypted_payload=?').run(bad.value);
 await s.run();assert.equal(s.state('BUSINESS_EMAIL').delivery_state,'NEEDS_REVIEW');assert.equal(s.shared.mails.length,0);
});
test('corrupt RECEIVED capture gets backoff rather than monopolizing recovery',async()=>{
 const s=setup();s.shared.fault='INSERT INTO quote_reference_counters';await s.call();s.sql.exec("UPDATE website_enquiries SET encrypted_payload='{}'");s.env.INTAKE_DISPATCHER_ENABLED='true';s.env.INTAKE_DISPATCHER_EMAIL_ENABLED='false';const first=await runDispatcher(s.env);assert.equal(first.recoveryFailures,1);const second=await runDispatcher(s.env);assert.equal(second.recoveryFailures,0);assert.equal(s.count('website_enquiries'),1);assert.equal(s.sql.prepare('SELECT recovery_attempt_count FROM website_enquiries').get().recovery_attempt_count,1);
});