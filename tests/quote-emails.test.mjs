import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {calculate, VERSION} from '../js/pricing-catalogue.mjs';
import {createQuoteEmails, EMAIL_LOGO_URL, escapeHTML, receivedLabel} from '../server/quote-emails.mjs';
const env={QUOTE_FROM_EMAIL:'info@hometechmayo.ie',QUOTE_TO_EMAIL:'info@hometechmayo.ie'};
const item=(id,quantity=1,options={})=>({id,quantity,materials:'yes',options});
const make=(items=[item('furniture-small',2),item('furniture-drawers')],area='Castlebar',customer={})=>{
 const estimate=calculate(items,area);
 const data={reference:'HT-20261017-DD502E2A-D7E',receivedAt:'2026-10-17T13:30:00Z',version:VERSION,estimate,customer:{name:'Alex Example',email:'alex@example.com',phone:'0000000000',eircode:'',description:'Please assemble the items.\nAccess is via the hall.',availability:'Weekday mornings',materialsInformation:'I have all fixings.',...customer}};
 return {...createQuoteEmails(data,env),data};
};
const textOf=html=>html.replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");

test('customer and business multipart emails use the exact approved sample and logo',()=>{
 const {business,acknowledgement}=make();
 for(const mail of [business,acknowledgement]) {
  assert.ok(mail.htmlContent.startsWith('<!doctype html>'));
  assert.match(mail.htmlContent,/Small furniture item × 2/);assert.match(mail.textContent,/Small furniture item × 2/);
  assert.match(mail.htmlContent,/Chest of drawers × 1/);
  assert.match(mail.htmlContent,/€100\.00/);assert.match(mail.htmlContent,/€70\.00/);
  assert.match(mail.htmlContent,/€170\.00/);assert.match(mail.textContent,/Estimated known total: €170\.00/);
  assert.match(mail.htmlContent,/HT-20261017-DD502E2A-D7E/);
  assert.ok(mail.htmlContent.includes(EMAIL_LOGO_URL));assert.ok(mail.htmlContent.includes('alt="Home Tech Solutions &amp; Services logo"'));
  assert.doesNotMatch(mail.htmlContent,/× \d+ items|<svg|<script|<link|<style|@font-face|display:\s*(grid|flex)|background-image/i);
  assert.equal([...mail.htmlContent.matchAll(/<img\b/g)].length,1,'only the own-domain logo, no tracking pixels');
  assert.match(mail.htmlContent,/max-width:600px/);assert.match(mail.htmlContent,/\[if mso\]/);
  assert.match(mail.htmlContent,/not a confirmed quotation or booking/);assert.match(mail.textContent,/not a confirmed quotation or booking/);
  assert.match(mail.htmlContent,/€0\.00/);assert.match(mail.htmlContent,/EUR/);
 }
 assert.match(acknowledgement.htmlContent,/Thank you for your request!/);
 assert.match(acknowledgement.htmlContent,/Hi Alex Example,/);
 assert.match(business.htmlContent,/provided by customer/);
 assert.match(business.htmlContent,/Europe\/Dublin/);
});

