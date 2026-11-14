import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SERVICE_PAGES, COMMON} from '../data/service-pages.mjs';
import {BY_ID, VERSION, AREAS, calculate, money} from '../js/pricing-catalogue.mjs';
import {PROJECTS} from '../js/project-data.mjs';
const root=new URL('../',import.meta.url),origin='https://hometechmayo.ie';
const read=p=>readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absolute=s=>'/'+s.replace(/^\//,'');
const quote=p=>`/quote?category=${p.category}`;
export function priceRows(page){
 const rows=page.prices.map(row=>{
  const service=BY_ID.get(row.id);if(!service)throw Error('Unknown catalogue service '+row.id);
  let cents=service.price,label=row.label||service.name,unit=service.kind==='hourly'?' per hour':'';
  if(row.addon){const choice=service.options[row.addon].choices.find(c=>c.value===row.value);cents=choice.price;unit='';}
  else if(row.options){const e=calculate([{id:row.id,quantity:1,materials:'yes',options:row.options}],'Foxford');cents=e.lines[0].customWork?null:row.visitMinimum?e.labour+e.minimumAdjustment:e.lines[0].known;}
  return {...row,label,cents,display:cents===null?'Custom Quote':row.id==='pc-diagnostics'&&!row.visitMinimum?money(cents):`From ${money(cents)}${unit}`,source:`js/pricing-catalogue.mjs: ${row.id}${row.options?' / '+JSON.stringify(row.options):''}${row.addon?' / '+row.addon+'='+row.value:''}`,note:row.note||''};
 });

 return rows;
}
function actions(page){return `<div class="landing-actions"><a class="btn btn-primary" href="${quote(page)}">Request a Quote</a><a class="btn btn-secondary" href="https://wa.me/353833498496" target="_blank" rel="noopener noreferrer">WhatsApp us</a><a class="landing-call" href="tel:+353833498496">Call 083 349 8496</a></div>`;}
function photo(projectId,index=0,eager=false){
 const project=PROJECTS.find(p=>p.id===projectId),image=project?.images[index];if(!image)throw Error('Unknown verified project image');
 const srcset=image.srcset.split(',').map(v=>'/'+v.trim()).join(', ');
 return `<img src="${absolute(image.src)}" srcset="${escape(srcset)}" sizes="(max-width: 760px) 92vw, 45vw" alt="${escape(image.alt)}" width="${image.width}" height="${image.height}" loading="${eager?'eager':'lazy'}" decoding="async"${eager?' fetchpriority="high"':''}>`;
}
const source=read('services.html');
const header=source.match(/    <header>[\s\S]*?<\/header>/)[0].replace(/ aria-current="page"/g,'');
const tail=source.slice(source.indexOf('    <footer>')).replace(/ aria-current="page"/g,'').replace(/    <div id="whatsappWidget"[\s\S]*?    <\/div>\n\n/,'');
// Inline contact actions keep these long-form pages free of floating overlays.
const landingTail=tail.replace(/    <button id="backToTop"[\s\S]*?<\/button>/, '<div class="container"><a class="landing-back-top" href="#main-content">Back to top ↑</a></div>').replace(/    <a\n[\s\S]*?class="whatsapp-float"[\s\S]*?<\/a>\n/, '');
const rootAssets=s=>s.replace(/\b(href|src)="(assets|css|js)\//g,'$1="/$2/');
export function renderServicePage(page,{publish=false}={}){
 const path='/services/'+page.slug,url=origin+path;
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'Service','@id':url+'#service',name:page.name,serviceType:page.name,description:page.intro,url,provider:{'@id':origin+'/#business'},areaServed:{'@type':'AdministrativeArea',name:'County Mayo, Ireland'}},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},{'@type':'ListItem',position:2,name:'Services',item:origin+'/services'},{'@type':'ListItem',position:3,name:page.name,item:url}]}
 ]};
 const head=source.slice(0,source.indexOf('  <body')).replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(page.title)}</title>`)
 .replace(/(<meta\s+name="description"\s+content=")[^"]+/,(_,prefix)=>prefix+escape(page.description))
 .replace(/<meta\s+name="keywords"[\s\S]*?\/>/,'')
 .replace(/(<meta\s+property="og:title"\s+content=")[^"]+/,(_,prefix)=>prefix+escape(page.title))
 .replace(/(<meta\s+property="og:description"\s+content=")[^"]+/,(_,prefix)=>prefix+escape(page.description))
 .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]+/,(_,prefix)=>prefix+escape(page.title))
 .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]+/,(_,prefix)=>prefix+escape(page.description))
 .replaceAll('https://hometechmayo.ie/services"',url+'"')
 // Use the brand logo for sharing; the desk Hero is not a repair case study.
 .replace(/https:\/\/hometechmayo.ie\/assets\/hero\/hero.jpg/g,origin+'/assets/logo/logo-email.png')
 .replace(/<meta property="og:image:(?:width|height)"[^>]*>\s*/g,'')
 .replace('content="Modern home technology setup"','content="Home Tech Solutions &amp; Services logo"')
 .replace('  </head>',`    <meta name="robots" content="${publish?'index, follow':'noindex, follow'}" />\n    <link rel="stylesheet" href="/css/service-landing.css" />\n    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>\n  </head>`);
 const rows=priceRows(page);
 const sections=page.sections.map(s=>`<section class="landing-section"><h2>${escape(s.title)}</h2><p>${escape(s.text)}</p>${s.items?`<ul class="landing-list">${s.items.map(i=>`<li>${escape(i)}</li>`).join('')}</ul>`:''}</section>`).join('\n');
 const projects=page.projects.length?`<section class="landing-projects" aria-labelledby="work-title"><h2 id="work-title">Completed work</h2><div class="landing-project-grid">${page.projects.map(ref=>{const project=PROJECTS.find(p=>p.id===ref.id);return `<article class="landing-project-card"><a href="/#project-${escape(project.id)}" aria-label="View ${escape(project.title)} and its photographs">${photo(ref.id,ref.image)}</a><div><h3>${escape(project.title)}</h3><p>${escape(ref.text)}</p><a href="/#project-${escape(project.id)}">View project and photographs →</a></div></article>`;}).join('')}</div></section>`:'';
 const related=SERVICE_PAGES.filter(p=>p!==page).map(p=>`<a href="/services/${p.slug}">${escape(p.name)} →</a>`).join('');
 return rootAssets(`${head}  <body class="services-page service-landing" data-service-category="${page.category}">
    <a class="skip-link" href="#main-content">Skip to main content</a>
