// Manual Chrome-only GA audit. Node 22+; no third-party packages.
// No changes to the website source. All HTTP(S) requests in test tabs are
// intercepted at Fetch.requestPaused and fulfilled locally, never continued.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=process.argv[2],tagFile=process.argv[3];
const selfTest=process.argv[4]==='--self-test';
if(!root||!tagFile){console.error('Usage: node manual-ga4-chrome.cjs "PROJECT_PATH" "FRESH_TAG_PATH" [--self-test]');process.exit(1)}
const project=path.resolve(root),tag=fs.readFileSync(path.resolve(tagFile),'utf8');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe')].find(p=>fs.existsSync(p));
if(!chrome)throw Error('Google Chrome not found');
if(!tag.includes('G-7H312MNH9B'))throw Error('Unexpected tag: measurement ID not found');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'htss-ga-manual-'));
fs.mkdirSync(path.join(project,'work'),{recursive:true});
const reportPath=path.join(project,'work',selfTest?'ga4-manual-chrome-selftest.json':'ga4-manual-chrome-result.json');
const report={startedAt:new Date().toISOString(),measurementId:'G-7H312MNH9B',tagSha256:require('node:crypto').createHash('sha256').update(tag).digest('hex'),sourceGateChanged:false,requestsForwarded:0,policyOverrides:0,tagLoads:0,visibility:[],measurements:[],blockedOther:[],errors:[]};
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
const child=spawn(chrome,['--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--new-window','about:blank'],{stdio:'ignore'});
let ws,next=0;const pending=new Map();
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'))},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))})}
function decode(s){for(let i=0;i<3;i++){try{s=decodeURIComponent(s)}catch{break}}return s}
function fields(req){const base=new URL(req.url);return (req.postData?req.postData.split(/\r?\n/):['']).map(l=>({...Object.fromEntries(base.searchParams),...Object.fromEntries(new URLSearchParams(l))}))}
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
async function fulfill(event,sessionId){
 const {request,requestId}=event,u=new URL(request.url);let body='',type='text/plain',code=204;
 if(u.origin==='http://127.0.0.1:8790'){
  if(u.pathname==='/api/quote-config'){code=200;type='application/json';body=JSON.stringify({enabled:false,siteKey:null,version:'manual-audit'});}
  else {
   const file=path.resolve(project,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
   const ext=path.extname(file);if(file.startsWith(project+path.sep)&&mime[ext]&&fs.existsSync(file)){
    body=fs.readFileSync(file);type=mime[ext];code=200;
    if(u.pathname==='/js/analytics-policy.mjs'){
     const original=body.toString();if(!/export const GOOGLE_CONFIGURATION_VERIFIED = (?:true|false);/.test(original))throw Error('Expected explicit source gate; inspect manually');
     body=original.replace('export const GOOGLE_CONFIGURATION_VERIFIED = false;','export const GOOGLE_CONFIGURATION_VERIFIED = true;');
     if(body!==original)report.policyOverrides++;
     console.log('FIXTURE POLICY: verified=true (response only; source unchanged; source gate '+(body===original?'already true':'false')+')');
    }
   }else code=404;
  }
 }else if(u.hostname==='www.googletagmanager.com'&&u.pathname==='/gtag/js') {body=tag;type='text/javascript';code=200;report.tagLoads++;console.log('GOOGLE TAG: fulfilled from local downloaded file');}
 else if(u.pathname.endsWith('/collect')){
  const rows=fields(request);const unsafeKeys=[...new Set(rows.flatMap(r=>Object.entries(r).filter(([,v])=>/SYNTHETIC_PRIVATE|0831234567|private@example\.com/.test(decode(v))).map(([k])=>k)))];
  report.measurements.push({at:new Date().toISOString(),url:request.url,body:request.postData||'',headers:request.headers,fields:rows,unsafeKeys});
  console.log('INTERCEPTED',rows.map(r=>({event:r.en,dl:r.dl,dr:r.dr,_ss:r._ss,_et:r._et})),unsafeKeys.length?'UNSAFE: '+unsafeKeys.join(','):'');
 }else report.blockedOther.push({url:request.url,body:request.postData||''});
 await send('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:type},{name:'Cache-Control',value:'no-store'},{name:'Access-Control-Allow-Origin',value:'*'}],...(code!==204?{body:Buffer.from(body).toString('base64')}:{})},sessionId);save();
}
async function configure(sessionId,targetId){try{
 await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sessionId);
 // Page must be enabled before registering the init script. Otherwise CDP
 // accepts addScriptToEvaluateOnNewDocument but the debug/visibility bootstrap
 // does not run, and localhost Analytics correctly remains disabled.
 await send('Page.enable',{},sessionId);
 await send('Runtime.enable',{},sessionId);await send('Runtime.addBinding',{name:'__htssAuditVisibility'},sessionId);
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{let debug=null,storageError=null;try{sessionStorage.setItem('htss_ga_debug','1');debug=sessionStorage.getItem('htss_ga_debug')}catch(e){storageError=String(e)};const record=e=>window.__htssAuditVisibility(JSON.stringify({state:document.visibilityState,trusted:e?e.isTrusted:null,href:location.href,at:Date.now(),debug,storageError}));document.addEventListener('visibilitychange',record);record(null)})();`},sessionId);
 await send('Runtime.runIfWaitingForDebugger',{},sessionId);
 }catch(e){report.errors.push(String(e));save();console.error('Interception setup failed; closing tab:',String(e));await send('Target.closeTarget',{targetId}).catch(()=>{});throw e;}}
(async()=>{
 const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await new Promise(r=>setTimeout(r,100));
 if(!fs.existsSync(active))throw Error('Chrome debugging endpoint unavailable');
 const lines=fs.readFileSync(active,'utf8').trim().split(/\r?\n/);ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 const ready=new Map();
 ws.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}return}
  try{
   if(m.method==='Target.attachedToTarget'){const s=m.params.sessionId;const promise=configure(s,m.params.targetInfo.targetId);ready.set(m.params.targetInfo.targetId,{sessionId:s,promise});await promise;}
   if(m.method==='Fetch.requestPaused')await fulfill(m.params,m.sessionId);
   if(m.method==='Runtime.bindingCalled'&&m.params.name==='__htssAuditVisibility'){const value=JSON.parse(m.params.payload);report.visibility.push(value);console.log('VISIBILITY',value);save();}
   if(m.method==='Runtime.exceptionThrown'){const value=m.params.exceptionDetails;report.errors.push(value.exception?.description||value.text);save();console.error('PAGE ERROR',value.exception?.description||value.text);}
  }catch(err){report.errors.push(String(err));save();console.error(String(err));}
 });
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'page',exclude:false},{type:'iframe',exclude:false},{exclude:true}]});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 for(let i=0;i<100&&!ready.has(targetId);i++)await new Promise(r=>setTimeout(r,50));
 const entry=ready.get(targetId);if(!entry)throw Error('Could not attach to audit tab');await entry.promise;
 await send('Page.navigate',{url:'http://127.0.0.1:8790/pricing.html?utm_source=google&utm_medium=cpc&utm_campaign=mayo&email=private%40example.com&phone=0831234567&q=SYNTHETIC_PRIVATE_SEARCH#SYNTHETIC_PRIVATE_HASH',referrer:'https://www.google.ie/search?q=SYNTHETIC_PRIVATE_REF'},entry.sessionId);
 console.log('\nManual Chrome audit ready. Requests are fulfilled locally; source gate is unchanged.');
 console.log('Use ONLY synthetic data. Open DevTools, Accept analytics, wait 15 seconds, switch tabs with Ctrl+L, about:blank in a NEW tab.');
 console.log('Require trusted VISIBILITY hidden and inspect intercepted user_engagement. Do not close this terminal. Ctrl+C to end.');
 console.log('Report:',reportPath);save();
 if(selfTest){
  const assert=require('node:assert/strict');
  const evaluate=async expression=>{const x=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},entry.sessionId);if(x.exceptionDetails)throw Error(x.exceptionDetails.text);return x.result?.value;};
  for(let i=0;i<100;i++){if(await evaluate(`!!document.querySelector('[data-choice=accept]')`))break;await new Promise(r=>setTimeout(r,100));}
  const inspect=()=>evaluate(`(async()=>({debug:sessionStorage.getItem('htss_ga_debug'),verified:(await import('/js/analytics-policy.mjs')).GOOGLE_CONFIGURATION_VERIFIED,gtag:typeof window.gtag,script:!!document.getElementById('htss-ga-tag'),cookies:document.cookie}))()`);
  report.beforeAccept=await inspect();assert.equal(report.beforeAccept.debug,'1');assert.equal(report.beforeAccept.verified,true);assert.equal(report.beforeAccept.gtag,'undefined');assert.equal(report.tagLoads,0);assert.equal(report.measurements.length,0);
  await evaluate(`document.querySelector('[data-choice=accept]').click()`);
  for(let i=0;i<100&&!report.measurements.some(m=>m.fields.some(f=>f.en==='page_view'));i++)await new Promise(r=>setTimeout(r,100));
  report.afterAccept=await inspect();assert.equal(report.afterAccept.gtag,'function');assert.equal(report.afterAccept.script,true);assert.equal(report.tagLoads,1);
  assert(report.afterAccept.cookies.includes('htss_ga='));assert(report.measurements.some(m=>m.fields.some(f=>f.en==='page_view')));assert(report.measurements.every(m=>m.unsafeKeys.length===0));
  assert(report.measurements.flatMap(m=>m.fields).every(f=>(!f.dl||f.dl==='https://hometechmayo.ie/pricing.html')&&(!f.dr||f.dr==='https://www.google.ie/')));
  await evaluate(`document.querySelector('footer [data-cookie-settings]').click();document.querySelector('#cookie-analytics-toggle').checked=false;document.querySelector('#cookie-save').click()`);
  await new Promise(r=>setTimeout(r,300));const count=report.measurements.length;
  await evaluate(`window.gtag('event','phone_click',{placement:'footer'})`);await new Promise(r=>setTimeout(r,1200));assert.equal(report.measurements.length,count);
  report.afterWithdrawal=await inspect();assert(!report.afterWithdrawal.cookies.includes('htss_ga'));assert.equal(report.errors.length,0);
  report.selfTestPassed=true;report.endedAt=new Date().toISOString();save();console.log('SELF-TEST PASS:',report.beforeAccept,report.afterAccept);await send('Browser.close');process.exit(0);
 }
 process.on('SIGINT',async()=>{report.endedAt=new Date().toISOString();save();await send('Browser.close').catch(()=>{});process.exit(0)});
})().catch(e=>{report.errors.push(String(e));save();console.error(e);child.kill();process.exit(1)});
