import {canonical} from './intake-contract.mjs';
export const durableEnabled=env=>env.QUOTE_DURABLE_ENABLED==='true';
const bytes=s=>new TextEncoder().encode(s);
const b64=b=>btoa(String.fromCharCode(...b));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export function encryptionConfig(env){
 const version=env.INTAKE_KEY_VERSION,source=env.INTAKE_SOURCE_ID;
 if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(source||'')||!/^[a-zA-Z0-9._-]{1,40}$/.test(version||''))throw new Error('Intake configuration unavailable.');
 const ring=JSON.parse(env.INTAKE_ENCRYPTION_KEYS||'{}');
 for(const value of Object.values(ring))if(typeof value!=='string'||un64(value).length!==32)throw new Error('Intake configuration unavailable.');
 if(!ring[version])throw new Error('Intake configuration unavailable.');
 return {source,version,ring};
}
export async function seal(env,payload){
 const {source,version,ring}=encryptionConfig(env),iv=crypto.getRandomValues(new Uint8Array(12));
 const aad=canonical({source,request_key:payload.idempotency_key,version,schema:1});
 const key=await crypto.subtle.importKey('raw',un64(ring[version]),'AES-GCM',false,['encrypt']);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(aad)},key,bytes(canonical(payload)));
 return {version,value:JSON.stringify({iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))})};
}
export async function unseal(env,row){
 const {source,ring}=encryptionConfig(env);
 if(row.source_id!==source||!ring[row.key_version])throw new Error('Intake recovery unavailable.');
 const e=JSON.parse(row.encrypted_payload),key=await crypto.subtle.importKey('raw',un64(ring[row.key_version]),'AES-GCM',false,['decrypt']);
 const aad=canonical({source,request_key:row.request_key,version:row.key_version,schema:1});
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(e.iv),additionalData:bytes(aad)},key,un64(e.ciphertext));
 return JSON.parse(new TextDecoder().decode(plain));
}
export async function preflight(env){
 encryptionConfig(env);
 for(const table of ['website_enquiries','enquiry_outbox','enquiry_delivery_attempts','enquiry_receipts'])await env.QUOTE_GUARD.prepare(`SELECT * FROM ${table} LIMIT 0`).first();
}
export const getEnquiry=(env,key)=>env.QUOTE_GUARD.prepare('SELECT * FROM website_enquiries WHERE request_key=? AND source_id=?').bind(key,env.INTAKE_SOURCE_ID).first();
export function captureStatements(env,{key,hash,encrypted,now,internalReference}){
 return [env.QUOTE_GUARD.prepare(`INSERT INTO website_enquiries(request_key,source_id,payload_hash,schema_version,encrypted_payload,key_version,received_at,internal_reference,state)
 SELECT ?,?,?,1,?,?,?,?, 'RECEIVED' WHERE EXISTS(SELECT 1 FROM quote_guard WHERE request_key=? AND reference=?)
 ON CONFLICT(request_key) DO NOTHING`).bind(key,env.INTAKE_SOURCE_ID,hash,encrypted.value,encrypted.version,now,internalReference,key,internalReference),
 env.QUOTE_GUARD.prepare(`INSERT INTO enquiry_receipts(source_id,request_key,payload_hash,received_at)
 SELECT source_id,request_key,payload_hash,received_at FROM website_enquiries WHERE request_key=? ON CONFLICT DO NOTHING`).bind(key)];
}
export async function finalize(env,row,reference,hasEmail){
 const statements=[env.QUOTE_GUARD.prepare("UPDATE website_enquiries SET external_reference=?,state='NUMBERED' WHERE request_key=? AND (external_reference IS NULL OR external_reference=?)").bind(reference,row.request_key,reference),env.QUOTE_GUARD.prepare('UPDATE enquiry_receipts SET external_reference=? WHERE source_id=? AND request_key=?').bind(reference,row.source_id,row.request_key)];
 for(const dest of ['HBM','BUSINESS_EMAIL',...(hasEmail?['CUSTOMER_ACK']:[])])statements.push(env.QUOTE_GUARD.prepare(`INSERT INTO enquiry_outbox(id,request_key,destination,created_at)
 SELECT ?,request_key,?,received_at FROM website_enquiries WHERE request_key=? AND external_reference=? ON CONFLICT(request_key,destination) DO NOTHING`).bind(crypto.randomUUID(),dest,row.request_key,reference));
 await env.QUOTE_GUARD.batch(statements);
 const stored=await getEnquiry(env,row.request_key);if(stored?.external_reference!==reference)throw new Error('Intake reference conflict.');
}
export const delivery=(env,key,dest)=>env.QUOTE_GUARD.prepare('SELECT * FROM enquiry_outbox WHERE request_key=? AND destination=?').bind(key,dest).first();
export async function claimDelivery(env,key,dest){
 const token=crypto.randomUUID();
 const row=await env.QUOTE_GUARD.prepare("UPDATE enquiry_outbox SET state='SENDING',lease_token=?,attempt_count=attempt_count+1 WHERE request_key=? AND destination=? AND state='READY' RETURNING id").bind(token,key,dest).first();
 if(!row)return null;
 await env.QUOTE_GUARD.prepare('INSERT INTO enquiry_delivery_attempts(id,outbox_id,started_at) VALUES(?,?,?)').bind(token,row.id,Date.now()).run();
 return {token,id:row.id};
}
export async function finishDelivery(env,claim,accepted){
 await env.QUOTE_GUARD.batch([
 env.QUOTE_GUARD.prepare('UPDATE enquiry_outbox SET state=?,delivered_at=?,last_error_code=? WHERE id=? AND lease_token=?').bind(accepted?'SENT':'UNCERTAIN',accepted?Date.now():null,accepted?null:'DELIVERY_UNCERTAIN',claim.id,claim.token),
 env.QUOTE_GUARD.prepare('UPDATE enquiry_delivery_attempts SET finished_at=?,outcome=?,error_code=? WHERE id=?').bind(Date.now(),accepted?'ACCEPTED':'UNCERTAIN',accepted?null:'DELIVERY_UNCERTAIN',claim.token)]);
}
