import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,submit,valid,png,moderation} from './reviews-fixture.mjs';
async function prepared(){
 const f=await fixture(); f.env.REVIEWS_RETENTION_ENABLED='false'; f.env.REVIEWS_NOTIFICATIONS_ENABLED='false';
 const s=await submit(f,valid({photoCount:2,photoConsent:true}));
 const a=(await s.upload(await png())).data.id,b=(await s.upload(await png())).data.id;
 await s.finish(); return {f,s,a,b};
}
const remove=(a,b,version=0)=>moderation({version,images:[{id:a,status:'removed',caption:''},{id:b,status:'approved',caption:'Work photograph'}]});
test('manual owner removal physically deletes only its original and all derivatives with retention disabled',async()=>{
 const {f,s,a,b}=await prepared();
 f.objects.set(`derivatives/${s.id}/${a}/extra.webp`,new Uint8Array([1]));
 const before=f.sql.prepare("SELECT used FROM review_usage WHERE scope='storage'").get().used;
 const result=await f.mutate(s.id,remove(a,b)); assert.equal(result.status,200);
 assert.equal(f.objects.size,4); assert.ok([...f.objects.keys()].every(k=>k.includes(b)));
 assert.equal((await f.call(`/images/${a}/480`)).status,404);
 assert.equal((await f.call(`/images/${b}/480`)).status,200);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM review_image_variants WHERE image_id=?').get(a).n,0);
 const row=f.sql.prepare('SELECT * FROM review_images WHERE id=?').get(a);
 assert.equal(row.storage_key,null);assert.equal(row.reserved_bytes,0);assert.equal(row.approval_status,'removed');
 assert.equal(f.sql.prepare("SELECT used FROM review_usage WHERE scope='storage'").get().used,before/2);
 assert.equal(f.calls.mail.length,0);
});
test('failed R2 deletion revokes publication, preserves manifest and quota, and owner retry completes safely',async()=>{
 const {f,s,a,b}=await prepared(); const del=f.env.REVIEWS_MEDIA.delete;let n=0;
 f.env.REVIEWS_MEDIA.delete=async k=>{if(++n===2)throw Error('private storage error');return del(k)};
 const result=await f.mutate(s.id,remove(a,b)); assert.equal(result.status,503);assert.match(result.data.error,/physical deletion is incomplete/);
 assert.equal((await f.call(`/images/${a}/480`)).status,404);
 assert.equal((await f.call(`/admin/images/${a}/480`,{admin:true})).status,404);
 assert.ok(f.sql.prepare('SELECT reserved_bytes FROM review_images WHERE id=?').get(a).reserved_bytes>0);
 const details=await f.call('/admin/'+s.id,{admin:true});assert.ok(details.data.images.some(i=>i.id===a));
 assert.equal((await f.mutate(s.id,moderation({version:1,images:[{id:a,status:'approved',caption:''},{id:b,status:'approved',caption:''}]}))).status,409);
 f.env.REVIEWS_MEDIA.delete=del;
 assert.equal((await f.mutate(s.id,remove(a,b,1))).status,200);
 assert.equal(f.objects.size,4);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM review_moderation_events WHERE action='photo_deletion_failed'").get().n,1);
 assert.equal((await f.mutate(s.id,moderation({version:2,images:[{id:b,status:'approved',caption:''}]}))).status,200);
 assert.equal(f.sql.prepare("SELECT used FROM review_usage WHERE scope='storage'").get().used,16*1024*1024);
});
test('manual removal requires authentication, Origin, CSRF and respects a retention hold',async()=>{
 const {f,s,a,b}=await prepared();const payload=remove(a,b);
 assert.equal((await f.call('/admin/'+s.id,{method:'POST',body:payload})).status,403);
 assert.equal((await f.call('/admin/'+s.id,{method:'POST',admin:true,body:payload})).status,403);
 assert.equal((await f.call('/admin/'+s.id,{method:'POST',admin:true,origin:'https://attacker.test',body:payload,headers:{'X-Review-CSRF':f.adminSession.csrf}})).status,403);
 f.sql.prepare("UPDATE reviews SET retention_hold=1,retention_hold_reason='Active dispute'").run();
 assert.equal((await f.mutate(s.id,payload)).status,409);assert.equal(f.objects.size,8);
});
test('photo privacy notice and manual procedure describe actual manual deletion, not scheduled retention',()=>{
 const html=readFileSync('privacy.html','utf8'),manual=readFileSync('server/reviews/MANUAL-RETENTION.md','utf8');
 assert.ok(!html.includes('Photograph uploads and review email notifications are currently disabled'));
 for(const text of ['up to five photographs','within 30 days','private R2 storage','physical deletion','no active scheduled retention'])assert.ok(html.includes(text),text);
 for(const text of ['Remove photograph','reserved_bytes','30 days','Cron and automatic retention remain off'])assert.ok(manual.includes(text),text);
});

test('database finalisation failure keeps a retryable private manifest after R2 objects are gone',async()=>{
 const {f,s,a,b}=await prepared();const batch=f.env.REVIEWS_DB.batch;let calls=0;
 f.env.REVIEWS_DB.batch=async statements=>{if(++calls===2)throw Error('Mock D1 failure');return batch(statements)};
 const result=await f.mutate(s.id,remove(a,b));assert.equal(result.status,503);
 assert.equal(f.objects.size,4);assert.ok(f.sql.prepare('SELECT storage_key FROM review_images WHERE id=?').get(a).storage_key);
 assert.equal((await f.call(`/images/${a}/480`)).status,404);
 f.env.REVIEWS_DB.batch=batch;
 assert.equal((await f.mutate(s.id,remove(a,b,1))).status,200);
 assert.equal(f.sql.prepare('SELECT reserved_bytes FROM review_images WHERE id=?').get(a).reserved_bytes,0);
});
