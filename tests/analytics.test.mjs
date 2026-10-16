import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONSENT_MAX_AGE, CONSENT_KEY, MEASUREMENT_ID, consentRecord, parseConsent, safePage, landingContext, eventParameters, trackingEnvironment} from '../js/analytics-policy.mjs';
import {createAnalytics} from '../js/analytics.mjs';
const files = ['index.html','services.html','pricing.html','quote.html','privacy.html','404.html'];
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
function browser({href='https://hometechmayo.ie/quote.html?utm_source=google&utm_medium=cpc&utm_campaign=mayo&email=private@example.com',referrer='https://www.google.ie/search?q=private@example.com',debug=false,existing=false,configurationVerified=true}={}) {
 const scripts=[], cookies=new Map();
 class Doc extends EventTarget {
  constructor(){super();this.referrer=referrer;this.head={append:node=>scripts.push(node)};}
  get cookie(){return [...cookies].map(([k,v])=>`${k}=${v}`).join('; ');}
  set cookie(value){const [pair,...rest]=value.split(';');const [name,content]=pair.split('=');if(rest.some(s=>s.trim()==='Max-Age=0'))cookies.delete(name);else cookies.set(name,content);}
  createElement(){return new EventTarget();}
  querySelector(){return existing?{}:null;}
 }
 const doc=new Doc(), location=new URL(href),win={location,sessionStorage:{getItem:()=>debug?'1':null}};
 const controller=createAnalytics(win,doc,{configurationVerified});
 const commands=()=>Array.from(win.dataLayer||[],args=>Array.from(args));
 return {controller,win,doc,scripts,cookies,commands,load:()=>scripts[0].dispatchEvent(new Event('load'))};
}

