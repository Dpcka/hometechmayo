import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEnquiry,canonical} from '../server/intake-contract.mjs';
import {validate} from '../server/quote.mjs';
import {VERSION} from '../js/pricing-catalogue.mjs';
const body={name:'Synthetic Example',phone:'0830000000',email:'example@example.invalid',area:'Castlebar',consent:true,version:VERSION,items:[{id:'wifi-printer',quantity:1,materials:'yes',options:{}}],requestId:'00000000-0000-4000-8000-000000000001',turnstileToken:'never-store'};
test('v1 preserves authoritative business payload and excludes security input',()=>{
 const e=buildEnquiry({sourceId:'hometechmayo',idempotencyKey:'a'.repeat(64),validated:validate(body),items:body.items,area:body.area,receivedAt:1,origin:'https://example.invalid'});
 assert.equal(e.schema_version,1);assert.equal(e.external_reference,null);assert.equal(e.contacts.name,body.name);assert.equal(e.pricing_catalogue_version,VERSION);assert.equal(e.services[0].quantity,1);assert.equal(e.provenance.privacy_consent,true);assert.ok(e.estimate_snapshot);assert.ok(!JSON.stringify(e).includes('never-store'));
});
test('canonical object ordering and source identity are strict',()=>{
 assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));
 assert.throws(()=>buildEnquiry({sourceId:'foreign/tenant',idempotencyKey:'a'.repeat(64)}));
});
