import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleQuote} from '../server/quote.mjs';
import {VERSION} from '../js/pricing-catalogue.mjs';
export function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of ['quote-guard.sql','migrations/0001-website-quote-numbering.sql','migrations/0002-website-enquiry-storage.sql','migrations/0003-enquiry-lease-safety.sql','migrations/0004-enquiry-recovery-backoff.sql'])sql.exec(readFileSync(new URL('../server/'+file,import.meta.url),'utf8'));
 const state={sql,fault:null,mails:[],mode:'ok'};
 const prepare=query=>{let args=[];const stmt={bind(...values){args=values;return stmt;},first:async()=>sql.prepare(query).get(...args),all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),execute:()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),query};return stmt;};
 const db={prepare,batch:async statements=>{if(state.fault&&statements.some(s=>s.query.includes(state.fault))){state.fault=null;throw new Error('synthetic crash');}sql.exec('BEGIN');try{const r=statements.map(s=>s.execute());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const env={SITE_ORIGIN:'https://example.invalid',BREVO_API_KEY:'synthetic',TURNSTILE_SECRET_KEY:'synthetic',TURNSTILE_SITE_KEY:'synthetic',QUOTE_FROM_EMAIL:'sender@example.invalid',QUOTE_TO_EMAIL:'owner@example.invalid',QUOTE_HASH_SECRET:'synthetic-only-'.repeat(4),QUOTE_GUARD:db,QUOTE_SITE_NUMBERING_ENABLED:'true',QUOTE_DURABLE_ENABLED:'true',INTAKE_SOURCE_ID:'synthetic',INTAKE_KEY_VERSION:'test',INTAKE_ENCRYPTION_KEYS:JSON.stringify({test:Buffer.alloc(32,7).toString('base64')})};
 const body={name:'Synthetic privacy sentinel',phone:'0830000000',email:'',area:'Castlebar',consent:true,version:VERSION,items:[{id:'wifi-printer',quantity:1,materials:'yes',options:{}}],requestId:crypto.randomUUID(),turnstileToken:'synthetic'};
 const fetcher=async(url,options)=>{if(url.includes('siteverify'))return Response.json({success:true,hostname:'example.invalid',action:'quote'});state.mails.push(JSON.parse(options.body));if(state.mode==='ackFail' && state.mails.length>1)return Response.json({error:'synthetic'},{status:503});if(state.mode==='timeout')throw new Error('Synthetic privacy sentinel');if(state.mode==='fail')return Response.json({error:'Synthetic privacy sentinel'},{status:503});return Response.json({messageId:'synthetic'});};
 const call=(value=body)=>handleQuote({request:new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(value)}),env},fetcher);
 return {...state,env,body,call,shared:state,count:t=>sql.prepare('SELECT count(*) n FROM '+t).get().n};
}
