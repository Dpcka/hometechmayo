import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {MIRROR_PROJECT as project} from '../data/mirror-project.mjs';
import {renderTestimonial} from './render-projects.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const origin='https://hometechmayo.ie',url=origin+project.detailUrl;
const title='Large Mirror Installation in Castlebar, Mayo | Home Tech Solutions & Services';
const description='Professional installation of a large 190 × 140 cm ornate mirror above a challenging staircase in Castlebar, Co. Mayo.';
const template=read('services/handyman.html');
const sharedAssets=template.match(/    <link rel="icon"[\s\S]*?<link rel="stylesheet" href="\/css\/service-landing.css" \/>/)[0];
const header=template.match(/    <header>[\s\S]*?<\/header>/)[0].replace(/ aria-current="page"/g,'');
const footer=template.slice(template.indexOf('    <footer>')).replace('<footer>','<footer class="footer">').replace('container footer-content','container footer-grid').replace('</body>','<script type="module" src="/js/project-gallery.mjs"></script>\n  </body>');
const photo=project.images[0];
const schema={'@context':'https://schema.org','@graph':[
  {'@type':'CreativeWork','@id':url+'#project',url,name:project.title,description:project.description+' '+project.extendedDescription,dateCreated:project.completionDate,creator:{'@id':origin+'/#business'},contentLocation:{'@type':'Place',name:project.location},image:project.images.map(i=>origin+'/'+i.full)},
  {'@type':'BreadcrumbList',itemListElement:[['Home',origin+'/'],['Projects',origin+'/#projects'],[project.title,url]].map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))},
]};
const html=`<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="Home Tech Solutions &amp; Services"><meta property="og:image" content="${origin}/${photo.full}"><meta property="og:image:alt" content="${escape(photo.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${origin}/${photo.full}">
${sharedAssets}<link rel="stylesheet" href="/css/projects.css"><link rel="stylesheet" href="/css/project-detail.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>
</head><body class="services-page service-landing project-detail">
<a class="skip-link" href="#main-content">Skip to main content</a>
${header}
<main id="main-content" class="container">
<nav class="landing-breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/#projects">Projects</a></li><li aria-current="page">Mirror installation in Castlebar</li></ol></nav>
<h1>${escape(project.title)}</h1><p class="landing-intro">${escape(project.description)}</p>
<p><a href="/services/handyman">Handyman Services</a> / <a href="/quote?category=handyman">Mirror &amp; Wall Mounting</a> · ${escape(project.location)}</p>
<dl class="project-facts"><div><dt>Completed</dt><dd><time datetime="2026-11-21">21 November 2026</time></dd></div><div><dt>Mirror dimensions</dt><dd>1900 × 1400 mm</dd></div><div><dt>Installation surface</dt><dd>Block wall</dd></div><div><dt>Team</dt><dd>Two people</dd></div><div><dt>Installation time</dt><dd>2 hours 21 minutes</dd></div></dl>
<article class="project-card project-detail-gallery" data-project-id="${project.id}" data-website-review-association="disabled" aria-label="Completed installation photographs">
<div class="project-photo"><a class="project-photo-open" href="/${photo.full}" aria-label="View photos: ${escape(project.title)}"><img src="/${photo.src}" srcset="${photo.srcset.split(', ').map(v=>'/'+v).join(', ')}" sizes="(max-width: 650px) 92vw, 720px" alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" decoding="async" fetchpriority="high"></a></div>
<div class="project-content"><h2>Completed installation gallery</h2><p>Four customer-provided photographs of this completed installation. Swipe or use the Left and Right arrow keys to browse. Open a photograph for the full-size viewer.</p></div></article>
<section class="project-story"><h2>Careful planning above a staircase</h2>${project.extendedDescription.split('\n\n').map(p=>`<p>${escape(p)}</p>`).join('')}<p>${escape(project.result)}</p><p>Mirror mounting is assessed individually according to the mirror, wall construction, access and suitable fixings. <a href="/services/handyman">Read about our handyman services</a> or <a href="/pricing#pricing-handyman">view the existing pricing information</a>.</p></section>
<section class="project-story"><h2>Customer feedback</h2>${renderTestimonial(project.testimonial,true)}</section>
<section class="project-story"><h2>Planning a similar installation?</h2><p>Send the mirror dimensions and photographs of the wall and access area so we can discuss the work and provide a quote.</p><div class="landing-actions"><a class="btn btn-primary" href="/quote?category=handyman">Request a Quote</a><a class="btn btn-secondary" href="https://wa.me/353833498496" target="_blank" rel="noopener noreferrer">WhatsApp us</a><a class="landing-call" href="tel:+353833498496">Call 083 349 8496</a></div><p><a href="/#projects">Back to completed projects</a></p></section>
</main>
${footer}`;
const output=new URL('../projects'+project.detailUrl.slice('/projects'.length)+'.html',import.meta.url);
if(process.argv.includes('--check')) {if(readFileSync(output,'utf8')!==html)throw Error('Regenerate mirror project page');}
else {mkdirSync(new URL('../projects/',import.meta.url),{recursive:true});writeFileSync(output,html);}
console.log('Mirror project page '+(process.argv.includes('--check')?'verified':'generated'));
