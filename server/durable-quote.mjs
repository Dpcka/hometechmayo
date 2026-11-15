import {buildEnquiry,canonical} from './intake-contract.mjs';
import {preflight,seal,unseal,getEnquiry,captureStatements,finalize,delivery,claimDelivery,finishDelivery} from './enquiry-store.mjs';
import {checkNumberingSchema,assignPublicReference,publicReference} from './quote-numbering.mjs';
import {createQuoteEmails} from './quote-emails.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const conflict=reference=>reply({error:'This request is processing or delivery is uncertain. Contact us with this reference; do not submit again.',reference},409);
async function continueEnquiry(env,row,sendMail,fetcher){
 const payload=await unseal(env,row);
 const reference=row.external_reference || await assignPublicReference(env.QUOTE_GUARD,row.request_key,row.received_at);
 await finalize(env,row,reference,Boolean(payload.contacts.email));
 const emails=createQuoteEmails({customer:{...payload.contacts,description:payload.description,availability:payload.availability_preferences,materialsInformation:payload.materials_information},estimate:payload.estimate_snapshot,reference,receivedAt:row.received_at,version:payload.pricing_catalogue_version},env);
 let business=await delivery(env,row.request_key,'BUSINESS_EMAIL');
 const duplicate=business.state==='SENT';
 if(!duplicate){
  const claim=await claimDelivery(env,row.request_key,'BUSINESS_EMAIL');
  if(!claim)return conflict(reference);
  try{await sendMail(env,emails.business,fetcher);}catch{
   await finishDelivery(env,claim,false);
   return reply({error:'Delivery could not be confirmed. Your request is stored; contact us with this reference and do not submit again.',reference},502);
  }
  await finishDelivery(env,claim,true);
 }
 // Legacy guard is only a compatibility mirror, never the authoritative receipt.
 await env.QUOTE_GUARD.prepare("UPDATE quote_guard SET status='sent' WHERE request_key=?").bind(row.request_key).run();
 let acknowledgement=false;
 if(payload.contacts.email){
  const ack=await delivery(env,row.request_key,'CUSTOMER_ACK');
  acknowledgement=ack.state==='SENT';
  if(ack.state==='READY'){
   const claim=await claimDelivery(env,row.request_key,'CUSTOMER_ACK');
   if(claim){
    let accepted=false;try{await sendMail(env,emails.acknowledgement,fetcher);accepted=true;}catch{}
    await finishDelivery(env,claim,accepted);acknowledgement=accepted;
   }
  }
 }
 return reply({ok:true,reference,acknowledgement,...(duplicate?{duplicate:true}:{})});
}
export async function handleDurableQuote({request,env,body,validated,fetcher,sendMail,digest}){
 let reference;
 try{
  if(env.QUOTE_SITE_NUMBERING_ENABLED!=='true')throw new Error('Durable intake requires numbering.');
  await preflight(env);await checkNumberingSchema(env.QUOTE_GUARD);
  const key=await digest(env.QUOTE_HASH_SECRET,body.requestId);
  const hash=await digest(env.QUOTE_HASH_SECRET,canonical({validated,items:body.items,area:body.area}));
  let row=await getEnquiry(env,key);
  if(row){if(row.payload_hash!==hash)return reply({error:'This request identifier was already used for different details. Reload the page.'},409);reference=row.external_reference||row.internal_reference;return await continueEnquiry(env,row,sendMail,fetcher);}
  const receipt=await env.QUOTE_GUARD.prepare('SELECT payload_hash,external_reference FROM enquiry_receipts WHERE source_id=? AND request_key=?').bind(env.INTAKE_SOURCE_ID,key).first();
  if(receipt)return conflict(receipt.external_reference);
  // Existing email-only reservations are never reconstructed or resent.
  const previous=await env.QUOTE_GUARD.prepare('SELECT * FROM quote_guard WHERE request_key=?').bind(key).first();
  if(previous){
   const normalized={...validated,estimate:{...validated.estimate,lines:[...validated.estimate.lines].sort((a,b)=>a.id.localeCompare(b.id))}};
   if(previous.payload_hash!==await digest(env.QUOTE_HASH_SECRET,JSON.stringify(normalized)))return reply({error:'This request identifier was already used for different details. Reload the page.'},409);
   reference=await publicReference(env.QUOTE_GUARD,key)||previous.reference;
   return previous.status==='sent'?reply({ok:true,reference,acknowledgement:previous.ack===1,duplicate:true}):conflict(reference);
  }
  const token=body.turnstileToken;
  if(typeof token!=='string'||!token.trim()||token.length>2048)return reply({error:'Security verification required.'},400);
  const verification=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||undefined})});
  if(!verification.ok)return reply({error:'Security verification unavailable.'},503);
  const check=await verification.json();if(!check.success||check.hostname!==new URL(env.SITE_ORIGIN).hostname||check.action!=='quote')return reply({error:'Security verification failed or expired.'},400);
  const now=Date.now(),internalReference=`HT-${new Date(now).toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,12).toUpperCase()}`;
  const payload=buildEnquiry({sourceId:env.INTAKE_SOURCE_ID,idempotencyKey:key,validated,items:body.items,area:body.area,receivedAt:now,origin:env.SITE_ORIGIN});
  const encrypted=await seal(env,payload);
  await env.QUOTE_GUARD.batch([
   env.QUOTE_GUARD.prepare("DELETE FROM quote_guard WHERE created_at < ? AND NOT EXISTS(SELECT 1 FROM website_enquiries e WHERE e.request_key=quote_guard.request_key AND e.state='RECEIVED')").bind(now-86400000),
   env.QUOTE_GUARD.prepare(`INSERT OR IGNORE INTO quote_guard(request_key,payload_hash,ip_hash,reference,created_at,status,ack)
    SELECT ?,?,?,?,?, 'pending',0 WHERE (SELECT COUNT(*) FROM quote_guard WHERE ip_hash=? AND created_at>?)<5`).bind(key,hash,await digest(env.QUOTE_HASH_SECRET,request.headers.get('CF-Connecting-IP')||'unknown'),internalReference,now,await digest(env.QUOTE_HASH_SECRET,request.headers.get('CF-Connecting-IP')||'unknown'),now-3600000),
   ...captureStatements(env,{key,hash,encrypted,now,internalReference})]);
  row=await getEnquiry(env,key);
  if(!row)return reply({error:'This enquiry was already submitted, or the submission limit was reached. Please wait or contact us.'},429);
  if(row.payload_hash!==hash)return reply({error:'This request identifier was already used for different details.'},409);
  reference=row.internal_reference;
  return await continueEnquiry(env,row,sendMail,fetcher);
 }catch{
  return reply({error:reference?'Your request is stored but delivery could not be confirmed. Contact us with this reference; do not submit again.':'The quote service is temporarily unavailable. Please try later.',...(reference?{reference}:{})},reference?502:503);
 }
}
