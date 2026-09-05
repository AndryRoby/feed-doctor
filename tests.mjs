// tests.mjs — plain Node test runner for feed-doctor.js (no external dependencies).
// Run with: node tests.mjs

import {
  analyze,
  parseFeed,
  detectFormat,
  checkProducts,
  computeScore,
  gtinChecksumValid,
  issuesToCsv,
  reportToJson,
  asistentHandoffUrl,
  ASISTENT_URL,
  RULES,
  SAMPLE_FEED,
} from './feed-doctor.js';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  }
}

function eq(name, actual, expected) {
  const condition = actual === expected;
  ok(name, condition, condition ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function has(name, problems, ruleId) {
  const condition = Array.isArray(problems) && problems.some((p) => p.id === ruleId);
  ok(name, condition, condition ? '' : `expected rule "${ruleId}", got [${(problems || []).map((p) => p.id).join(', ')}]`);
}

function lacks(name, problems, ruleId) {
  const condition = Array.isArray(problems) && !problems.some((p) => p.id === ruleId);
  ok(name, condition, condition ? '' : `did not expect rule "${ruleId}" to be present`);
}

function countOf(problems, ruleId) {
  const p = (problems || []).find((x) => x.id === ruleId);
  return p ? p.count : 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Test fixture builder: a minimal Google Shopping RSS 2.0 item, built from a
// field map, so every rule can be tested by mutating exactly one field.
//   - a field set to `undefined`/omitted or `null` -> tag is left out entirely
//   - a field set to '' -> emitted as a self-closing (empty) tag
//   - any other string -> emitted as <tag>value</tag>
// ─────────────────────────────────────────────────────────────────────────

const BASE_FIELDS = {
  id: 'p1',
  title: 'Good Product Title',
  description: 'A perfectly adequate description that is definitely more than fifty characters long.',
  link: 'https://shop.example.com/p1',
  image_link: 'https://shop.example.com/p1.jpg',
  price: '19.99 USD',
  availability: 'in stock',
  condition: 'new',
  brand: 'Acme',
  gtin: '4006381333931',
  mpn: 'MPN-1',
  google_product_category: 'Toys',
  item_group_id: null,
  sale_price: null,
  size: null,
  color: null,
  shipping: 'present',
};

const TAG_MAP = {
  id: 'g:id',
  title: 'title',
  description: 'description',
  link: 'link',
  image_link: 'g:image_link',
  price: 'g:price',
  availability: 'g:availability',
  condition: 'g:condition',
  brand: 'g:brand',
  gtin: 'g:gtin',
  mpn: 'g:mpn',
  google_product_category: 'g:google_product_category',
  item_group_id: 'g:item_group_id',
  sale_price: 'g:sale_price',
  size: 'g:size',
  color: 'g:color',
};

function xmlItem(overrides) {
  const f = { ...BASE_FIELDS, ...(overrides || {}) };
  let xml = '';
  for (const key of Object.keys(TAG_MAP)) {
    const v = f[key];
    const tag = TAG_MAP[key];
    if (v === undefined || v === null) continue;
    if (v === '') {
      xml += `<${tag}/>`;
    } else {
      xml += `<${tag}>${v}</${tag}>`;
    }
  }
  if (f.shipping === 'present') {
    xml += '<g:shipping><g:country>US</g:country><g:price>4.99 USD</g:price></g:shipping>';
  }
  return `<item>${xml}</item>`;
}

function xmlFeed(itemsOverrides) {
  const items = itemsOverrides.map(xmlItem).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>t</title><link>https://shop.example.com</link><description>d</description>${items}</channel></rss>`;
}

function analyzeOne(overrides) {
  return analyze(xmlFeed([overrides || {}]));
}

// ─────────────────────────────────────────────────────────────────────────
// 1. detectFormat()
// ─────────────────────────────────────────────────────────────────────────

eq('detectFormat: empty string is unknown', detectFormat(''), 'unknown');
eq('detectFormat: whitespace-only is unknown', detectFormat('   \n  '), 'unknown');
eq('detectFormat: garbage text is generic_csv (falls back to CSV path)', detectFormat('just some text, not a feed'), 'generic_csv');
eq('detectFormat: g: namespace XML is google_rss', detectFormat(xmlFeed([{}])), 'google_rss');
eq(
  'detectFormat: plain <item> XML without g: namespace is generic_xml',
  detectFormat('<items><item><id>1</id><name>Widget</name></item></items>'),
  'generic_xml'
);
eq(
  'detectFormat: Shopify-shaped JSON ({"products":[...]}) is shopify_json',
  detectFormat(JSON.stringify({ products: [{ id: 1, title: 'x', variants: [{ id: 1, price: '1.00' }] }] })),
  'shopify_json'
);
eq(
  'detectFormat: WooCommerce-shaped JSON (array of {prices:...}) is woocommerce_json',
  detectFormat(JSON.stringify([{ id: 1, name: 'x', prices: { price: '100', currency_code: 'USD' } }])),
  'woocommerce_json'
);
eq('detectFormat: empty JSON array is woocommerce_json', detectFormat('[]'), 'woocommerce_json');
eq('detectFormat: malformed JSON starting with { is unknown', detectFormat('{not valid json'), 'unknown');
{
  const csv = 'id,title,price,link,image_link,availability\n1,Widget,10 USD,https://x/1,https://x/1.jpg,in stock\n';
  eq('detectFormat: plain CSV header is generic_csv', detectFormat(csv), 'generic_csv');
}
{
  const csv = 'id,title,price,availability,quantity_to_sell_on_facebook\n1,Widget,10 USD,in stock,50\n';
  eq('detectFormat: CSV with a Facebook-only column is facebook_csv', detectFormat(csv), 'facebook_csv');
}

// ─────────────────────────────────────────────────────────────────────────
// 2. gtinChecksumValid()
// ─────────────────────────────────────────────────────────────────────────

eq('gtin: valid GTIN-13 (EAN-13)', gtinChecksumValid('4006381333931'), true);
eq('gtin: same digits, wrong check digit -> invalid', gtinChecksumValid('4006381333930'), false);
eq('gtin: valid GTIN-12 (UPC-A)', gtinChecksumValid('036000291452'), true);
eq('gtin: invalid GTIN-12', gtinChecksumValid('036000291451'), false);
eq('gtin: valid GTIN-8', gtinChecksumValid('96385074'), true);
eq('gtin: invalid GTIN-8', gtinChecksumValid('96385075'), false);
eq('gtin: valid GTIN-14', gtinChecksumValid('10400638133397'), true);
eq('gtin: invalid GTIN-14', gtinChecksumValid('10400638133398'), false);
eq('gtin: wrong length (11 digits) is invalid', gtinChecksumValid('4006381333'), false);
eq('gtin: non-digit characters are stripped before checking', gtinChecksumValid('400-638-133-3931'), true);
eq('gtin: empty string is invalid', gtinChecksumValid(''), false);

// ─────────────────────────────────────────────────────────────────────────
// 3. A fully clean item triggers nothing and scores 100
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({});
  eq('clean item: no problems at all', r.problems.length, 0);
  eq('clean item: score is 100', r.score, 100);
  eq('clean item: productCount is 1', r.productCount, 1);
  eq('clean item: format detected as google_rss', r.format, 'google_rss');
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Required-field rules
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ id: null });
  has('missing id (tag omitted): flags missing_id', r.problems, 'missing_id');
  eq('missing_id severity is error', r.problems.find((p) => p.id === 'missing_id').severity, 'error');
}
{
  const r = analyzeOne({ id: '' });
  has('missing id (empty tag): flags missing_id', r.problems, 'missing_id');
}
{
  const r = analyzeOne({ title: null });
  has('missing title: flags missing_title', r.problems, 'missing_title');
}
{
  const r = analyzeOne({ description: null });
  has('missing description: flags missing_description', r.problems, 'missing_description');
}
{
  const r = analyzeOne({ link: null });
  has('missing link: flags missing_link', r.problems, 'missing_link');
}
{
  const r = analyzeOne({ image_link: null });
  has('missing image_link: flags missing_image_link', r.problems, 'missing_image_link');
}
{
  const r = analyzeOne({ price: null });
  has('missing price: flags missing_price', r.problems, 'missing_price');
}
{
  const r = analyzeOne({ availability: null });
  has('missing availability: flags missing_availability', r.problems, 'missing_availability');
}

