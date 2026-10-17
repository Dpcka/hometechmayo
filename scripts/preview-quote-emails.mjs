// Local presentation previews only: no credentials, provider calls or email sending.
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {calculate,VERSION} from '../js/pricing-catalogue.mjs';
import {createQuoteEmails,EMAIL_LOGO_URL} from '../server/quote-emails.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=path.resolve(process.argv[2] || path.join(root,'work/email-previews'));
const estimate=calculate([
 {id:'furniture-small',quantity:2,materials:'yes',options:{mode:'assembly'}},
 {id:'furniture-drawers',quantity:1,materials:'yes',options:{mode:'assembly'}}
],'Castlebar');
const data={reference:'HT-20261017-DD502E2A-D7E',receivedAt:'2026-10-17T13:30:00Z',version:VERSION,estimate,customer:{name:'Alex Example',phone:'0000000000',email:'alex@example.com',eircode:'',availability:'Weekday mornings',description:'Please assemble the furniture in the guest room.\nThe floor will be clear before your visit.',materialsInformation:'All furniture, manufacturer fixings and instructions are supplied.'}};
const emails=createQuoteEmails(data,{QUOTE_TO_EMAIL:'info@hometechmayo.ie'});
await mkdir(output,{recursive:true});
for(const [name,mail] of [['customer',emails.acknowledgement],['business',emails.business]]) {
 await writeFile(path.join(output,`${name}.html`),mail.htmlContent);
 await writeFile(path.join(output,`${name}-local.html`),mail.htmlContent.replaceAll(EMAIL_LOGO_URL,'./logo-email.png'));
 await writeFile(path.join(output,`${name}.txt`),mail.textContent);
}
await copyFile(path.join(root,'assets/logo/logo-email.png'),path.join(output,'logo-email.png'));
await writeFile(path.join(output,'README.txt'),'FICTIONAL LOCAL PREVIEWS — no email sent.\ncustomer.html and business.html are the exact HTML bodies generated for Brevo.\nThe -local.html versions differ only in the logo URL for offline viewing.\nThe production PNG URL becomes available only after an approved deployment.\nBrowser screenshots use the exact HTML bodies with the HTTPS logo request served from the local PNG.\nActual Gmail/Outlook/Apple Mail rendering and received Reply-To headers require a later controlled delivery test.\n');
console.log(`Wrote fictional HTML/text email previews to ${output}`);
