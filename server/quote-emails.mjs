/** Branded email presentation only. All amounts come from calculate(), never from templates. */
import {money, MATERIALS} from '../js/pricing-catalogue.mjs';

export const EMAIL_LOGO_URL = 'https://hometechmayo.ie/assets/logo/logo-email.png';
const BRAND = 'Home Tech Solutions & Services';
const FONT = 'Arial, Helvetica, sans-serif';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const multiline = value => escapeHTML(value).replace(/\r\n|\r|\n/g, '<br>');
const supplied = value => value || 'Not provided';
const serviceLabel = line => `${line.name} × ${line.quantity}${line.unit === 'hours' ? ' h' : line.unit === 'm²' ? ' m²' : ''}`;
const lineAmount = line => line.customWork && !line.known ? 'Custom Quote' : `${money(line.known)}${line.customWork ? '+' : ''}`;
const totalAmount = estimate => estimate.customOnly && !estimate.total ? 'Custom Quote' : `${money(estimate.total)}${estimate.incomplete ? '+' : ''}`;
const materialLabel = estimate => estimate.lines.some(line => line.materialUnknown) ? 'Unconfirmed costs excluded' : 'Customer supplied / included';
const notice = 'Indicative estimate for one visit, subject to confirmation. This is not a confirmed quotation or booking. Additional visits have their own €50 minimum labour charge and travel.';
const exclusions = 'Custom work, unconfirmed materials and/or unknown travel are not included. The known total is not a complete quotation.';
export function receivedLabel(receivedAt) {
  return `${new Intl.DateTimeFormat('en-IE', {timeZone:'Europe/Dublin', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false, timeZoneName:'short'}).format(new Date(receivedAt))} (Europe/Dublin)`;
}
const table = (body, style = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};width:100%;table-layout:fixed;border-collapse:collapse;${style}">${body}</table>`;
const paragraph = (text, style = '') => `<p style="margin:0 0 14px;font-size:14px;line-height:22px;overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;${style}">${text}</p>`;
function infoSection(title, rows) {
  return `<h2 style="margin:24px 0 12px;font-size:18px;line-height:25px;color:#111111;">${escapeHTML(title)}</h2>${table(rows.map(([label,value])=>`<tr>
<td style="padding:0 0 12px;border-bottom:1px solid #eeeeee;overflow-wrap:anywhere;word-break:break-word;">
<p style="margin:10px 0 4px;font-size:12px;line-height:18px;color:#555555;">${escapeHTML(label)}</p>
<p style="margin:0;font-size:14px;line-height:22px;color:#111111;">${multiline(supplied(value))}</p>
</td>
</tr>`).join(''))}`;
}
function totalRows(estimate) {
  return [
    ['Labour subtotal',money(estimate.labour)],
    [`Discount (${estimate.discountPercent}%)`,`−${money(estimate.discount)}`],
    ...(estimate.minimumAdjustment ? [['Minimum labour adjustment',money(estimate.minimumAdjustment)]] : []),
    [`Travel · ${estimate.area} (once per visit)`,estimate.travel === null ? 'Custom Quote — excluded' : money(estimate.travel)],
    ['Materials',materialLabel(estimate)]
  ];
}
export function summaryHTML(estimate) {
  const services = estimate.lines.map(line=>`<tr>
<td style="width:72%;padding:12px 8px 12px 0;vertical-align:top;border-bottom:1px solid #eeeeee;overflow-wrap:anywhere;word-break:break-word;">
<p style="margin:0 0 5px;font-size:14px;line-height:21px;color:#111111;font-weight:bold;">${escapeHTML(serviceLabel(line))}</p>${line.optionLabels.length ? paragraph(line.optionLabels.map(escapeHTML).join('<br>'),'margin:0 0 5px;font-size:12px;line-height:19px;color:#555555;') : ''}${paragraph(`Materials: ${escapeHTML(MATERIALS[line.materials])}${line.materialUnknown ? ' Unconfirmed material costs excluded.' : ''}`,'margin:0;font-size:12px;line-height:19px;color:#555555;')}${line.note ? paragraph(escapeHTML(line.note),'margin:5px 0 0;font-size:12px;line-height:19px;color:#555555;') : ''}</td>
<td align="right" style="width:28%;padding:12px 0 12px 4px;vertical-align:top;border-bottom:1px solid #eeeeee;font-size:14px;line-height:21px;font-weight:bold;color:#111111;">${escapeHTML(lineAmount(line))}</td>
</tr>`).join('');
  const totals=totalRows(estimate).map(([label,value])=>`<tr>
<td style="padding:5px 8px 5px 0;vertical-align:top;font-size:13px;line-height:20px;color:#555555;">${escapeHTML(label)}</td>
<td align="right" style="padding:5px 0;vertical-align:top;font-size:13px;line-height:20px;color:#111111;font-weight:bold;">${escapeHTML(value)}</td>
</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="font-family:${FONT};width:100%;border:1px solid #dddddd;border-top:3px solid #C9A227;border-radius:10px;border-collapse:separate;margin-top:24px;">
<tr>
<td style="padding:16px;">${table(`<tr>
<td style="padding:0 8px 14px 0;vertical-align:top;font-size:16px;line-height:24px;font-weight:bold;color:#111111;">Order summary</td>
<td align="right" style="padding:0 0 14px;vertical-align:top;">
<p style="margin:0;font-size:11px;line-height:17px;color:#555555;">Estimated known total · EUR</p>
<p style="margin:2px 0 0;font-size:24px;line-height:32px;font-weight:bold;color:#111111;">${escapeHTML(totalAmount(estimate))}</p>
</td>
</tr>`)}<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};width:100%;table-layout:fixed;border-collapse:collapse;">
<thead>
<tr>
<th scope="col" align="left" style="width:72%;padding:7px 8px 7px 0;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;font-size:11px;line-height:17px;font-weight:normal;color:#555555;">Service &amp; quantity</th>
<th scope="col" align="right" style="width:28%;padding:7px 0;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;font-size:11px;line-height:17px;font-weight:normal;color:#555555;">Line total</th>
</tr>
</thead>
<tbody>${services}</tbody>
</table>${table(`<tr>
<td colspan="2" height="10" style="height:10px;font-size:1px;line-height:1px;">&nbsp;</td>
</tr>${totals}`)}${paragraph(`${estimate.eligibleUnits} qualifying main units · Eligible labour ${escapeHTML(money(estimate.eligibleLabour))}. Add-ons do not increase the discount tier.`,'margin:10px 0 0;font-size:11px;line-height:18px;color:#555555;')}${paragraph('Line prices include selected options, before discounts and the visit minimum. Included consumables are not charged again.','margin:8px 0 0;font-size:11px;line-height:18px;color:#555555;')}${estimate.customOnly ? paragraph('Labour requires a Custom Quote; minimum €50 per separate visit.','margin:8px 0 0;font-size:12px;line-height:19px;color:#806400;') : ''}${estimate.incomplete ? paragraph(escapeHTML(exclusions),'margin:8px 0 0;font-size:12px;line-height:19px;color:#806400;') : ''}</td>
</tr>
</table>`;
}
export function summaryText(estimate) {
  return ['Order summary (EUR)', ...estimate.lines.map(line=>[
    `${serviceLabel(line)}: ${lineAmount(line)}`, ...line.optionLabels,
    `Materials: ${MATERIALS[line.materials]}${line.materialUnknown ? ' Unconfirmed material costs excluded.' : ''}`, line.note
  ].filter(Boolean).join('\n')), ...totalRows(estimate).map(([label,value])=>`${label}: ${value}`),
  `Estimated known total: ${totalAmount(estimate)}`,
  `${estimate.eligibleUnits} qualifying main units; eligible labour ${money(estimate.eligibleLabour)}. Add-ons do not increase the discount tier.`,
  'Line prices include selected options, before discounts and the visit minimum. Included consumables are not charged again.',
  estimate.customOnly ? 'Labour requires a Custom Quote; minimum €50 per separate visit.' : '',estimate.incomplete ? exclusions : '',notice].filter(Boolean).join('\n\n');
}
function shell(title, content) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;color:#111111;font-family:${FONT};-webkit-text-size-adjust:100%;overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f5" style="font-family:${FONT};width:100%;border-collapse:collapse;">
<tr>
<td align="center" style="padding:20px 12px;">
<!--[if mso]>
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="font-family:${FONT};width:100%;max-width:600px;table-layout:fixed;border:1px solid #dddddd;border-radius:12px;border-collapse:separate;">
<tr>
<td bgcolor="#111111" style="padding:22px 20px;background-color:#111111;border-radius:11px 11px 0 0;">${table(`<tr>
<td width="120" style="width:120px;padding-right:16px;vertical-align:middle;">
<a href="https://hometechmayo.ie" style="text-decoration:none;">
<img src="${EMAIL_LOGO_URL}" width="104" height="88" alt="Home Tech Solutions &amp; Services logo" style="display:block;width:104px;max-width:100%;height:auto;border:0;color:#ffffff;font-family:${FONT};font-size:12px;">
</a>
</td>
<td style="vertical-align:middle;color:#ffffff;">
<p style="margin:0 0 6px;font-size:18px;line-height:25px;font-weight:bold;">${escapeHTML(BRAND)}</p>
<p style="margin:0;font-size:12px;line-height:19px;color:#ffffff;">Home services across County Mayo, Ireland</p>
</td>
</tr>`)}</td>
</tr>
<tr>
<td style="padding:24px 20px;">${content}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff9e8" style="font-family:${FONT};width:100%;margin-top:24px;border-left:3px solid #C9A227;border-collapse:separate;">
<tr>
<td style="padding:12px;font-size:13px;line-height:21px;color:#493b00;">${escapeHTML(notice)}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:20px;border-top:1px solid #eeeeee;font-size:12px;line-height:20px;color:#555555;">${paragraph(`<strong>${escapeHTML(BRAND)}</strong>
<br>County Mayo, Ireland`,'margin:0 0 8px;font-size:12px;line-height:20px;')}<a href="https://hometechmayo.ie" style="color:#806400;text-decoration:underline;">hometechmayo.ie</a>
<br>
<a href="mailto:info@hometechmayo.ie" style="color:#806400;text-decoration:underline;">info@hometechmayo.ie</a>
<br>
<a href="tel:+353833498496" style="color:#806400;text-decoration:underline;">083 349 8496</a>
</td>
</tr>
</table>
<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->
</td>
</tr>
</table>
</body>
</html>`;
}
function referenceHTML(reference) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff9e8" style="font-family:${FONT};width:100%;border:1px solid #e5d499;border-radius:7px;margin:18px 0;border-collapse:separate;">
<tr>
<td style="padding:12px;">
<p style="margin:0 0 4px;font-size:11px;line-height:17px;color:#806400;">REQUEST REFERENCE</p>
<p style="margin:0;font-size:14px;line-height:22px;font-weight:bold;word-break:break-all;color:#111111;">${escapeHTML(reference)}</p>
</td>
</tr>
</table>`;
}
export function createQuoteEmails({customer:c, estimate, reference, receivedAt, version}, env) {
  const jobRows=[['Service area',estimate.area],['Preferred availability',c.availability],['Job description',c.description],['Materials information',c.materialsInformation]];
  const customerRows=[['Name',c.name],['Email',c.email],['Phone',c.phone],['Eircode',c.eircode]];
  const meta=`Received: ${receivedLabel(receivedAt)}\nCatalogue: ${version}\nPrivacy consent: given for processing this enquiry`;
  const summary=summaryText(estimate);
  const jobText=jobRows.map(([label,value])=>`${label}: ${supplied(value)}`).join('\n\n');
  const footer=`${BRAND}\nCounty Mayo, Ireland\nhttps://hometechmayo.ie\ninfo@hometechmayo.ie | 083 349 8496`;
  const businessHTML=shell('New quote request',`<h1 style="margin:0 0 12px;font-size:24px;line-height:32px;color:#111111;">New quote request</h1>${paragraph('A customer has requested an estimate. Their details are below; pricing is calculated automatically from the approved catalogue.')}${referenceHTML(reference)}${paragraph(`Received: ${escapeHTML(receivedLabel(receivedAt))}`,'font-size:12px;color:#555555;')}${infoSection('Customer details — provided by customer',customerRows)}${infoSection('Job details — provided by customer',jobRows)}${summaryHTML(estimate)}${paragraph(`Catalogue: ${escapeHTML(version)}<br>Privacy consent: given for processing this enquiry`,'margin:16px 0 0;font-size:11px;line-height:18px;color:#555555;')}`);
  const business={to:[{email:env.QUOTE_TO_EMAIL}],...(c.email ? {replyTo:{email:c.email,name:c.name}} : {}),subject:`Home Tech quote request ${reference}`,htmlContent:businessHTML,textContent:[`Quote request ${reference}`,meta,'Customer details — provided by customer',...customerRows.map(([label,value])=>`${label}: ${supplied(value)}`),'Job details — provided by customer',jobText,summary,footer].join('\n\n')};
  const acknowledgement=c.email ? {
    to:[{email:c.email}],replyTo:{email:env.QUOTE_TO_EMAIL},subject:`Your Home Tech quote request ${reference}`,
    htmlContent:shell('Thank you for your request!',`<h1 style="margin:0 0 16px;font-size:24px;line-height:32px;color:#111111;">Thank you for your request!</h1>${paragraph(`Hi ${escapeHTML(c.name)},`)}${paragraph('We have received your request. We will contact you to confirm the work, materials, access and availability.')}${referenceHTML(reference)}${summaryHTML(estimate)}${infoSection('Your job details',jobRows)}`),
    textContent:[`Thank you for your request!\n\nHi ${c.name},`,`We have received your request ${reference}. We will contact you to confirm the work, materials, access and availability.`,summary,'Your job details',jobText,footer].join('\n\n')
  } : null;
  return {business,acknowledgement};
}