// ─────────────────────────────────────────────────────────────────────────
// 5. condition: required when the item looks used, otherwise optional
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ condition: null, title: 'Refurbished Camera Body' });
  has('used keyword in title + no condition: flags missing_condition_used', r.problems, 'missing_condition_used');
}
{
  const r = analyzeOne({ condition: null, description: 'A lightly used road bike in great shape, more than fifty characters long.' });
  has('used keyword in description + no condition: flags missing_condition_used', r.problems, 'missing_condition_used');
}
{
  const r = analyzeOne({ condition: null });
  lacks('no used keyword + no condition: does not flag missing_condition_used', r.problems, 'missing_condition_used');
}
{
  const r = analyzeOne({ condition: 'like new' });
  has('condition "like new": flags invalid_condition', r.problems, 'invalid_condition');
  eq('invalid_condition severity is warning', r.problems.find((p) => p.id === 'invalid_condition').severity, 'warning');
}
{
  const r = analyzeOne({ condition: 'refurbished' });
  lacks('condition "refurbished": does not flag invalid_condition', r.problems, 'invalid_condition');
}

// ─────────────────────────────────────────────────────────────────────────
// 6. duplicate ids
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyze(xmlFeed([{ id: 'dup' }, { id: 'dup' }, { id: 'unique' }]));
  has('two items sharing an id: flags duplicate_id', r.problems, 'duplicate_id');
  eq('duplicate_id counts both offending rows', countOf(r.problems, 'duplicate_id'), 2);
}
{
  const r = analyze(xmlFeed([{ id: 'a' }, { id: 'b' }, { id: 'c' }]));
  lacks('three distinct ids: no duplicate_id', r.problems, 'duplicate_id');
}

