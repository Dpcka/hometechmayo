import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
const baseline = JSON.parse(read('tests/seo-baseline.json'));
test('production SEO metadata, homepage JSON-LD, robots and sitemap are preserved', () => {
 for (const [file, expected] of Object.entries(baseline)) {
  if (Array.isArray(expected)) {
   const actual = [...read(file).matchAll(/<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b(?=[^>]*rel="canonical")[^>]*>|<script type="application\/ld\+json">[\s\S]*?<\/script>/g)].map(x => x[0]);
   assert.deepEqual(actual, expected, file);
  } else assert.equal(read(file), expected, file);
 }
});