${header.replace('href="/#contact" class="quote-button"',`href="${quote(page)}" class="quote-button"`)}
    <main id="main-content">
      <section class="landing-hero" aria-labelledby="service-title"><div class="container">
        <nav class="landing-breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/services">Services</a></li><li aria-current="page">${escape(page.name)}</li></ol></nav>
        <div class="landing-hero-grid"><div><p class="landing-eyebrow">Home Tech Solutions &amp; Services · County Mayo</p><h1 id="service-title">${escape(page.h1)}</h1><p class="landing-intro">${escape(page.intro)}</p>${actions(page)}</div>
        ${page.hero?`<figure class="landing-hero-photo">${photo(page.hero.project,page.hero.image,true)}<figcaption>Completed JYSK furniture assembly, Westport. <a href="/#project-westport-furniture-assembly">View the project</a>.</figcaption></figure>`:`<aside class="landing-preparation"><h2>${escape(page.quickTitle)}</h2><ul>${page.checklist.map(i=>`<li>${escape(i)}</li>`).join('')}</ul><a href="${quote(page)}">Build an indicative estimate →</a></aside>`}</div>
      </div></section>
      <div class="container landing-main-grid"><div>${sections}</div>
      <aside id="service-prices" class="landing-prices" aria-labelledby="prices-title"><p class="landing-eyebrow">Labour starting prices</p><h2 id="prices-title">${escape(page.name)} prices</h2><p>${escape(page.pricingIntro)}</p>
      <dl class="landing-price-list">${rows.map(row=>`<div${row.id?` data-service="${row.id}"`:''}${row.cents!==null?` data-price-cents="${row.cents}"`:''}><dt>${escape(row.label)}${row.note?`<small>${escape(row.note)}</small>`:''}</dt><dd>${escape(row.display)}</dd></div>`).join('')}</dl>
      <p class="landing-small">${escape(page.pricingNote||COMMON.pricingNote)}</p><a class="btn btn-primary" href="${quote(page)}">Estimate your job</a><a class="landing-price-link" href="/pricing">View all starting prices →</a></aside></div>
      <section class="landing-band" aria-labelledby="included-title"><div class="container landing-two-col"><div><h2 id="included-title">Materials and additional work</h2><p>${escape(COMMON.materials)}</p></div><div><h2>Several services in one visit?</h2><p>${escape(COMMON.discount)}</p></div></div></section>
      <section class="landing-section container" aria-labelledby="booking-title"><h2 id="booking-title">How to request a quote</h2><p class="landing-section-lead">${escape(page.quotePreparation)}</p><ol class="landing-process">${COMMON.process.map((step,i)=>`<li><span aria-hidden="true">${i+1}</span><div><h3>${escape(step[0])}</h3><p>${escape(step[1])}</p></div></li>`).join('')}</ol></section>
      <div class="container">${projects}</div>
      <section class="landing-area landing-band" aria-labelledby="area-title"><div class="container landing-two-col"><div><h2 id="area-title">Local help across County Mayo</h2><p>${escape(COMMON.area)}</p></div><div><h3>Travel per visit</h3><dl class="landing-travel">${Object.entries(AREAS).map(([area,cents])=>`<div><dt>${area==='Other'?'Other areas':area}</dt><dd>${cents===null?'Custom travel quote':money(cents)}</dd></div>`).join('')}</dl></div></div></section>
      <section class="landing-faq container landing-section" aria-labelledby="faq-title"><h2 id="faq-title">Your questions answered</h2>${page.faqs.map(([q,a])=>`<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('')}</section>
      <section class="landing-final" aria-labelledby="contact-title"><div class="container"><h2 id="contact-title">${escape(COMMON.finalTitle)}</h2><p>${escape(COMMON.finalText)}</p>${actions(page)}<p class="landing-email"><a href="mailto:info@hometechmayo.ie">info@hometechmayo.ie</a> <button type="button" class="contact-copy" data-copy-contact="email" hidden>Copy email</button></p><p id="contact-copy-status" class="contact-copy-status" role="status" aria-live="polite"></p></div></section>
      <section class="landing-related container landing-section" aria-labelledby="related-title"><h2 id="related-title">Other ways we can help</h2><div>${related}</div><a href="/services">Browse all services</a></section>
    </main>
${landingTail.replace('    <script src="js/main.js"></script>','    <script type="module" src="/js/contact-actions.mjs"></script>\n    <script src="js/main.js"></script>')}`);
}
export function renderContentReview(){
 let md='# Service landing pages — complete content review\n\nOwner-approved publication content. Generate production HTML with --publish; check it with --publish --check.\n\nAuthoritative catalogue version: '+VERSION+'. Prices are starting labour prices, not complete quotes.\n\n';
 for(const p of SERVICE_PAGES){
  md+=`## ${p.name}\n\nProposed URL: ${origin}/services/${p.slug}\n\nSEO title: ${p.title}\n\nMeta description: ${p.description}\n\n# ${p.h1}\n\n${p.intro}\n\n`;
  md+='Actions: Request a Quote → '+quote(p)+'; WhatsApp → https://wa.me/353833498496; Call → tel:+353833498496.\n\n';
  if(!p.hero)md+=`### ${p.quickTitle}\n\n${p.checklist.map(x=>'- '+x).join('\n')}\n\n`;
  for(const s of p.sections)md+=`### ${s.title}\n\n${s.text}\n\n${s.items?s.items.map(x=>'- '+x).join('\n')+'\n\n':''}`;
  md+=`### ${p.name} prices\n\n${p.pricingIntro}\n\n| Service | Displayed price | Authoritative source |\n|---|---|---|\n`;
  for(const r of priceRows(p))md+=`| ${r.label} | ${r.display}${r.note?' — '+r.note:''} | ${r.source.replaceAll('|','/')} |\n`;
  md+='\n'+(p.pricingNote||COMMON.pricingNote)+'\n\n### Materials and additional work\n\n'+COMMON.materials+'\n\n### Several services in one visit?\n\n'+COMMON.discount+'\n\n### How to request a quote\n\n'+p.quotePreparation+'\n\n'+COMMON.process.map(([h,t],i)=>`${i+1}. **${h}.** ${t}`).join('\n')+'\n\n';
  if(p.projects.length){md+='### Completed work\n\n';for(const ref of p.projects){const project=PROJECTS.find(v=>v.id===ref.id);md+=`**${project.title}**\n\n${ref.text}\n\nPhotograph: ${project.images[ref.image].src}. Alt text: ${project.images[ref.image].alt}. Project link: /#project-${ref.id}.\n\n`;}}
  md+='### Local help across County Mayo\n\n'+COMMON.area+'\n\n'+Object.entries(AREAS).map(([k,v])=>`${k}: ${v===null?'Custom travel quote':money(v)}`).join('; ')+'.\n\n### Your questions answered\n\n';
  for(const [q,a] of p.faqs)md+=`**${q}**\n\n${a}\n\n`;
  md+=`### ${COMMON.finalTitle}\n\n${COMMON.finalText}\n\nEmail: info@hometechmayo.ie (with Copy email fallback). Same Quote/WhatsApp/Call actions as above.\n\nRelated services: ${SERVICE_PAGES.filter(v=>v!==p).map(v=>v.name).join('; ')}. Also links to /services and /pricing.\n\nSearch-language ideas (not search-volume claims): ${p.phrases.join('; ')}.\n\n---\n\n`;
 }
 return md;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check'),publish=process.argv.includes('--publish');
 mkdirSync(new URL('services/',root),{recursive:true});mkdirSync(new URL('docs/',root),{recursive:true});
 const outputs=SERVICE_PAGES.map(p=>['services/'+p.slug+'.html',renderServicePage(p,{publish})]);outputs.push(['docs/SERVICE-PAGE-CONTENT-REVIEW.md',renderContentReview()]);
 for(const [path,text] of outputs){if(check){if(read(path)!==text)throw Error('Regenerate '+path);}else writeFileSync(new URL(path,root),text);}
 console.log(`${check?'Verified':'Generated'} five ${publish?'publication':'noindex review'} pages and complete content review.`);
}