// ─────────────────────────────────────────────────────────────────────────
// 7. title checks
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ title: 'A'.repeat(160) });
  has('title over 150 chars: flags title_too_long', r.problems, 'title_too_long');
}
{
  const r = analyzeOne({ title: 'A'.repeat(140) });
  lacks('title under 150 chars: no title_too_long', r.problems, 'title_too_long');
}
{
  const r = analyzeOne({ title: 'THIS PRODUCT IS AMAZING AND LOUD' });
  has('all-caps title: flags title_all_caps', r.problems, 'title_all_caps');
}
{
  const r = analyzeOne({ title: 'This Product Is Normal' });
  lacks('normal-case title: no title_all_caps', r.problems, 'title_all_caps');
}
{
  const r = analyzeOne({ title: '12345 / 99.99% / #1' });
  lacks('title with no letters at all: no title_all_caps (nothing to capitalize)', r.problems, 'title_all_caps');
}

// ─────────────────────────────────────────────────────────────────────────
// 8. description checks
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ description: 'Too short.' });
  has('description under 50 chars: flags description_too_short', r.problems, 'description_too_short');
}
{
  const r = analyzeOne({ description: 'A perfectly good description with <b>bold</b> markup, well over fifty characters long.' });
  has('description with HTML tags: flags description_has_html', r.problems, 'description_has_html');
  lacks('description with HTML but long enough: no description_too_short', r.problems, 'description_too_short');
}
{
  const r = analyzeOne({ description: 'A perfectly plain description with no markup at all, comfortably over fifty characters.' });
  lacks('plain long description: no description_has_html', r.problems, 'description_has_html');
}

// ─────────────────────────────────────────────────────────────────────────
// 9. price checks
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ price: '-5.00 USD' });
  has('negative price: flags price_negative', r.problems, 'price_negative');
}
{
  const r = analyzeOne({ price: '5.00 USD' });
  lacks('positive price: no price_negative', r.problems, 'price_negative');
}
{
  const r = analyzeOne({ price: '19.99' });
  has('price with no currency code: flags price_missing_currency', r.problems, 'price_missing_currency');
}
{
  const r = analyzeOne({ price: '19.99 EUR' });
  lacks('price with a currency code: no price_missing_currency', r.problems, 'price_missing_currency');
}
{
  const r = analyzeOne({ price: 'call for price' });
  has('non-numeric price text: flags price_not_numeric', r.problems, 'price_not_numeric');
  lacks('non-numeric price text: does not also flag missing_price', r.problems, 'missing_price');
}
{
  const r = analyzeOne({ price: '19.99 USD', sale_price: '25.00 USD' });
  has('sale_price higher than price: flags sale_price_gte_price', r.problems, 'sale_price_gte_price');
}
{
  const r = analyzeOne({ price: '19.99 USD', sale_price: '19.99 USD' });
  has('sale_price equal to price: flags sale_price_gte_price', r.problems, 'sale_price_gte_price');
}
{
  const r = analyzeOne({ price: '19.99 USD', sale_price: '14.99 USD' });
  lacks('sale_price lower than price: no sale_price_gte_price', r.problems, 'sale_price_gte_price');
}

// ─────────────────────────────────────────────────────────────────────────
// 10. link / image_link checks
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ link: 'not a url' });
  has('unparsable link: flags link_invalid', r.problems, 'link_invalid');
}
{
  const r = analyzeOne({ link: '/relative/path' });
  has('relative link (no scheme/host): flags link_invalid', r.problems, 'link_invalid');
}
{
  const r = analyzeOne({ link: 'http://shop.example.com/p1' });
  has('http (not https) link: flags link_not_https', r.problems, 'link_not_https');
  lacks('http link is still a valid URL: no link_invalid', r.problems, 'link_invalid');
}
{
  const r = analyzeOne({ link: 'https://shop.example.com/p1' });
  lacks('https link: no link_not_https', r.problems, 'link_not_https');
}
{
  const r = analyzeOne({ image_link: 'not a url either' });
  has('unparsable image_link: flags image_link_invalid', r.problems, 'image_link_invalid');
}
{
  const r = analyzeOne({ image_link: 'http://shop.example.com/p1.jpg' });
  has('http image_link: flags image_link_not_https', r.problems, 'image_link_not_https');
}
{
  const r = analyzeOne({ image_link: 'https://shop.example.com/images/p1' });
  has('image_link with no file extension: flags image_link_missing_extension', r.problems, 'image_link_missing_extension');
  eq('image_link_missing_extension severity is info', r.problems.find((p) => p.id === 'image_link_missing_extension').severity, 'info');
}
{
  const r = analyzeOne({ image_link: 'https://shop.example.com/images/p1.WEBP' });
  lacks('image_link with uppercase extension: no image_link_missing_extension', r.problems, 'image_link_missing_extension');
}