test('all customer text, line labels and references are escaped and line breaks preserved',()=>{
 const dangerous=`<img src=x onerror="alert(1)"> & 'quoted'`;
 const data=make().data;
 data.customer={...data.customer,name:dangerous,description:'First line\n<script>alert(2)</script>\r\nLast line',materialsInformation:'</td><a href="https://bad.example">bad</a>',availability:'<iframe>bad</iframe>',eircode:'<input>'};
 data.reference='<script>reference</script>';
 data.estimate.lines[0].name=dangerous;
 data.estimate.lines[0].optionLabels=[dangerous];
 const emails=createQuoteEmails(data,env);
 for(const mail of [emails.business,emails.acknowledgement]) {
  assert.ok(mail.htmlContent.includes(escapeHTML(dangerous)));
  assert.ok(mail.htmlContent.includes('First line<br>&lt;script&gt;alert(2)&lt;/script&gt;<br>Last line'));
  assert.doesNotMatch(mail.htmlContent,/<script|<iframe|<input|<img src=x|<a href="https:\/\/bad/i);
  assert.match(mail.htmlContent,/&lt;\/td&gt;/);
  assert.equal([...mail.htmlContent.matchAll(/<img\b/g)].length,1);
 }
 assert.match(emails.business.htmlContent,/&lt;input&gt;/);
 assert.equal(escapeHTML('&<>"\''),'&amp;&lt;&gt;&quot;&#39;');
});

test('HTML and text match authoritative discounts, travel, minimum and materials',()=>{
 for(const [items,area] of [
  [[item('wifi-printer')],'Westport'],
  [[item('furniture-small',5)],'Castlebar'],
  [[item('furniture-small',6)],'Ballina'],
  [[item('furniture-small',11)],'Westport'],
  [[item('handyman-half',1,{extraHours:2})],'Castlebar'],
  [[item('wifi-troubleshoot',2)],'Castlebar'],
  [[{...item('wifi-printer'),materials:'no'}],'Other']
 ]) {
  const {business,acknowledgement,data:{estimate:e}}=make(items,area);
  for(const mail of [business,acknowledgement]) {
   const text=textOf(mail.htmlContent);
   for(const label of ['Labour subtotal','Discount','Travel','Materials','Estimated known total'])assert.ok(text.includes(label));
   for(const cents of [e.labour,e.discount,e.total,...e.lines.map(l=>l.known)]) {
    const value=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(cents/100);
    assert.ok(text.includes(value),value);assert.ok(mail.textContent.includes(value),value);
   }
   assert.ok(text.includes(`Discount (${e.discountPercent}%)`));
   assert.equal(mail.htmlContent.includes('Minimum labour adjustment'),Boolean(e.minimumAdjustment));
   assert.equal(mail.textContent.includes('Minimum labour adjustment'),Boolean(e.minimumAdjustment));
   if(e.incomplete){assert.match(mail.htmlContent,/not a complete quotation/);assert.match(mail.textContent,/not a complete quotation/);}
  }
 }
});

test('custom work preserves known labour; custom-only totals and unknown travel stay explicit',()=>{
 const mixed=make([item('tv-mount'),item('shelving-custom')],'Other');
 for(const mail of [mixed.business,mixed.acknowledgement]) {
  assert.match(mail.htmlContent,/€80\.00\+/);assert.match(mail.textContent,/Estimated known total: €80\.00\+/);
  assert.match(mail.htmlContent,/Custom Quote — excluded/);assert.match(mail.textContent,/Custom Quote — excluded/);
 }
 const custom=make([item('vent-core')]);
 for(const mail of [custom.business,custom.acknowledgement]) {
  assert.match(mail.textContent,/Estimated known total: Custom Quote/);assert.match(mail.htmlContent,/equipment rental/);
  assert.match(mail.htmlContent,/minimum €50 per separate visit/);
 }
});

test('TV bundle labels preserve options without charging the standard installation twice',()=>{
 const {business,acknowledgement,data}=make([item('tv-mount',2,{size:'medium',installation:'inclusive',cables:'yes'})]);
 assert.equal(data.estimate.labour,0);
 for(const mail of [business,acknowledgement]) {
  assert.match(mail.textContent,/All-inclusive/);assert.match(mail.htmlContent,/Custom Quote/);
  assert.doesNotMatch(mail.htmlContent,/€220\.00/);
 }
});

test('optional contact fields and absent email have safe defaults; Reply-To is correct',()=>{
 const absent=make(undefined,undefined,{email:'',eircode:'',description:'',availability:'',materialsInformation:''});
 assert.equal(absent.acknowledgement,null);assert.equal(absent.business.replyTo,undefined);
 assert.match(absent.business.htmlContent,/Not provided/);assert.match(absent.business.textContent,/Not provided/);
 const {business,acknowledgement}=make();
 assert.deepEqual(business.to,[{email:'info@hometechmayo.ie'}]);
 assert.deepEqual(business.replyTo,{email:'alex@example.com',name:'Alex Example'});
 assert.deepEqual(acknowledgement.to,[{email:'alex@example.com'}]);
 assert.deepEqual(acknowledgement.replyTo,{email:'info@hometechmayo.ie'});
});

test('Irish receipt time uses Europe/Dublin explicitly across daylight saving',()=>{
 assert.match(receivedLabel('2026-10-17T13:30:00Z'),/14:30:00/);
 assert.match(receivedLabel('2026-12-17T13:30:00Z'),/13:30:00/);
 assert.match(receivedLabel('2026-10-17T13:30:00Z'),/Europe\/Dublin/);
});

test('PNG logo is transparent, high resolution and derived at original SVG aspect ratio',async()=>{
 const path=new URL('../assets/logo/logo-email.png',import.meta.url);
 const image=sharp(readFileSync(path)),meta=await image.metadata();
 assert.equal(meta.format,'png');assert.equal(meta.width,720);assert.equal(meta.hasAlpha,true);
 assert.ok(Math.abs(meta.width/meta.height-9790.04/8253.22)<0.002);
 const {data,info}=await image.raw().toBuffer({resolveWithObject:true});let transparent=0,ink=0;
 for(let i=0;i<data.length;i+=info.channels) {
  if(data[i+3]===0)transparent++;
  else {ink++;assert.equal(data[i],255);assert.equal(data[i+1],255);assert.equal(data[i+2],255);}
 }
 assert.ok(transparent>0 && ink>0);
});
