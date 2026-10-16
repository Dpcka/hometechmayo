// All money is integer cents. Sources: existing pricing.html unless overridden by
// the owner's approved calculator rules (16 October 2026). Never infer a rate.
export const VERSION = '2026-10-16.1';
export const AREAS = {Straide: 0, Foxford: 0, Castlebar: 0, Ballina: 1000, Westport: 1000, Other: null};
export const MATERIALS = {yes: 'Yes, I have all the required materials.', no: 'No, please supply the materials.', unsure: "I’m not sure what materials are needed."};
export const CATEGORIES = ['Furniture Assembly', 'TV Wall Mounting', 'General Handyman', 'Outdoor Assembly & Installation', 'Computer & Laptop Repair', 'Wi-Fi & Home Networking', 'Smart Home Installation', 'Property Maintenance & Minor Repairs', 'Flooring Installation & Repairs', 'Kitchen Installation & Fitting', 'Shelving & Storage Solutions', 'Doors, Locks & Hardware', 'Bathroom Installation & Accessories', 'Ventilation & Extractor Fan Installation', 'Blinds, Curtains & Window Accessories', 'Furniture Modification & Custom Fitting', 'Wall Panels & Decorative Installation'];
const choice = (label, choices, extra = {}) => ({label, choices, discountEligible: false, countsForDiscount: false, ...extra});
const pick = (value, label, price = 0) => ({value, label, price});
const quote = (label) => choice(label, [pick('no', 'Not required'), pick('yes', 'Required — Custom Quote', null)]);
const mode = choice('Work required', [pick('assembly', 'Assembly only'), pick('installation', 'Installation only — Custom Quote', null), pick('both', 'Assembly and installation — Custom Quote', null)], {replacesBase: true});
const outdoor = {anchoring: quote('Anchoring'), disassembly: quote('Disassembly'), reassembly: quote('Reassembly')};
const fixed = (id, category, name, price, extra = {}) => ({id, category: CATEGORIES[category], name, price, kind: 'fixed', discountEligible: true, countsForDiscount: true, source: 'Existing pricing.html starting price', options: {}, ...extra});
const custom = (id, category, name, extra = {}) => fixed(id, category, name, null, {kind: 'custom', discountEligible: false, countsForDiscount: false, source: 'Price not established — confirmation required', ...extra});
const hourly = (id, category, name, price) => fixed(id, category, name, price, {kind: 'hourly', discountEligible: false, countsForDiscount: false, source: 'Owner-approved calculator rules, 16 October 2026'});
export const CATALOGUE = [
  fixed('furniture-small', 0, 'Small furniture item', 5000, {options: {mode}}),
  fixed('furniture-drawers', 0, 'Chest of drawers', 7000, {options: {mode}}),
  fixed('furniture-bed', 0, 'Bed assembly', 7000, {options: {mode}}),
  fixed('furniture-desk', 0, 'Desk / console table', 6000, {options: {mode}}),
  fixed('furniture-wardrobe', 0, 'Wardrobe assembly', 10000, {options: {mode}}),
  custom('furniture-complex', 0, 'Large or complex furniture', {options: {mode}}),
  fixed('tv-mount', 1, 'TV wall mounting', 8000, {options: {
    size: choice('TV size', [pick('small', 'Up to 55 inches'), pick('medium', '56–65 inches', 1000), pick('large', '66–75 inches', 3000), pick('oversize', 'Over 75 inches — Custom Quote', null)], {replacesBase: true, discountEligible: true}),
    installation: choice('Installation package', [pick('standard', 'Standard installation'), pick('inclusive', 'All-inclusive installation — Custom Quote', null)], {replacesBase: true}),
    bracket: choice('Bracket', [pick('supplied', 'I have a suitable bracket'), pick('needed', 'Please supply a bracket — materials quoted separately')], {materialsWhen: 'needed'}),
    cables: choice('Cable management / trunking', [pick('no', 'Not required'), pick('yes', 'Add cable management / trunking — from €20', 2000)], {discountEligible: false})
  }, note: 'Suitable wall and fixings subject to confirmation. All-inclusive work is quoted as one bundle; standard labour and cable add-ons are not charged again.'}),
  hourly('handyman-hour', 2, 'General handyman work', 4500),
  fixed('handyman-half', 2, 'Half-day — up to 4 hours', 17000, {kind: 'package', discountEligible: false, countsForDiscount: false, source: 'Owner-approved calculator rules, 16 October 2026', options: {extraHours: {label: 'Additional general handyman hours (€45/hour)', number: true, price: 4500, discountEligible: false, countsForDiscount: false}}, note: 'Book a package explicitly. Do not add fixed jobs for work already covered by these hours.'}),
  fixed('handyman-full', 2, 'Full-day — up to 8 hours', 32000, {kind: 'package', discountEligible: false, countsForDiscount: false, source: 'Owner-approved calculator rules, 16 October 2026', options: {extraHours: {label: 'Additional general handyman hours (€45/hour)', number: true, price: 4500, discountEligible: false, countsForDiscount: false}}, note: 'Book a package explicitly. Do not add fixed jobs for work already covered by these hours.'}),
  custom('outdoor-assembly', 3, 'Outdoor furniture / equipment assembly', {options: outdoor}),
  custom('outdoor-seasonal', 3, 'Seasonal assembly package', {options: outdoor, note: 'Package contents and any included anchoring, disassembly or reassembly will be confirmed together. No automatic discount.'}),
  fixed('pc-troubleshoot', 4, 'PC troubleshooting', 5000),
  hourly('pc-malware', 4, 'Virus & malware removal (minimum €50)', 5000),
  hourly('pc-software', 4, 'Advanced software troubleshooting', 5000),
  custom('pc-disk', 4, 'SSD / HDD replacement', {options: {cloning: quote('Disk cloning'), transfer: quote('Data transfer'), windows: quote('Windows installation')}, note: 'Drive, software licensing and selected services require confirmation; no duplicated bundle charges.'}),
  custom('pc-service', 4, 'Laptop servicing', {includedMaterials: true, note: 'Standard thermal paste is included in the eventual laptop servicing quotation; it is not charged again. Replacement parts require confirmation.'}),
  fixed('wifi-setup', 5, 'Wi-Fi setup / optimisation', 6000),
  fixed('wifi-mesh', 5, 'Router / mesh setup', 7000),
  fixed('wifi-printer', 5, 'Printer / device setup', 4000),
  hourly('wifi-troubleshoot', 5, 'Wi-Fi troubleshooting', 5000),
  custom('wifi-network', 5, 'Home network setup'),
  fixed('smart-device', 6, 'Smart device setup', 5000),
  fixed('smart-speaker', 6, 'Smart speaker setup', 4000),
  fixed('smart-plug', 6, 'Smart plug / smart bulb setup', 4000),
  fixed('smart-tv', 6, 'Smart TV setup', 4000),
  fixed('smart-thermostat', 6, 'Smart thermostat setup (configuration only)', 6000, {note: 'No restricted electrical work or gas connections.'}),
  hourly('smart-troubleshoot', 6, 'Smart device troubleshooting', 5000),
  custom('smart-automation', 6, 'Multiple-device / automation setup'),
  fixed('property-minor', 7, 'Minor repairs', 5000),
  custom('property-maintenance', 7, 'Property maintenance visit'),
  custom('flooring', 8, 'Flooring installation / repairs', {unit: 'm²', options: {type: choice('Flooring type', [pick('laminate', 'Laminate'), pick('vinyl', 'Vinyl'), pick('other', 'Other — specify in job description')]), removal: quote('Existing floor removal'), skirting: quote('Skirting'), thresholds: quote('Thresholds')}}),
  custom('kitchen', 9, 'Kitchen installation & fitting', {options: {type: choice('Cabinet type', [pick('base', 'Base cabinets'), pick('wall', 'Wall cabinets'), pick('tall', 'Tall cabinets'), pick('mixed', 'Mixed cabinets')]), mode, worktop: quote('Worktop fitting (no router corner joints)'), cutouts: quote('Sink / hob cut-outs'), appliances: quote('Appliance replacement (no gas or restricted wiring)')}}),
  fixed('shelving-fitting', 10, 'Shelving / curtain rails / fittings', 5000, {note: 'Select this combined service only once for the same work; do not duplicate it under window accessories.'}),
  custom('shelving-custom', 10, 'Custom shelving / storage installation'),
  custom('doors-hardware', 11, 'Door, lock or hardware fitting'),
  custom('hardware-addon', 11, 'Handles / hinges / fixings (minor add-on)', {note: 'Minor add-on; does not count towards a discount tier.'}),
  custom('bathroom-accessory', 12, 'Bathroom installation / accessories', {note: 'Scope subject to confirmation. No gas connections or restricted electrical work.'}),
  fixed('vent-fan', 13, 'Extractor fan replacement — labour', 8000, {note: 'Existing suitable wiring only; restricted electrical work excluded.'}),
  custom('vent-upgrade', 13, 'Bathroom ventilation upgrade'),
  custom('vent-duct', 13, 'Rigid duct installation'),
  custom('vent-external', 13, 'External vent installation'),
  custom('vent-core', 13, 'Core drilling / new ventilation opening', {note: 'Custom Quote, including equipment rental in the eventual quotation.'}),
  custom('blinds', 14, 'Blinds / curtain accessories installation', {options: {cutting: quote('Cutting to size')}, note: 'For standard shelving / curtain rails / fittings, use the listed €50 service instead. Cutting is quoted separately and does not increase the discount count.'}),
  custom('furniture-modify', 15, 'Furniture modification / custom fitting', {options: {trimming: quote('Cutting / trimming')}, note: 'Existing furniture only; complete custom furniture manufacturing excluded.'}),
  custom('wall-panels', 16, 'Wall panels / decorative installation')
];
export const BY_ID = new Map(CATALOGUE.map(s => [s.id, s]));
export const money = cents => new Intl.NumberFormat('en-IE', {style: 'currency', currency: 'EUR'}).format(cents / 100);
const round = Math.round;
export function calculate(items, area) {
  if (!Array.isArray(items) || items.length > 60) throw new Error('Choose up to 60 different services.');
  if (!Object.hasOwn(AREAS, area)) throw new Error('Choose your service area.');
  const seen = new Set();
  let eligibleUnits = 0, eligibleLabour = 0, labour = 0, unknown = false;
  const lines = items.map(item => {
    const s = BY_ID.get(item.id);
    if (!s || seen.has(item.id)) throw new Error('Unknown or duplicate service.');
    seen.add(item.id);
    const q = item.quantity;
    if (!Number.isFinite(q) || q <= 0 || q > 100 || (!s.unit && !Number.isInteger(q)) || (s.unit && round(q * 10) !== q * 10) || (s.kind === 'package' && q !== 1)) throw new Error('Check service quantities (maximum 100; packages are one per visit).');
    const materials = item.materials;
    if (!Object.hasOwn(MATERIALS, materials)) throw new Error('Choose who will supply materials for each service.');
    const options = item.options ?? {};
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid service options.');
    if (Object.keys(options).some(key => !Object.hasOwn(s.options, key))) throw new Error('Unknown service option.');
    let base = s.price, extras = 0, eligibleExtras = 0, rowCustom = base === null, extraCustom = false, materialUnknown = !s.includedMaterials && materials !== 'yes';
    const selectedOptions = {};
    const labels = [];
    // A replacement/bundle selected as Custom Quote replaces all baseline charges.
    let replacement = false;
    for (const [key, def] of Object.entries(s.options)) {
      const value = options[key] ?? (def.number ? 0 : def.choices[0].value);
      if (def.number) {
        if (!Number.isInteger(value) || value < 0 || value > 24) throw new Error('Additional hours must be a whole number from 0 to 24.');
        extras += value * def.price;
        labels.push(`${def.label}: ${value}`);
      } else {
        const chosen = def.choices.find(c => c.value === value);
        if (!chosen) throw new Error('Invalid service option.');
        labels.push(`${def.label}: ${chosen.label}`);
        if (chosen.price === null) {
          if (def.replacesBase) {rowCustom = true; replacement = true;} else extraCustom = true;
        } else {extras += chosen.price; if (def.discountEligible) eligibleExtras += chosen.price;}
        if (def.materialsWhen === value) materialUnknown = true;
      }
      selectedOptions[key] = value;
    }
    if (replacement) {base = null; extras = 0;}
    // Add-ons never count as main units. Only explicit main-price variant
    // adjustments (e.g. TV size) enter the discountable base.
    const known = round(((base ?? 0) + extras) * q);
    const discountBase = !rowCustom && s.discountEligible ? round(((base ?? 0) + eligibleExtras) * q) : 0;
    if (!rowCustom && s.countsForDiscount) eligibleUnits += q;
    eligibleLabour += discountBase;
    labour += known;
    const customWork = rowCustom || extraCustom;
    unknown ||= customWork || materialUnknown;
    return {id: s.id, name: s.name, quantity: q, unit: s.unit || (s.kind === 'hourly' ? 'hours' : 'items'), kind: s.kind, materials, options: selectedOptions, optionLabels: labels, known, discountBase, customWork, materialUnknown, note: s.note || ''};
  });
  if (seen.has('handyman-half') && seen.has('handyman-full') || seen.has('handyman-hour') && (seen.has('handyman-half') || seen.has('handyman-full'))) throw new Error('Choose one handyman hourly/package option per visit; use package additional hours for extra time.');
  if (seen.has('outdoor-assembly') && seen.has('outdoor-seasonal')) throw new Error('Choose outdoor assembly or a seasonal package, not both for the same work.');
  const discountPercent = eligibleUnits >= 11 ? 10 : eligibleUnits >= 6 ? 5 : 0;
  const discount = round(eligibleLabour * discountPercent / 100);
  // A custom-only job has no known labour; its €50 minimum remains a condition,
  // not a fabricated price for unknown work.
  const minimumAdjustment = labour > 0 ? Math.max(0, 5000 - (labour - discount)) : 0;
  const travel = items.length ? AREAS[area] : 0;
  const total = labour - discount + minimumAdjustment + (travel ?? 0);
  return {version: VERSION, lines, area, eligibleUnits, eligibleLabour, labour, discountPercent, discount, minimumAdjustment, travel, materials: 0, total, incomplete: unknown || (items.length > 0 && travel === null), customOnly: items.length > 0 && labour === 0};
}
export function estimateText(e) {
  return [
    'Indicative estimate only — subject to confirmation. One visit; additional visits each have their own €50 minimum and travel.',
    ...e.lines.map(l => `${l.name} × ${l.quantity} ${l.unit}: ${l.customWork ? 'Custom Quote; known portion ' : 'from '}${money(l.known)}\n  ${MATERIALS[l.materials]}${l.materialUnknown ? ' — materials not included in total' : ''}\n  ${l.optionLabels.join('; ')}${l.note ? '\n  ' + l.note : ''}`),
    `Labour before discount: ${money(e.labour)}`,
    `Eligible main units: ${e.eligibleUnits}; eligible labour: ${money(e.eligibleLabour)}`,
    `Discount (${e.discountPercent}%): -${money(e.discount)}`,
    `Minimum labour adjustment: ${money(e.minimumAdjustment)}`,
    `Travel (${e.area}, once per visit): ${e.travel === null ? 'Custom Quote — not included' : money(e.travel)}`,
    'Materials: no unconfirmed material prices included; included consumables are not charged again.',
    `Estimated known total: ${money(e.total)}${e.incomplete ? '+' : ''}`,
    e.customOnly ? 'Labour requires a Custom Quote (minimum €50 per separate visit).' : '',
    e.incomplete ? 'Custom work, unconfirmed materials and/or unknown travel are NOT included. This is not a complete quotation.' : 'Starting-price estimate only, not a final quotation.'
  ].filter(Boolean).join('\n\n');
}