// ─────────────────────────────────────────────────────────────────────────
// 11. availability
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ availability: 'Yes' });
  has('availability "Yes": flags availability_invalid', r.problems, 'availability_invalid');
}
for (const value of ['in stock', 'out of stock', 'preorder', 'backorder', 'in_stock', 'OUT_OF_STOCK']) {
  const r = analyzeOne({ availability: value });
  lacks(`availability "${value}": no availability_invalid`, r.problems, 'availability_invalid');
}

// ─────────────────────────────────────────────────────────────────────────
// 12. gtin checksum rule (as wired into the full pipeline)
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ gtin: '4006381333930' });
  has('bad GTIN checksum: flags gtin_checksum_invalid', r.problems, 'gtin_checksum_invalid');
}
{
  const r = analyzeOne({ gtin: '4006381333931' });
  lacks('good GTIN checksum: no gtin_checksum_invalid', r.problems, 'gtin_checksum_invalid');
}
{
  const r = analyzeOne({ gtin: null });
  lacks('no gtin at all: no gtin_checksum_invalid (optional field)', r.problems, 'gtin_checksum_invalid');
}

// ─────────────────────────────────────────────────────────────────────────
// 13. brand
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ brand: null }); // gtin/mpn still set from BASE_FIELDS
  has('no brand but gtin/mpn present: flags missing_brand', r.problems, 'missing_brand');
}
{
  const r = analyzeOne({ brand: null, gtin: null, mpn: null });
  lacks('no brand and no gtin/mpn (custom product): no missing_brand', r.problems, 'missing_brand');
}
{
  const r = analyzeOne({ brand: 'Acme' });
  lacks('brand present: no missing_brand', r.problems, 'missing_brand');
}

// ─────────────────────────────────────────────────────────────────────────
// 14. item_group_id / size / color
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ item_group_id: 'grp-1' });
  has('item_group_id set, no size/color: flags item_group_variant_missing_attrs', r.problems, 'item_group_variant_missing_attrs');
}
{
  const r = analyzeOne({ item_group_id: 'grp-1', size: 'M' });
  lacks('item_group_id set with size: no item_group_variant_missing_attrs', r.problems, 'item_group_variant_missing_attrs');
}
{
  const r = analyzeOne({ item_group_id: 'grp-1', color: 'Red' });
  lacks('item_group_id set with color: no item_group_variant_missing_attrs', r.problems, 'item_group_variant_missing_attrs');
}
{
  const r = analyzeOne({});
  lacks('no item_group_id at all: no item_group_variant_missing_attrs', r.problems, 'item_group_variant_missing_attrs');
}

// ─────────────────────────────────────────────────────────────────────────
// 15. shipping (info)
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ shipping: null });
  has('no shipping element: flags shipping_missing', r.problems, 'shipping_missing');
  eq('shipping_missing severity is info', r.problems.find((p) => p.id === 'shipping_missing').severity, 'info');
}
{
  const r = analyzeOne({ shipping: 'present' });
  lacks('shipping element present: no shipping_missing', r.problems, 'shipping_missing');
}

// ─────────────────────────────────────────────────────────────────────────
// 16. non-UTF-8 / control characters
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ title: 'Broken�Title' });
  has('title containing U+FFFD: flags non_utf8_chars', r.problems, 'non_utf8_chars');
}
{
  const r = analyzeOne({ title: 'BrokenTitle' });
  has('title containing a control character: flags non_utf8_chars', r.problems, 'non_utf8_chars');
}
{
  const r = analyzeOne({});
  lacks('plain ASCII/UTF-8 text: no non_utf8_chars', r.problems, 'non_utf8_chars');
}

// ─────────────────────────────────────────────────────────────────────────
// 17. whitespace-only values (distinct from "missing")
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ title: '   ' });
  has('title is only whitespace: flags whitespace_only_value', r.problems, 'whitespace_only_value');
  has('title is only whitespace: also flags missing_title (blank after trim)', r.problems, 'missing_title');
}
{
  const r = analyzeOne({ title: null });
  lacks('title tag entirely absent: no whitespace_only_value (nothing to be whitespace)', r.problems, 'whitespace_only_value');
}
{
  const r = analyzeOne({ title: '' });
  lacks('title tag empty (self-closing): no whitespace_only_value (empty, not whitespace)', r.problems, 'whitespace_only_value');
}

// ─────────────────────────────────────────────────────────────────────────
// 18. duplicate titles (more than 3 identical titles)
// ─────────────────────────────────────────────────────────────────────────

