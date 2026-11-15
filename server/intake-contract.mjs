/** Server-owned Website Enquiry v1. Q-SITE is never an HBM Quote number. */
export const INTAKE_SCHEMA_VERSION = 1;
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function buildEnquiry({sourceId, idempotencyKey, validated, items, area, receivedAt, origin}) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(sourceId) || !/^[a-f0-9]{64}$/.test(idempotencyKey)) throw new Error('Invalid intake identity.');
  const c=validated.customer;
  const enquiry={schema_version:1,source_id:sourceId,idempotency_key:idempotencyKey,external_reference:null,
    contacts:{name:c.name,phone:c.phone,email:c.email,eircode:c.eircode},
    description:c.description,materials_information:c.materialsInformation,availability_preferences:c.availability,
    services:validated.estimate.lines.map(i=>({id:i.id,quantity:i.quantity,materials:i.materials ?? null,options:i.options ?? {}})),
    area,estimate_snapshot:validated.estimate,pricing_catalogue_version:validated.version,
    provenance:{kind:'WEBSITE',origin,received_at:receivedAt,privacy_consent:true,privacy_notice_version:'website-current'}};
  if (!Number.isSafeInteger(receivedAt) || new URL(origin).protocol!=='https:' || !Array.isArray(items) || !items.length) throw new Error('Invalid intake provenance.');
  return JSON.parse(canonical(enquiry));
}

/** Validate decrypted data at the trust boundary; never log validation values. */
export function assertEnquiry(p,row){
 const fail=()=>{throw new Error('INVALID_PAYLOAD');};
 if(!p||p.schema_version!==1||p.source_id!==row.source_id||p.idempotency_key!==row.request_key||p.provenance?.received_at!==row.received_at)fail();
 for(const k of ['name','phone','email','eircode'])if(typeof p.contacts?.[k]!=='string'||p.contacts[k].length>254)fail();
 if(!p.contacts.name||!p.contacts.phone||!Array.isArray(p.services)||!p.services.length||p.services.length>100)fail();
 if(typeof p.pricing_catalogue_version!=='string'||!p.estimate_snapshot||!Array.isArray(p.estimate_snapshot.lines)||!Number.isSafeInteger(p.estimate_snapshot.total)||p.estimate_snapshot.total<0)fail();
 for(const k of ['description','materials_information','availability_preferences','area'])if(typeof p[k]!=='string'||p[k].length>3000)fail();
 if(p.provenance?.privacy_consent!==true||p.provenance?.kind!=='WEBSITE')fail();
 for(const i of p.services)if(typeof i.id!=='string'||!Number.isFinite(i.quantity)||i.quantity<=0||!['yes','no','unsure'].includes(i.materials)||!i.options||typeof i.options!=='object'||Array.isArray(i.options))fail();
 return p;
}
