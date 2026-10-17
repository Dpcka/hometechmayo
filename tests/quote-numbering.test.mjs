import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {assignPublicReference,checkNumberingSchema,numberingYear,publicReference} from '../server/quote-numbering.mjs';
function fixture(migrate=true) {
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 sql.exec(readFileSync(new URL('../server/quote-guard.sql',import.meta.url),'utf8'));
 if(migrate)sql.exec(readFileSync(new URL('../server/migrations/0001-website-quote-numbering.sql',import.meta.url),'utf8'));
 const statement=query=>({bind(...args){return {first:async()=>sql.prepare(query).get(...args),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),execute:()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}})};},first:async()=>sql.prepare(query).get()});
 const db={prepare:statement,batch:async statements=>{sql.exec('BEGIN');try{const result=statements.map(s=>s.execute());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 const reserve=(key,status='pending')=>sql.prepare('INSERT INTO quote_guard (request_key,payload_hash,ip_hash,reference,created_at,status) VALUES (?,?,?,?,?,?)').run(key,'payload-'+key,'ip','HT-internal-'+key,0,status);
 return {sql,db,reserve};
}
const date='2026-10-17T12:00:00Z';
test('website references are server-side yearly sequences with zero padding and preserved internal IDs',async()=>{
 const {db,sql,reserve}=fixture();
 for(let i=1;i<=5;i++){reserve(String(i));assert.equal(await assignPublicReference(db,String(i),date),`Q-SITE-2026-${String(i).padStart(4,'0')}`);}
 assert.equal(sql.prepare('SELECT reference FROM quote_guard WHERE request_key=?').get('5').reference,'HT-internal-5');
 assert.equal(await publicReference(db,'5'),'Q-SITE-2026-0005');
});
test('numbering rolls over by calendar year and supports more than four digits',async()=>{
 const {db,sql,reserve}=fixture();reserve('a');reserve('b');
 assert.equal(await assignPublicReference(db,'a','2026-12-31T23:59:59Z'),'Q-SITE-2026-0001');
 assert.equal(await assignPublicReference(db,'b','2027-01-01T00:00:00Z'),'Q-SITE-2027-0001');
 sql.prepare('UPDATE quote_reference_counters SET last_sequence=9999 WHERE year=2027').run();reserve('c');
 assert.equal(await assignPublicReference(db,'c','2027-01-01T00:00:01Z'),'Q-SITE-2027-10000');
 assert.equal(numberingYear(date),2026);
});
test('concurrent allocations are unique and idempotent retries do not consume another number',async()=>{
 const {db,sql,reserve}=fixture();for(let i=0;i<30;i++)reserve(String(i));
 const refs=await Promise.all(Array.from({length:30},(_,i)=>assignPublicReference(db,String(i),date)));
 assert.equal(new Set(refs).size,30);
 const duplicate=await Promise.all(Array.from({length:10},()=>assignPublicReference(db,'0',date)));
 assert.ok(duplicate.every(ref=>ref===refs[0]));
 assert.equal(sql.prepare('SELECT last_sequence FROM quote_reference_counters WHERE year=2026').get().last_sequence,30);
});
test('unaccepted and already-sent legacy requests receive no new number',async()=>{
 const {db,sql,reserve}=fixture();reserve('old','sent');
 await assert.rejects(assignPublicReference(db,'missing',date));await assert.rejects(assignPublicReference(db,'old',date));
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM quote_reference_counters').get().n,0);
});
test('guard expiry removes only its mapping; year counters persist and numbers are never reused',async()=>{
 const {db,sql,reserve}=fixture();reserve('old');await assignPublicReference(db,'old',date);
 sql.prepare('DELETE FROM quote_guard WHERE request_key=?').run('old');
 assert.equal(await publicReference(db,'old'),undefined);reserve('new');
 assert.equal(await assignPublicReference(db,'new',date),'Q-SITE-2026-0002');
});
test('schema preflight is read-only and missing infrastructure fails before allocation',async()=>{
 const {db,sql,reserve}=fixture(false);reserve('legacy');await assert.rejects(checkNumberingSchema(db));
 assert.equal(sql.prepare('SELECT reference FROM quote_guard').get().reference,'HT-internal-legacy');
 const before=sql.prepare('SELECT COUNT(*) AS n FROM quote_guard').get().n;
 sql.exec(readFileSync(new URL('../server/migrations/0001-website-quote-numbering.sql',import.meta.url),'utf8'));
 await checkNumberingSchema(db);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM quote_guard').get().n,before);
});
test('transaction rollback cannot consume a year sequence when mapping insertion fails',async()=>{
 const {db,sql,reserve}=fixture();reserve('ok');await assignPublicReference(db,'ok',date);reserve('fail');
 sql.exec("CREATE TRIGGER fail_mapping BEFORE INSERT ON quote_public_references WHEN NEW.request_key='fail' BEGIN SELECT RAISE(ABORT,'test failure'); END;");
 await assert.rejects(assignPublicReference(db,'fail',date));
 assert.equal(sql.prepare('SELECT last_sequence FROM quote_reference_counters WHERE year=2026').get().last_sequence,1);
});