{
  const items = [1, 2, 3].map((n) => ({ id: 'id' + n, title: 'Same Title' }));
  const r = analyze(xmlFeed(items));
  lacks('exactly 3 items with the same title: no duplicate_titles yet', r.problems, 'duplicate_titles');
}
{
  const items = [1, 2, 3, 4].map((n) => ({ id: 'id' + n, title: 'Same Title' }));
  const r = analyze(xmlFeed(items));
  has('4 items with the same title: flags duplicate_titles', r.problems, 'duplicate_titles');
  eq('duplicate_titles counts all 4 rows', countOf(r.problems, 'duplicate_titles'), 4);
}

// ─────────────────────────────────────────────────────────────────────────
// 19. generic XML (no g: namespace, alternate tag names)
// ─────────────────────────────────────────────────────────────────────────

{
  const xml = `<items>
    <item>
      <id>w-1</id>
      <name>Wireless Mouse</name>
      <desc>A comfortable wireless mouse with a two year battery life and USB receiver.</desc>
      <url>https://shop.example.com/mouse</url>
      <image_url>https://shop.example.com/mouse.jpg</image_url>
      <price>15.00 EUR</price>
      <stock_status>in stock</stock_status>
      <manufacturer>Acme</manufacturer>
    </item>
  </items>`;
  eq('generic XML: format detected as generic_xml', detectFormat(xml), 'generic_xml');
  const { format, products } = parseFeed(xml);
  eq('generic XML: parses exactly one product', products.length, 1);
  const p = products[0];
  eq('generic XML: id from <id>', p.id, 'w-1');
  eq('generic XML: title from <name>', p.title, 'Wireless Mouse');
  eq('generic XML: link from <url>', p.link, 'https://shop.example.com/mouse');
  eq('generic XML: image_link from <image_url>', p.image_link, 'https://shop.example.com/mouse.jpg');
  eq('generic XML: price parsed', p.price, 15);
  eq('generic XML: currency parsed', p.currency, 'EUR');
  eq('generic XML: availability from <stock_status>', p.availability, 'in stock');
  eq('generic XML: brand from <manufacturer>', p.brand, 'Acme');
}

// ─────────────────────────────────────────────────────────────────────────
// 20. CSV: generic and Facebook, plus parser edge cases
// ─────────────────────────────────────────────────────────────────────────

{
  const csv = [
    'id,title,description,link,image_link,price,availability,brand,gtin',
    '1,Widget,"A widget, with a comma in the description text, over fifty chars.",https://x.example/1,https://x.example/1.jpg,9.99 USD,in stock,Acme,4006381333931',
  ].join('\n');
  const { format, products } = parseFeed(csv, { format: 'generic_csv' });
  eq('CSV: one product parsed', products.length, 1);
  const p = products[0];
  eq('CSV: title mapped', p.title, 'Widget');
  ok('CSV: quoted field with embedded comma kept intact', p.description.includes('comma in the description'));
  eq('CSV: price parsed as number', p.price, 9.99);
  eq('CSV: currency parsed', p.currency, 'USD');
  eq('CSV: gtin mapped', p.gtin, '4006381333931');
}

{
  // quoted field with an escaped ("") double quote and an embedded newline
  const csv = 'id,title,description\n1,"Widget ""Pro""","Line one\nLine two, still one field, over fifty characters long."\n';
  const { products } = parseCsvOnly(csv);
  eq('CSV: escaped double-quote inside a quoted field', products[0].title, 'Widget "Pro"');
  ok('CSV: newline inside a quoted field stays in one field', products[0].description.includes('Line one\nLine two'));
}
function parseCsvOnly(csv) {
  return parseFeed(csv, { format: 'generic_csv' });
}

{
  // semicolon-delimited CSV should still be auto-detected correctly
  const csv = 'id;title;price;availability\n1;Widget;9.99 USD;in stock\n';
  const { products } = parseFeed(csv, { format: 'generic_csv' });
  eq('CSV: semicolon delimiter auto-detected', products.length, 1);
  eq('CSV: semicolon delimiter, title mapped', products[0].title, 'Widget');
}

{
  const csv = [
    'id,title,price,availability,condition,quantity_to_sell_on_facebook,sale_price,item_group_id',
    '1,Widget,20.00 USD,in stock,new,25,15.00 USD,grp-1',
  ].join('\n');
  eq('Facebook CSV: detected via quantity_to_sell_on_facebook column', detectFormat(csv), 'facebook_csv');
  const { products } = parseFeed(csv, { format: 'facebook_csv' });
  eq('Facebook CSV: sale_price mapped and parsed', products[0].sale_price, 15);
  eq('Facebook CSV: item_group_id mapped', products[0].item_group_id, 'grp-1');
}

// ─────────────────────────────────────────────────────────────────────────
// 21. Shopify /products.json
// ─────────────────────────────────────────────────────────────────────────

