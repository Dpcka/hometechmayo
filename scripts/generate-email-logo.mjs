// Rasterise the original SVG without modifying it. The website displays this
// currentColor logo in white using brightness(0) invert(1) on its black header.
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
const source=new URL('../assets/logo/logo.svg',import.meta.url);
const target=new URL('../assets/logo/logo-email.png',import.meta.url);
await sharp(await readFile(source)).resize({width:720}).ensureAlpha().negate({alpha:false}).png().toFile(fileURLToPath(target));
console.log('Generated assets/logo/logo-email.png from the original SVG (white, transparent, 720px).');
