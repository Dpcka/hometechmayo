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
    services:items.map(i=>({id:i.id,quantity:i.quantity,materials:i.materials ?? null,options:i.options ?? {}})),
    area,estimate_snapshot:validated.estimate,pricing_catalogue_version:validated.version,
    provenance:{kind:'WEBSITE',origin,received_at:receivedAt,privacy_consent:true,privacy_notice_version:'website-current'}};
  if (!Number.isSafeInteger(receivedAt) || new URL(origin).protocol!=='https:' || !Array.isArray(items) || !items.length) throw new Error('Invalid intake provenance.');
  return JSON.parse(canonical(enquiry));
}