{
  const shopify = {
    products: [
      {
        id: 111,
        title: 'Classic Tee',
        body_html: '<p>Soft cotton t-shirt, regular fit.</p>',
        vendor: 'Acme Apparel',
        product_type: 'Shirts',
        handle: 'classic-tee',
        images: [{ id: 9001, src: 'https://cdn.example.com/tee.jpg' }],
        options: [{ name: 'Size', position: 1 }, { name: 'Color', position: 2 }],
        variants: [
          { id: 1, title: 'Small / Red', price: '19.99', sku: 'TEE-S-RED', available: true, option1: 'Small', option2: 'Red', barcode: '4006381333931' },
          { id: 2, title: 'Medium / Red', price: '19.99', sku: 'TEE-M-RED', available: false, option1: 'Medium', option2: 'Red', barcode: '4006381333931' },
        ],
      },
      {
        id: 222,
        title: 'Simple Mug',
        body_html: 'Plain ceramic mug.',
        vendor: '',
        product_type: 'Mugs',
        handle: 'simple-mug',
        images: [],
        options: [{ name: 'Title', position: 1 }],
        variants: [{ id: 3, title: 'Default Title', price: '8.00', sku: 'MUG-1', available: true }],
      },
    ],
  };
  const text = JSON.stringify(shopify);
  eq('Shopify JSON: format detected', detectFormat(text), 'shopify_json');
  const { products } = parseFeed(text);
  eq('Shopify JSON: two variants + one simple product = 3 rows', products.length, 3);

  const small = products.find((p) => p.mpn === 'TEE-S-RED');
  ok('Shopify JSON: variant title combines product + variant title', small.title.includes('Classic Tee') && small.title.includes('Small / Red'));
  eq('Shopify JSON: price parsed from variant', small.price, 19.99);
  eq('Shopify JSON: brand from vendor', small.brand, 'Acme Apparel');
  eq('Shopify JSON: availability true -> "in stock"', small.availability, 'in stock');
  eq('Shopify JSON: gtin from barcode', small.gtin, '4006381333931');
  eq('Shopify JSON: mpn from sku', small.mpn, 'TEE-S-RED');
  eq('Shopify JSON: size from option1 via Size option', small.size, 'Small');
  eq('Shopify JSON: color from option2 via Color option', small.color, 'Red');
  eq('Shopify JSON: item_group_id set for a multi-variant product', small.item_group_id, '111');
  ok('Shopify JSON: description kept raw HTML from body_html (flags description_has_html downstream)', small.description.includes('<p>'));

  const medium = products.find((p) => p.mpn === 'TEE-M-RED');
  eq('Shopify JSON: availability false -> "out of stock"', medium.availability, 'out of stock');

  const mug = products.find((p) => p.mpn === 'MUG-1');
  eq('Shopify JSON: single-variant product gets no item_group_id', mug.item_group_id, null);
  eq('Shopify JSON: empty vendor string normalizes to null brand', mug.brand, null);

  const r = analyze(text);
  has('Shopify JSON pipeline: flags description_has_html for the raw body_html', r.problems, 'description_has_html');
  has('Shopify JSON pipeline: flags missing_image_link for the product with no images', r.problems, 'missing_image_link');
  lacks('Shopify JSON pipeline: currency unknown for this format, so no price_missing_currency', r.problems, 'price_missing_currency');
}

// ─────────────────────────────────────────────────────────────────────────
// 22. WooCommerce Store API JSON
// ─────────────────────────────────────────────────────────────────────────

{
  const woo = [
    {
      id: 55,
      name: 'Ceramic Vase',
      description: '<p>Hand-thrown ceramic vase, 30cm tall.</p>',
      short_description: 'Ceramic vase.',
      sku: 'VASE-30',
      permalink: 'https://shop.example.com/product/ceramic-vase',
      prices: { price: '4500', regular_price: '4500', sale_price: null, currency_code: 'USD', currency_minor_unit: 2 },
      images: [{ src: 'https://shop.example.com/vase.jpg' }],
      is_in_stock: true,
      is_on_backorder: false,
      has_variations: false,
      categories: [{ name: 'Home' }, { name: 'Decor' }],
    },
    {
      id: 56,
      name: 'Modular Shelf',
      description: 'Modular oak shelf unit, several sizes and finishes available.',
      sku: 'SHELF-1',
      permalink: 'https://shop.example.com/product/modular-shelf',
      prices: { price: '12000', regular_price: '15000', sale_price: '12000', currency_code: 'EUR', currency_minor_unit: 2 },
      images: [{ src: 'https://shop.example.com/shelf.jpg' }],
      is_in_stock: false,
      is_on_backorder: true,
      has_variations: true,
      categories: [],
    },
  ];
  const text = JSON.stringify(woo);
  eq('WooCommerce JSON: format detected', detectFormat(text), 'woocommerce_json');
  const { products } = parseFeed(text);
  eq('WooCommerce JSON: two products parsed', products.length, 2);

  const vase = products.find((p) => p.mpn === 'VASE-30');
  eq('WooCommerce JSON: price converted from minor units (4500 -> 45)', vase.price, 45);
  eq('WooCommerce JSON: currency from currency_code', vase.currency, 'USD');
  eq('WooCommerce JSON: no sale (price === regular_price) -> sale_price null', vase.sale_price, null);
  eq('WooCommerce JSON: is_in_stock true -> "in stock"', vase.availability, 'in stock');
  eq('WooCommerce JSON: category joined from categories[].name', vase.google_product_category, 'Home > Decor');
  eq('WooCommerce JSON: no variations -> no item_group_id', vase.item_group_id, null);

  const shelf = products.find((p) => p.mpn === 'SHELF-1');
  eq('WooCommerce JSON: regular_price converted (15000 -> 150)', shelf.price, 150);
  eq('WooCommerce JSON: on sale -> sale_price converted (12000 -> 120)', shelf.sale_price, 120);
  eq('WooCommerce JSON: is_on_backorder true -> "backorder"', shelf.availability, 'backorder');
  eq('WooCommerce JSON: has_variations true -> item_group_id set to product id', shelf.item_group_id, '56');

  const r = analyze(text);
  has('WooCommerce JSON pipeline: flags item_group_variant_missing_attrs for the shelf (no size/color)', r.problems, 'item_group_variant_missing_attrs');
  has('WooCommerce JSON pipeline: flags missing_brand (brand never provided by the Store API)', r.problems, 'missing_brand');
}

