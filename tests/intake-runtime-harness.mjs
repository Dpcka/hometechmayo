// LOCAL TEST ENTRYPOINT ONLY. Never deploy as the dispatcher or Pages endpoint.
import {validate,handleQuote} from '../server/quote.mjs';
import {VERSION} from '../js/pricing-catalogue.mjs';
import {buildEnquiry} from '../server/intake-contract.mjs';
import {seal,captureStatements,finalize,claimDelivery,markDeliveryStarted} from '../server/enquiry-store.mjs';
import {assignPublicReference} from '../server/quote-numbering.mjs';
import {runDispatcher} from '../server/enquiry-dispatcher.mjs';
export default {async fetch(request,bindings){
 const input=await request.json(),source=input.source;
 const env={...bindings,INTAKE_SOURCE_ID:source,QUOTE_DURABLE_ENABLED:input.captureOff?'false':'true',INTAKE_DISPATCHER_ENABLED:input.disabled?'false':'true',INTAKE_DISPATCHER_EMAIL_ENABLED:'true'};
 if(input.rotate){env.INTAKE_KEY_VERSION='new';env.INTAKE_ENCRYPTION_KEYS=JSON.stringify({...JSON.parse(env.INTAKE_ENCRYPTION_KEYS),new:btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))});}
 const body={name:'Synthetic runtime sentinel '+source,phone:'0830000000',email:'',eircode:'',area:'Castlebar',consent:true,version:VERSION,items:[{id:'wifi-printer',quantity:1,materials:'yes',options:{}}],requestId:input.requestId||'00000000-0000-4000-8000-000000000001',turnstileToken:'synthetic'};
 const mock=async url=>{
  if(url.includes('siteverify'))return Response.json({success:true,hostname:'example.invalid',action:'quote'});
  if(input.mode==='429')return new Response('',{status:429,headers:{'Retry-After':'120'}});
  await env.QUOTE_GUARD.prepare('INSERT INTO runtime_provider_commits(source) VALUES(?)').bind(source).run();
  if(input.mode==='timeout')throw new Error('synthetic timeout after commit');
  return Response.json({messageId:'synthetic-runtime-receipt'});
 };
 const path=new URL(request.url).pathname;
 if(path==='/submit')return handleQuote({request:new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(body)}),env},mock);
 if(path==='/seed'){
  const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))).map(b=>b.toString(16).padStart(2,'0')).join(''),now=Date.now();
  const validated=validate(body),p=buildEnquiry({sourceId:source,idempotencyKey:key,validated,items:body.items,area:body.area,receivedAt:now,origin:env.SITE_ORIGIN}),encrypted=await seal(env,p),internalReference='HT-'+source;
  await env.QUOTE_GUARD.batch([env.QUOTE_GUARD.prepare("INSERT INTO quote_guard VALUES(?,?,?,?,?,'pending',0)").bind(key,key,key,internalReference,now),...captureStatements(env,{key,hash:key,encrypted,now,internalReference})]);
  const row=await env.QUOTE_GUARD.prepare('SELECT * FROM website_enquiries WHERE request_key=?').bind(key).first();
  if(!input.beforeNumber){const ref=await assignPublicReference(env.QUOTE_GUARD,key,now);await finalize(env,row,ref,false);}
  return Response.json({seeded:true});
 }
 if(path==='/claim'){
  const row=await env.QUOTE_GUARD.prepare('SELECT request_key FROM website_enquiries WHERE source_id=?').bind(source).first();
  const claim=await claimDelivery(env,row.request_key,'BUSINESS_EMAIL',input.now);if(input.started)await markDeliveryStarted(env,claim,input.now);return Response.json({claimed:!!claim});
 }
 if(path==='/rollback'){
  try{await env.QUOTE_GUARD.batch([env.QUOTE_GUARD.prepare('INSERT INTO runtime_provider_commits(source) VALUES(?)').bind(source),env.QUOTE_GUARD.prepare('INSERT INTO nonexistent_runtime_table VALUES(1)')]);}catch{return Response.json({rolledBack:true});}
 }
 return Response.json(await runDispatcher(env,{fetcher:mock,now:()=>input.now||Date.now(),random:()=>0.5}));
}};
