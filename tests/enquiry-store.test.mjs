import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {seal,unseal,encryptionConfig} from '../server/enquiry-store.mjs';
const env={INTAKE_SOURCE_ID:'synthetic',INTAKE_KEY_VERSION:'test-v1',INTAKE_ENCRYPTION_KEYS:JSON.stringify({'test-v1':Buffer.alloc(32,7).toString('base64')})};
test('AES-GCM round trip, randomized IV, no plaintext and bound identity',async()=>{
 const payload={idempotency_key:'a'.repeat(64),contacts:{name:'Synthetic private sentinel'}};
 const a=await seal(env,payload),b=await seal(env,payload);assert.notEqual(a.value,b.value);assert.ok(!a.value.includes(payload.contacts.name));
 const row={source_id:'synthetic',request_key:payload.idempotency_key,key_version:a.version,encrypted_payload:a.value};
 assert.deepEqual(await unseal(env,row),payload);await assert.rejects(unseal(env,{...row,request_key:'b'.repeat(64)}));await assert.rejects(unseal(env,{...row,source_id:'foreign'}));
});
test('missing/invalid key fails closed; rotation retains old decryption keys',async()=>{
 assert.throws(()=>encryptionConfig({...env,INTAKE_ENCRYPTION_KEYS:'{}'}));
 const payload={idempotency_key:'a'.repeat(64)},a=await seal(env,payload);
 const rotated={...env,INTAKE_KEY_VERSION:'test-v2',INTAKE_ENCRYPTION_KEYS:JSON.stringify({...JSON.parse(env.INTAKE_ENCRYPTION_KEYS),'test-v2':Buffer.alloc(32,9).toString('base64')})};
 assert.deepEqual(await unseal(rotated,{source_id:'synthetic',request_key:payload.idempotency_key,key_version:a.version,encrypted_payload:a.value}),payload);
});
test('additive schema has no cascade from guard and unique delivery identity',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('../server/quote-guard.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../server/migrations/0002-website-enquiry-storage.sql',import.meta.url),'utf8'));
 db.prepare("INSERT INTO website_enquiries VALUES(?,?,?,1,?,?,1,?,NULL,'RECEIVED')").run('key','source','hash','encrypted','v1','internal');
 db.exec('DELETE FROM quote_guard');assert.equal(db.prepare('SELECT count(*) n FROM website_enquiries').get().n,1);
 db.prepare("INSERT INTO enquiry_outbox(id,request_key,destination,created_at) VALUES('one','key','HBM',1)").run();assert.throws(()=>db.prepare("INSERT INTO enquiry_outbox(id,request_key,destination,created_at) VALUES('two','key','HBM',1)").run());db.close();
});