// ─────────────────────────────────────────────────────────────────────────
// 23. score formula and severity ordering
// ─────────────────────────────────────────────────────────────────────────

eq('computeScore: no problems -> 100', computeScore([]), 100);
eq('computeScore: one error instance -> 97', computeScore([{ severity: 'error', count: 1 }]), 97);
eq('computeScore: one warning instance -> 99', computeScore([{ severity: 'warning', count: 1 }]), 99);
eq('computeScore: one info instance -> 100 (rounds to nearest)', computeScore([{ severity: 'info', count: 1 }]), 100);
eq('computeScore: never goes below 0', computeScore([{ severity: 'error', count: 1000 }]), 0);

{
  const r = analyze(xmlFeed([{ id: null }, { shipping: null }]));
  ok('problems are sorted error before warning before info', r.problems[0].severity === 'error');
}

// ─────────────────────────────────────────────────────────────────────────
// 24. export helpers
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyzeOne({ id: null });
  const csv = issuesToCsv(r.issues);
  ok('issuesToCsv: starts with the expected header row', csv.startsWith('rule_id,severity,product_index,id,title,detail'));
  ok('issuesToCsv: contains the missing_id rule id', csv.includes('missing_id'));

  const json = reportToJson(r);
  const parsed = JSON.parse(json);
  eq('reportToJson: round-trips productCount', parsed.productCount, r.productCount);
  eq('reportToJson: round-trips score', parsed.score, r.score);
  ok('reportToJson: rules table is present and has one entry per rule', Array.isArray(parsed.rules) && parsed.rules.length === RULES.length);
}

// ─────────────────────────────────────────────────────────────────────────
// 25. RULES table completeness
// ─────────────────────────────────────────────────────────────────────────