test('all six HTML pages have exactly one consent entry, stylesheet and settings control',()=>{
 for(const file of files){const html=read(file);assert.equal((html.match(/src="js\/cookie-consent.mjs"/g)||[]).length,1,file);assert.equal((html.match(/href="css\/cookie-consent.css"/g)||[]).length,1,file);assert.ok(html.includes('data-cookie-settings'),file);assert.equal(/<script[^>]*src="https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com/.test(html),false,file);}
});
test('consent is versioned, expires and invalid/future storage is denied',()=>{
 const now=1800000000000;const record=consentRecord(true,now);
 assert.equal(parseConsent(JSON.stringify(record),now+100).analytics,true);
 assert.equal(parseConsent(JSON.stringify(consentRecord(false,now)),now).analytics,false);
 for(const raw of ['broken','null','{}',JSON.stringify({...record,version:0}),JSON.stringify({...record,analytics:'true'}),JSON.stringify({...record,savedAt:now+1})]) assert.equal(parseConsent(raw,now),null);
 assert.equal(parseConsent(JSON.stringify(record),now+CONSENT_MAX_AGE),null);
});
test('pending attribution preserves only known UTM values and referral origins',()=>{
 const data=landingContext('https://hometechmayo.ie/quote?category=furniture&utm_source=google&utm_medium=cpc&utm_campaign=mayo&utm_content=private@example.com&utm_term=0831234567&name=Secret&gclid=private#email=private', 'https://www.google.ie/search?q=Secret+Person&email=private');
 assert.deepEqual(data,{page_location:'https://hometechmayo.ie/quote.html',page_title:'Request a Quote',page_referrer:'https://www.google.ie/',campaign_source:'google',campaign_medium:'cpc',campaign_name:'mayo'});
 assert.equal(Object.isFrozen(data),true);
});
test('unknown labels, duplicate UTM keys and private referrers are never forwarded',()=>{
 const data=landingContext('https://hometechmayo.ie/private@example.com?utm_source=private@example.com&utm_medium=email&utm_campaign=0831234567&utm_source=google','https://customer-name.example/job/private@example.com');
 assert.equal(data.page_location,'https://hometechmayo.ie/404.html');assert.equal(data.page_referrer,'');assert.equal(data.campaign_name,undefined);assert.equal(data.campaign_source,'external-referral');assert.equal(data.campaign_medium,'referral');
 assert.equal(safePage('/unknown-secret').page_title,'Page Not Found');
 const same=landingContext('https://hometechmayo.ie/quote.html','https://hometechmayo.ie/pricing?email=private#secret');assert.equal(same.page_referrer,'https://hometechmayo.ie/pricing.html');
});
test('event parameters only accept fixed names and enumeration values',()=>{
 assert.equal(eventParameters('form_submit'),null);assert.equal(eventParameters('quote_interaction',{action:'private@example.com'}),null);
 assert.deepEqual(eventParameters('phone_click',{placement:'footer',phone:'0831234567',email:'private@example.com'}),{placement:'footer'});
 assert.deepEqual(eventParameters('generate_lead',{reference:'PRIVATE',value:500,email:'private@example.com'}),{method:'website_quote_form'});
});
test('preview tracking is disabled unless a local developer explicitly opts into debug',()=>{
 assert.equal(trackingEnvironment('hometechmayo.ie'),true);assert.equal(trackingEnvironment('127.0.0.1'),false);assert.equal(trackingEnvironment('127.0.0.1',true),true);assert.equal(trackingEnvironment('preview.pages.dev',true),false);
});
test('unknown/rejected consent never inserts a Google tag or queues analytics',()=>{
 const b=browser();assert.equal(b.scripts.length,0);b.doc.dispatchEvent(new CustomEvent('htss:quote-step',{detail:{step:2}}));b.controller.setConsent(false);assert.equal(b.scripts.length,0);assert.equal(b.win.dataLayer,undefined);assert.equal(b.win[`ga-disable-${MEASUREMENT_ID}`],true);
});
test('consent enables one config and one page view, with memory-only safe attribution',()=>{
 const b=browser();b.controller.setConsent(true);assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].referrerPolicy,'no-referrer');b.load();b.controller.setConsent(true);
 assert.equal(b.commands().filter(c=>c[0]==='config').length,1);assert.equal(b.commands().filter(c=>c[1]==='page_view').length,1);
 const config=b.commands().find(c=>c[0]==='config')[2];assert.equal(config.send_page_view,false);assert.equal(config.allow_google_signals,false);assert.equal(config.cookie_prefix,'htss');assert.equal(config.campaign_name,'mayo');assert.equal(JSON.stringify(b.commands()).includes('private@example.com'),false);
});
test('withdrawal immediately disables GA, clears only owned cookies and drops events',()=>{
 const b=browser();b.controller.setConsent(true);b.load();b.cookies.set('htss_ga','id');b.cookies.set('htss_ga_7H312MNH9B','id');b.cookies.set('security','keep');b.controller.setConsent(false);
 assert.equal(b.win[`ga-disable-${MEASUREMENT_ID}`],true);assert.deepEqual([...b.cookies.keys()],['security']);
 const count=b.commands().length;b.doc.dispatchEvent(new CustomEvent('htss:quote-step',{detail:{step:3}}));assert.equal(b.commands().length,count);
 b.controller.setConsent(true);assert.equal(b.scripts.length,1);assert.equal(b.commands().filter(c=>c[1]==='page_view').length,1);
});
test('revoking during script loading drops pending events; later consent can recover',()=>{
 const b=browser();b.controller.setConsent(true);b.doc.dispatchEvent(new CustomEvent('htss:quote-step',{detail:{step:2}}));b.controller.setConsent(false);b.load();assert.equal(b.commands().length,0);
 b.controller.setConsent(true);assert.equal(b.commands().filter(c=>c[1]==='page_view').length,1);assert.equal(b.commands().filter(c=>c[1]==='quote_interaction').length,0);
});
test('a lead is distinct from interactions and counted once only with active consent',()=>{
 const b=browser();b.controller.setConsent(true);b.load();b.doc.dispatchEvent(new CustomEvent('htss:quote-step',{detail:{step:2}}));assert.equal(b.commands().filter(c=>c[1]==='generate_lead').length,0);
 b.doc.dispatchEvent(new CustomEvent('htss:quote-submitted'));b.doc.dispatchEvent(new CustomEvent('htss:quote-submitted'));assert.equal(b.commands().filter(c=>c[1]==='generate_lead').length,1);
 const denied=browser();denied.doc.dispatchEvent(new CustomEvent('htss:quote-submitted'));denied.controller.setConsent(true);denied.load();assert.equal(denied.commands().filter(c=>c[1]==='generate_lead').length,0);
});
test('existing tracking installation or tag load failure cannot break the quote flow',()=>{
 const b=browser({existing:true});b.controller.setConsent(true);assert.equal(b.scripts.length,0);
 const blocked=browser();blocked.controller.setConsent(true);assert.doesNotThrow(()=>blocked.scripts[0].dispatchEvent(new Event('error')));assert.equal(blocked.commands().filter(c=>c[1]==='generate_lead').length,0);
});
test('quote analytics hook is inside confirmed-success branch, never in failure/finally',()=>{
 const source=read('js/pricing-calculator.mjs');assert.equal((source.match(/htss:quote-submitted/g)||[]).length,1);
 const guard=source.indexOf('if (!response.ok || !result.ok)');const success=source.indexOf("if (result.ok === true) document.dispatchEvent(new CustomEvent('htss:quote-submitted'))");const final=source.indexOf('  } finally {',guard);assert.ok(success>guard&&success<final);
});

test('production fails closed until account settings are verified; debug cannot bypass on production',()=>{
 for(const href of ['https://hometechmayo.ie/','http://127.0.0.1:8788/']) {const b=browser({href,configurationVerified:false,debug:true});b.controller.setConsent(true);assert.equal(b.scripts.length,0);assert.equal(b.win[`ga-disable-${MEASUREMENT_ID}`],true);}
});
