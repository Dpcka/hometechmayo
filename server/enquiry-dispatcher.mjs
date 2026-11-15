import {claimDelivery,markDeliveryStarted,unseal,finalize,finishDelivery} from './enquiry-store.mjs';
import {assertEnquiry} from './intake-contract.mjs';
import {assignPublicReference} from './quote-numbering.mjs';
import {createQuoteEmails} from './quote-emails.mjs';
const enabled=env=>env.INTAKE_DISPATCHER_ENABLED==='true';
const jitter=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function retryTime(attempt,now,retryAfter=null,random=jitter){
 const backoff=Math.min(3600000,30000*2**Math.min(10,Math.max(0,attempt-1)))*(0.8+random()*0.4);
 let wait=0;if(retryAfter){const seconds=Number(retryAfter);wait=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(retryAfter)-now)||0;}
 return Math.ceil(now+Math.max(backoff,wait));
}
async function settle(env,claim,state,code,now,next=null){
 const legacy=state==='RETRY_WAIT'?'RETRY_WAIT':'NEEDS_REVIEW';
 const r=await env.QUOTE_GUARD.batch([
 env.QUOTE_GUARD.prepare("UPDATE enquiry_outbox SET delivery_state=?,state=?,last_error_code=?,next_attempt_at=?,lease_until=NULL WHERE id=? AND lease_token=? AND delivery_state='LEASED' AND lease_until>?").bind(state,legacy,code,next,claim.id,claim.token,now),
 env.QUOTE_GUARD.prepare("UPDATE enquiry_delivery_attempts SET finished_at=?,outcome='UNCERTAIN',error_code=? WHERE id=? AND EXISTS(SELECT 1 FROM enquiry_outbox WHERE id=? AND lease_token=? AND delivery_state=?)").bind(now,code,claim.token,claim.id,claim.token,state)]);
 return r[0].meta.changes===1;
}
async function recoverExpired(env,now){
 // Only pre-send leases may be retried. Post-send ambiguity never causes blind mail.
 await env.QUOTE_GUARD.batch([
 env.QUOTE_GUARD.prepare("UPDATE enquiry_delivery_attempts SET finished_at=?,outcome='UNCERTAIN',error_code='LEASE_EXPIRED' WHERE finished_at IS NULL AND EXISTS(SELECT 1 FROM enquiry_outbox o JOIN website_enquiries e ON e.request_key=o.request_key WHERE o.lease_token=enquiry_delivery_attempts.id AND o.delivery_state='LEASED' AND o.lease_until<=? AND e.source_id=?)").bind(now,now,env.INTAKE_SOURCE_ID),
 env.QUOTE_GUARD.prepare("UPDATE enquiry_outbox SET delivery_state=CASE WHEN send_started_at IS NULL THEN 'RETRY_WAIT' ELSE 'NEEDS_REVIEW' END,state=CASE WHEN send_started_at IS NULL THEN 'RETRY_WAIT' ELSE 'NEEDS_REVIEW' END,next_attempt_at=?,last_error_code=CASE WHEN send_started_at IS NULL THEN 'LEASE_EXPIRED_PRE_SEND' ELSE 'DELIVERY_UNCERTAIN' END,lease_until=NULL WHERE delivery_state='LEASED' AND lease_until<=? AND EXISTS(SELECT 1 FROM website_enquiries e WHERE e.request_key=enquiry_outbox.request_key AND e.source_id=?)").bind(now,now,env.INTAKE_SOURCE_ID)]);
}
async function recoverCaptures(env,now){
 const rows=await env.QUOTE_GUARD.prepare("SELECT * FROM website_enquiries WHERE state='RECEIVED' AND source_id=? AND (recovery_next_attempt_at IS NULL OR recovery_next_attempt_at<=?) ORDER BY received_at,request_key LIMIT 10").bind(env.INTAKE_SOURCE_ID,now()).all();
 let failed=0;
 for(const row of rows.results){try{
  const p=assertEnquiry(await unseal(env,row),row);
  const ref=await assignPublicReference(env.QUOTE_GUARD,row.request_key,row.received_at);
  await finalize(env,row,ref,Boolean(p.contacts.email));
 }catch{failed++;await env.QUOTE_GUARD.prepare("UPDATE website_enquiries SET recovery_attempt_count=recovery_attempt_count+1,recovery_next_attempt_at=?,recovery_error_code='CAPTURE_RECOVERY_BLOCKED' WHERE request_key=? AND source_id=?").bind(now()+3600000,row.request_key,env.INTAKE_SOURCE_ID).run();}}
 return failed;
}
async function acceptedReceipt(response){
 const reader=response.body?.getReader();if(!reader)return null;
 let size=0,text='';const decoder=new TextDecoder();
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>8192){await reader.cancel();return null;}text+=decoder.decode(r.value,{stream:true});}
 try{const p=JSON.parse(text+decoder.decode());return typeof p.messageId==='string'&&p.messageId.length>0&&p.messageId.length<=250?p.messageId:null;}catch{return null;}
}
async function processJob(env,job,options){
 const now=options.now,claim=await claimDelivery(env,job.request_key,job.destination,now());if(!claim)return 'contended';
 if(job.attempt_count>=8){await settle(env,claim,'NEEDS_REVIEW','RETRY_LIMIT',now());return 'review';}
 const row=await env.QUOTE_GUARD.prepare('SELECT * FROM website_enquiries WHERE request_key=? AND source_id=?').bind(job.request_key,env.INTAKE_SOURCE_ID).first();
 let p;try{p=assertEnquiry(await unseal(env,row),row);if(!/^Q-SITE-\d{4}-\d{4,}$/.test(row.external_reference||''))throw new Error();}catch{
  await settle(env,claim,'NEEDS_REVIEW','PAYLOAD_OR_KEY_INVALID',now());return 'review';
 }
 const retry=async(code,after=null)=>{await settle(env,claim,'RETRY_WAIT',code,now(),retryTime(job.attempt_count+1,now(),after,options.random));return 'retry';};
 if(!env.BREVO_API_KEY)return retry('EMAIL_CREDENTIALS_UNAVAILABLE');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.QUOTE_FROM_EMAIL||'')||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.QUOTE_TO_EMAIL||'')){
  await settle(env,claim,'NEEDS_REVIEW','EMAIL_CONFIGURATION_INVALID',now());return 'review';
 }
 const emails=createQuoteEmails({customer:{...p.contacts,description:p.description,availability:p.availability_preferences,materialsInformation:p.materials_information},estimate:p.estimate_snapshot,reference:row.external_reference,receivedAt:row.received_at,version:p.pricing_catalogue_version},env);
 const message=job.destination==='BUSINESS_EMAIL'?emails.business:emails.acknowledgement;
 if(!message){await settle(env,claim,'NEEDS_REVIEW','DESTINATION_INVALID',now());return 'review';}
 if(!await markDeliveryStarted(env,claim,now()))return 'lease_lost';
 let response,receipt;
 try{
  response=await options.fetcher('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'Content-Type':'application/json',Accept:'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({sender:{email:env.QUOTE_FROM_EMAIL,name:env.QUOTE_FROM_NAME||'Home Tech Solutions & Services'},...message})});
  if(response.ok)receipt=await acceptedReceipt(response);
 }catch{await settle(env,claim,'NEEDS_REVIEW','DELIVERY_UNCERTAIN',now());return 'review';}
 if(response.status===429)return retry('HTTP_429',response.headers.get('Retry-After'));
 if(!response.ok||!receipt){
  // 5xx/missing receipt may follow provider acceptance. Reconciliation, not retry.
  await settle(env,claim,'NEEDS_REVIEW',response.status>=500?'HTTP_5XX_UNCERTAIN':'EMAIL_REJECTED_OR_NO_RECEIPT',now());return 'review';
 }
 return await finishDelivery(env,claim,true,now(),receipt)?'delivered':'lease_lost';
}
export async function runDispatcher(env,{fetcher=fetch,now=Date.now,random=jitter}={}){
 if(!enabled(env))return {disabled:true};
 if(!env.QUOTE_GUARD||!env.INTAKE_SOURCE_ID)return {error:'BINDING_UNAVAILABLE'};
 const stats={delivered:0,retry:0,review:0,errors:0};
 await recoverExpired(env,now());
 stats.recoveryFailures=await recoverCaptures(env,now);
 if(env.INTAKE_DISPATCHER_EMAIL_ENABLED!=='true')return stats;
 // HBM intentionally excluded: no Inbox/receipt protocol exists yet.
 const jobs=await env.QUOTE_GUARD.prepare("SELECT o.* FROM enquiry_outbox o JOIN website_enquiries e ON e.request_key=o.request_key WHERE e.source_id=? AND o.destination IN ('BUSINESS_EMAIL','CUSTOMER_ACK') AND o.delivery_state IN ('READY','RETRY_WAIT') AND (o.next_attempt_at IS NULL OR o.next_attempt_at<=?) AND (o.destination<>'CUSTOMER_ACK' OR EXISTS(SELECT 1 FROM enquiry_outbox b WHERE b.request_key=o.request_key AND b.destination='BUSINESS_EMAIL' AND b.delivery_state='DELIVERED')) ORDER BY o.created_at,o.id LIMIT 20").bind(env.INTAKE_SOURCE_ID,now()).all();
 for(const job of jobs.results){try{const state=await processJob(env,job,{fetcher,now,random});if(state in stats)stats[state]++;}catch{stats.errors++;}}
 return stats;
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(runDispatcher(env).then(stats=>{console.log(JSON.stringify({event:'enquiry_dispatch',...stats}));}).catch(()=>{console.error(JSON.stringify({event:'enquiry_dispatch',error:'DISPATCH_FAILED'}));}));},
 fetch(){return new Response('Not found',{status:404});}
};