{
  const ids = RULES.map((r) => r.id);
  const uniqueIds = new Set(ids);
  eq('RULES: every rule id is unique', uniqueIds.size, ids.length);
  ok('RULES: at least 25 rules defined', RULES.length >= 25);
  for (const rule of RULES) {
    ok(`RULES: "${rule.id}" has a non-empty title`, typeof rule.title === 'string' && rule.title.length > 0);
    ok(`RULES: "${rule.id}" has a valid severity`, ['error', 'warning', 'info'].includes(rule.severity));
    ok(`RULES: "${rule.id}" exposes a check() function`, typeof rule.check === 'function');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 26. checkProducts() returns the full table even for untriggered rules
// ─────────────────────────────────────────────────────────────────────────

{
  const { products } = parseFeed(xmlFeed([{}]));
  const { table, problems } = checkProducts(products);
  eq('checkProducts: table has one row per rule', table.length, RULES.length);
  eq('checkProducts: a clean product triggers zero problems', problems.length, 0);
  ok('checkProducts: untriggered rules still report count 0', table.every((r) => r.count === 0));
}

// ─────────────────────────────────────────────────────────────────────────
// 27. drill-down cap at 200 issues
// ─────────────────────────────────────────────────────────────────────────

{
  const items = [];
  for (let i = 0; i < 250; i++) items.push({ id: null, title: 'Item ' + i });
  const r = analyze(xmlFeed(items));
  eq('250 items all missing id: productCount is 250', r.productCount, 250);
  eq('250 items all missing id: issues capped at 200', r.issues.length, 200);
  eq('250 items all missing id: truncated flag is true', r.truncated, true);
  eq('250 items all missing id: the rule itself still reports the true count of 250', countOf(r.problems, 'missing_id'), 250);
}

// ─────────────────────────────────────────────────────────────────────────
// 28. unknown / empty input never throws
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyze('');
  eq('empty input: format is unknown', r.format, 'unknown');
  eq('empty input: productCount is 0', r.productCount, 0);
  eq('empty input: score is 100 (nothing to penalize)', r.score, 100);
  eq('empty input: no problems', r.problems.length, 0);
}
{
  const r = analyze('this is not a feed at all, just prose.');
  ok('nonsense input does not throw and returns a report object', r && typeof r === 'object');
}
{
  const r = analyze('{ this is not valid json');
  eq('malformed JSON-looking input: format is unknown', r.format, 'unknown');
  eq('malformed JSON-looking input: productCount is 0', r.productCount, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 29. the built-in sample feed: exactly 12 products, exactly 6 distinct
//     triggered rules, matching the six deliberate problems it documents.
// ─────────────────────────────────────────────────────────────────────────

{
  const r = analyze(SAMPLE_FEED);
  eq('sample feed: format detected as google_rss', r.format, 'google_rss');
  eq('sample feed: 12 products', r.productCount, 12);
  eq('sample feed: exactly 6 distinct rules triggered', r.problems.length, 6);
  has('sample feed: missing_description', r.problems, 'missing_description');
  has('sample feed: duplicate_id', r.problems, 'duplicate_id');
  has('sample feed: price_negative', r.problems, 'price_negative');
  has('sample feed: image_link_not_https', r.problems, 'image_link_not_https');
  has('sample feed: availability_invalid', r.problems, 'availability_invalid');
  has('sample feed: gtin_checksum_invalid', r.problems, 'gtin_checksum_invalid');
  lacks('sample feed: shipping is present on every item, so no shipping_missing noise', r.problems, 'shipping_missing');
  ok('sample feed: score is below 100', r.score < 100);
}

// ─────────────────────────────────────────────────────────────────────────
// 30. sample-feed.xml next to the page is the built-in sample, byte for byte,
//     so "Fetch & analyze" can be tried with a real URL.
// ─────────────────────────────────────────────────────────────────────────

{
  const onDisk = readFileSync(new URL('./sample-feed.xml', import.meta.url), 'utf8');
  eq('sample-feed.xml matches SAMPLE_FEED', onDisk, SAMPLE_FEED);
}

// ─────────────────────────────────────────────────────────────────────────
// 31. handoff link to ARLing Asistent: the fetched feed URL travels along
//     encoded as ?feed=, pasted/uploaded input links to the plain page.
// ─────────────────────────────────────────────────────────────────────────

{
  eq('handoff: plain URL is encoded into ?feed= with #playground', asistentHandoffUrl('https://shop.example/feed.xml'), 'https://arling.sk/asistent/?feed=https%3A%2F%2Fshop.example%2Ffeed.xml#playground');
  eq('handoff: query string in the feed URL is fully encoded', asistentHandoffUrl('https://shop.example/products.json?limit=250&page=2'), 'https://arling.sk/asistent/?feed=https%3A%2F%2Fshop.example%2Fproducts.json%3Flimit%3D250%26page%3D2#playground');
  eq('handoff: surrounding whitespace is trimmed', asistentHandoffUrl('  https://shop.example/feed.xml  '), 'https://arling.sk/asistent/?feed=https%3A%2F%2Fshop.example%2Ffeed.xml#playground');
  eq('handoff: http URL is accepted', asistentHandoffUrl('http://shop.example/feed.xml'), 'https://arling.sk/asistent/?feed=http%3A%2F%2Fshop.example%2Ffeed.xml#playground');
  ok('handoff: decoded ?feed= round-trips to the original URL', new URL(asistentHandoffUrl('https://shop.example/a b?x=1&y=2')).searchParams.get('feed') === 'https://shop.example/a%20b?x=1&y=2');
  eq('handoff: pasted input (null) links to the plain Asistent page', asistentHandoffUrl(null), ASISTENT_URL);
  eq('handoff: pasted input (empty string) links to the plain Asistent page', asistentHandoffUrl(''), ASISTENT_URL);
  eq('handoff: uploaded input (undefined) links to the plain Asistent page', asistentHandoffUrl(undefined), ASISTENT_URL);
  eq('handoff: not a URL at all gives the plain page', asistentHandoffUrl('feed.xml'), ASISTENT_URL);
  eq('handoff: non-http scheme gives the plain page', asistentHandoffUrl('javascript:alert(1)'), ASISTENT_URL);
  eq('handoff: file scheme gives the plain page', asistentHandoffUrl('file:///C:/feed.xml'), ASISTENT_URL);
  ok('handoff: plain page link carries no ?feed=', !ASISTENT_URL.includes('?feed=') && !asistentHandoffUrl('').includes('feed='));
  eq('handoff: ASISTENT_URL is the demo page', ASISTENT_URL, 'https://arling.sk/asistent/');
}

// ─────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('All tests passed.');
}
