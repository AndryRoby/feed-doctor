// feed-doctor.js: Product Feed Doctor core logic.
//
// Pure, deterministic, 100% client-side: given the text of a shopping/product
// feed (Google Shopping / Merchant Center RSS 2.0, a Facebook/Meta catalog
// CSV, a Shopify /products.json export, a WooCommerce Store API JSON
// response, a generic XML feed with <item> elements, or a plain CSV with a
// header row), this detects the format, parses it, normalises every row into
// one product shape, and runs a fixed set of rules against it: missing
// required fields, duplicate ids, malformed prices and links, invalid
// availability/condition values, bad GTIN checksums, and more.
//
// Nothing in this file makes a network request, reads a file, or touches the
// DOM. It only processes the string you pass to analyze()/parseFeed().
//
// Field names referenced below (id, title, description, link, image_link,
// price, sale_price, availability, condition, brand, gtin, mpn,
// item_group_id, shipping, google_product_category) are the attribute names
// used by Google's Merchant Center product data specification:
// https://support.google.com/merchants/answer/7052112
// This file cites those attribute names to explain what each rule checks; it
// does not quote or restate Google's policy text, and it is not affiliated
// with or endorsed by Google, Meta, Shopify, or WooCommerce/Automattic.
//
// Works as an ES module (import { analyze } from './feed-doctor.js') and,
// when loaded with <script type="module">, also publishes
// window.FeedDoctor = { analyze, parseFeed, detectFormat, checkProducts,
// gtinChecksumValid, issuesToCsv, reportToJson, asistentHandoffUrl, RULES,
// SAMPLE_FEED }.

// ───────────────────────── small helpers ─────────────────────────

function s(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function isBlank(v) {
  return s(v).trim() === '';
}

// present-but-only-whitespace: has characters, but none of them survive trim
function isWhitespaceOnly(raw) {
  return typeof raw === 'string' && raw.length > 0 && raw.trim() === '';
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'];

function parseUrl(raw) {
  try {
    return new URL(s(raw).trim());
  } catch (e) {
    return null;
  }
}

// Control characters that should never appear in feed text (tab/newline are
// fine), plus U+FFFD, the Unicode replacement character a decoder emits when
// bytes could not be read as valid UTF-8. Either one, found in a value that
// made it out of the parser, means the source bytes were not clean UTF-8.
const BAD_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

function hasHtmlTag(str) {
  return /<\s*[a-z][a-z0-9]*(\s[^>]*)?>/i.test(s(str));
}

// ───────────────────────── price parsing ─────────────────────────
// Accepts "19.99", "19,99", "19.99 USD", "USD 19.99", "$19.99", "19.99EUR".

const CURRENCY_CODE_RE = /\b([A-Z]{3})\b/;
const CURRENCY_SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', 'Kč': 'CZK', 'zł': 'PLN' };

function parsePrice(raw) {
  const str = s(raw).trim();
  if (!str) return { amount: null, currency: '' };
  let currency = '';
  const codeMatch = str.match(CURRENCY_CODE_RE);
  if (codeMatch) currency = codeMatch[1];
  if (!currency) {
    for (const sym of Object.keys(CURRENCY_SYMBOLS)) {
      if (str.includes(sym)) {
        currency = CURRENCY_SYMBOLS[sym];
        break;
      }
    }
  }
  // strip everything except digits, minus sign, dot and comma, then decide
  // which of . / , is the decimal separator (the right-most one, if both
  // appear; otherwise treat a single , as a decimal separator too).
  let numeric = str.replace(/[^0-9.,-]/g, '');
  const lastDot = numeric.lastIndexOf('.');
  const lastComma = numeric.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      numeric = numeric.replace(/\./g, '').replace(',', '.');
    } else {
      numeric = numeric.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    numeric = numeric.replace(',', '.');
  }
  if (!numeric || numeric === '-') return { amount: null, currency };
  const amount = Number(numeric);
  return { amount: Number.isFinite(amount) ? amount : null, currency };
}

// ───────────────────────── GTIN checksum (GS1 mod 10) ─────────────────────────
// Valid lengths are GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13) and GTIN-14.
// The check digit (last digit) must equal (10 - (weighted sum mod 10)) mod 10,
// where the preceding digits are read from the right and weighted 3,1,3,1...

export function gtinChecksumValid(raw) {
  const digits = s(raw).replace(/[^0-9]/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1);
  const checkDigit = Number(digits.slice(-1));
  let sum = 0;
  let mult = 3;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mult;
    mult = mult === 3 ? 1 : 3;
  }
  const calc = (10 - (sum % 10)) % 10;
  return calc === checkDigit;
}

// ───────────────────────── XML helpers (no DOMParser dependency) ─────────────────────────
// A small, tolerant, regex-based reader: good enough for the flat, repeating
// <item>...</item> records real shopping feeds use, without pulling in an
// XML/DOM library. Namespaced tags (g:price) are matched by their literal
// name, colon included.

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function decodeXmlText(raw) {
  const trimmedWhole = raw.trim();
  const cdataMatch = trimmedWhole.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdataMatch) return cdataMatch[1];
  return decodeXmlEntities(raw);
}

function escapeForTagRegex(tag) {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Looks for the first of `names` (tried in order) as a top-level tag inside
// `block`. Returns { present, raw } — present=false means the tag never
// appeared at all; present=true with raw='' covers both a self-closing tag
// (<g:condition/>) and an explicitly empty one (<g:condition></g:condition>).
function extractXmlTag(block, names) {
  for (const name of names) {
    const esc = escapeForTagRegex(name);
    const selfClosing = new RegExp('<' + esc + '(?:\\s[^>]*)?/>', 'i');
    if (selfClosing.test(block)) return { present: true, raw: '' };
    const withContent = new RegExp('<' + esc + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc + '>', 'i');
    const m = block.match(withContent);
    if (m) return { present: true, raw: decodeXmlText(m[1]) };
  }
  return { present: false, raw: '' };
}

// Whether `block` contains a non-empty <shipping>/<g:shipping> element at all
// (only presence matters for the shipping_missing rule).
function xmlHasNonEmptyTag(block, names) {
  const tag = extractXmlTag(block, names);
  return tag.present && tag.raw.trim() !== '';
}

// Removes every occurrence of the given top-level-or-nested tag(s) from
// `block` before the plain field lookups run. Without this, a field that is
// genuinely absent at the top level (e.g. no top-level <g:price>) could
// wrongly match a same-named tag nested inside another element entirely
// (e.g. the <g:price> inside <g:shipping>), since the tag lookup is a plain
// leftmost regex match, not a depth-aware XML walk.
function stripXmlTagBlocks(block, names) {
  let out = block;
  for (const name of names) {
    const esc = escapeForTagRegex(name);
    out = out.replace(new RegExp('<' + esc + '(?:\\s[^>]*)?>[\\s\\S]*?</' + esc + '>', 'gi'), '');
    out = out.replace(new RegExp('<' + esc + '(?:\\s[^>]*)?/>', 'gi'), '');
  }
  return out;
}

const ITEM_WRAPPER_CANDIDATES = ['item', 'entry', 'product', 'offer'];

function extractXmlItemBlocks(xml) {
  for (const wrapper of ITEM_WRAPPER_CANDIDATES) {
    const re = new RegExp('<' + wrapper + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + wrapper + '>', 'gi');
    const blocks = [];
    let m;
    while ((m = re.exec(xml))) blocks.push(m[1]);
    if (blocks.length) return blocks;
  }
  return [];
}

function looksLikeGoogleXml(xml) {
  return /xmlns:g\s*=\s*["']http:\/\/base\.google\.com\/ns\/1\.0["']/i.test(xml) || /<g:[a-z_]+/i.test(xml);
}

// ───────────────────────── CSV parsing (RFC 4180-ish) ─────────────────────────

function detectCsvDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ';' : ',';
}

function parseCsv(text) {
  const delim = detectCsvDelimiter((text.split(/\r?\n/, 1)[0] || ''));
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^\uFEFF/, ''); // strip BOM
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const FACEBOOK_ONLY_COLUMNS = [
  'quantity_to_sell_on_facebook',
  'sale_price_effective_date',
  'additional_image_link',
  'visibility',
];

// ───────────────────────── format detection ─────────────────────────

export function detectFormat(text) {
  const trimmed = s(text).trim();
  if (!trimmed) return 'unknown';
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    let json;
    try {
      json = JSON.parse(trimmed);
    } catch (e) {
      return 'unknown';
    }
    if (json && typeof json === 'object' && !Array.isArray(json) && Array.isArray(json.products)) {
      return 'shopify_json';
    }
    if (Array.isArray(json) && json.length && json[0] && typeof json[0] === 'object' && 'prices' in json[0]) {
      return 'woocommerce_json';
    }
    if (Array.isArray(json) && json.length === 0) return 'woocommerce_json';
    return 'unknown';
  }
  if (trimmed[0] === '<') {
    return looksLikeGoogleXml(trimmed) ? 'google_rss' : 'generic_xml';
  }
  const headerLine = trimmed.split(/\r?\n/, 1)[0] || '';
  const delim = detectCsvDelimiter(headerLine);
  const headerCells = headerLine.split(delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  if (FACEBOOK_ONLY_COLUMNS.some((c) => headerCells.includes(c))) return 'facebook_csv';
  return 'generic_csv';
}

// ───────────────────────── field candidate lists (shared by CSV + generic XML) ─────────────────────────

const FIELD_CANDIDATES = {
  id: ['g:id', 'id', 'product_id', 'item_id', 'sku'],
  title: ['g:title', 'title', 'name', 'product_title'],
  description: ['g:description', 'description', 'desc', 'summary'],
  link: ['g:link', 'link', 'url', 'product_url', 'permalink'],
  image_link: ['g:image_link', 'image_link', 'image', 'image_url', 'img_url'],
  price: ['g:price', 'price', 'regular_price', 'unit_price'],
  sale_price: ['g:sale_price', 'sale_price', 'discount_price', 'special_price'],
  availability: ['g:availability', 'availability', 'stock_status', 'in_stock'],
  brand: ['g:brand', 'brand', 'manufacturer', 'vendor'],
  gtin: ['g:gtin', 'gtin', 'ean', 'upc', 'barcode'],
  mpn: ['g:mpn', 'mpn', 'part_number'],
  condition: ['g:condition', 'condition', 'item_condition'],
  google_product_category: ['g:google_product_category', 'google_product_category', 'product_type', 'category'],
  item_group_id: ['g:item_group_id', 'item_group_id', 'parent_id', 'group_id'],
  shipping: ['g:shipping', 'shipping', 'shipping_cost'],
  size: ['g:size', 'size'],
  color: ['g:color', 'g:colour', 'color', 'colour'],
};

const FIELD_NAMES = Object.keys(FIELD_CANDIDATES);

function blankRaw() {
  const raw = {};
  for (const f of FIELD_NAMES) raw[f] = { present: false, raw: '' };
  return raw;
}

// Builds one normalized product object from a `raw` map of
// { fieldName: { present, raw } }. `currencyKnown` tells the price checks
// whether "no currency found" should count as a problem for this format.
function normalizeFromRaw(raw, index, currencyKnown) {
  const get = (f) => (raw[f] && raw[f].present ? raw[f].raw : '');
  const price = parsePrice(get('price'));
  const salePrice = get('sale_price') ? parsePrice(get('sale_price')) : { amount: null, currency: '' };
  return {
    _index: index,
    id: get('id').trim() || null,
    title: get('title').trim() || null,
    description: get('description').trim() || null,
    link: get('link').trim() || null,
    image_link: get('image_link').trim() || null,
    price: price.amount,
    currency: price.currency,
    availability: normalizeAvailabilityRaw(get('availability')),
    brand: get('brand').trim() || null,
    gtin: get('gtin').trim() || null,
    mpn: get('mpn').trim() || null,
    condition: get('condition').trim() || null,
    google_product_category: get('google_product_category').trim() || null,
    item_group_id: get('item_group_id').trim() || null,
    sale_price: salePrice.amount,
    shipping: get('shipping').trim() || null,
    size: get('size').trim() || null,
    color: get('color').trim() || null,
    _raw: raw,
    _currencyKnown: currencyKnown,
  };
}

function normalizeAvailabilityRaw(raw) {
  const trimmed = s(raw).trim();
  return trimmed === '' ? null : trimmed;
}

// ───────────────────────── per-format parsers ─────────────────────────

function parseXmlLike(text) {
  const blocks = extractXmlItemBlocks(text);
  return blocks.map((block, index) => {
    const raw = blankRaw();
    // Shipping is read (presence only) from the original block, then its
    // whole sub-tree is stripped out before every other field is looked up,
    // so a nested <g:price>/<g:country> inside <g:shipping> never gets
    // mistaken for a missing top-level field of the same name.
    const shippingPresent = xmlHasNonEmptyTag(block, FIELD_CANDIDATES.shipping);
    raw.shipping = shippingPresent ? { present: true, raw: 'present' } : { present: false, raw: '' };
    const blockForFields = stripXmlTagBlocks(block, FIELD_CANDIDATES.shipping);
    for (const field of FIELD_NAMES) {
      if (field === 'shipping') continue; // already resolved above
      raw[field] = extractXmlTag(blockForFields, FIELD_CANDIDATES[field]);
    }
    return normalizeFromRaw(raw, index, true);
  });
}

function parseCsvLike(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const products = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => c.trim() === '')) continue;
    const raw = blankRaw();
    for (const field of FIELD_NAMES) {
      for (const candidate of FIELD_CANDIDATES[field]) {
        const plain = candidate.replace(/^g:/, '');
        const colIndex = header.indexOf(plain);
        if (colIndex !== -1) {
          raw[field] = { present: true, raw: cells[colIndex] !== undefined ? cells[colIndex] : '' };
          break;
        }
      }
    }
    products.push(normalizeFromRaw(raw, r - 1, true));
  }
  return products;
}

function present(raw) {
  return { present: true, raw: raw == null ? '' : String(raw) };
}
function absent() {
  return { present: false, raw: '' };
}

function parseShopifyJson(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return [];
  }
  const items = Array.isArray(json && json.products) ? json.products : [];
  const products = [];
  let index = 0;
  for (const p of items) {
    const variants = Array.isArray(p.variants) ? p.variants : [{}];
    const images = Array.isArray(p.images) ? p.images : [];
    const multiVariant = variants.length > 1;
    const options = Array.isArray(p.options) ? p.options : [];
    const sizeOptionPos = options.findIndex((o) => /size/i.test(o && o.name || ''));
    const colorOptionPos = options.findIndex((o) => /col(o|ou)r/i.test(o && o.name || ''));
    for (const v of variants) {
      const raw = blankRaw();
      raw.id = present(v.id != null ? v.id : p.id);
      const variantTitle = v.title && v.title !== 'Default Title' ? `${p.title} - ${v.title}` : p.title;
      raw.title = p.title != null ? present(variantTitle) : absent();
      raw.description = p.body_html != null ? present(p.body_html) : absent();
      raw.link = p.handle ? present('/products/' + p.handle) : absent();
      let img = null;
      if (v.image_id) {
        const found = images.find((im) => im.id === v.image_id);
        if (found) img = found.src;
      }
      if (!img && images.length) img = images[0].src;
      raw.image_link = img ? present(img) : absent();
      raw.price = v.price != null ? present(v.price) : absent();
      raw.sale_price = absent(); // Shopify's /products.json has no separate sale price field
      raw.availability = v.available != null ? present(v.available ? 'in stock' : 'out of stock') : absent();
      raw.brand = p.vendor ? present(p.vendor) : absent();
      raw.gtin = v.barcode ? present(v.barcode) : absent();
      raw.mpn = v.sku ? present(v.sku) : absent();
      raw.condition = absent();
      raw.google_product_category = p.product_type ? present(p.product_type) : absent();
      raw.item_group_id = multiVariant ? present(p.id) : absent();
      raw.shipping = absent();
      const opts = [v.option1, v.option2, v.option3];
      raw.size = sizeOptionPos !== -1 && opts[sizeOptionPos] ? present(opts[sizeOptionPos]) : absent();
      raw.color = colorOptionPos !== -1 && opts[colorOptionPos] ? present(opts[colorOptionPos]) : absent();
      products.push(normalizeFromRaw(raw, index, false));
      index++;
    }
  }
  return products;
}

function parseWooCommerceJson(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return [];
  }
  const items = Array.isArray(json) ? json : [];
  return items.map((p, index) => {
    const raw = blankRaw();
    raw.id = p.id != null ? present(p.id) : absent();
    raw.title = p.name != null ? present(p.name) : absent();
    const desc = p.description || p.short_description;
    raw.description = desc ? present(desc) : absent();
    raw.link = p.permalink ? present(p.permalink) : absent();
    const images = Array.isArray(p.images) ? p.images : [];
    raw.image_link = images.length && images[0].src ? present(images[0].src) : absent();
    const prices = p.prices || {};
    const minorUnit = typeof prices.currency_minor_unit === 'number' ? prices.currency_minor_unit : 2;
    const toDecimal = (v) => (v == null || v === '' ? null : Number(v) / Math.pow(10, minorUnit));
    const regular = toDecimal(prices.regular_price != null ? prices.regular_price : prices.price);
    const current = toDecimal(prices.price);
    raw.price = regular != null ? present(String(regular)) : absent();
    if (prices.sale_price != null && current != null && regular != null && current < regular) {
      raw.sale_price = present(String(toDecimal(prices.sale_price)));
    } else {
      raw.sale_price = absent();
    }
    raw.availability = p.is_on_backorder
      ? present('backorder')
      : p.is_in_stock != null
        ? present(p.is_in_stock ? 'in stock' : 'out of stock')
        : absent();
    raw.brand = absent(); // not part of the core WooCommerce Store API response
    raw.gtin = absent();
    raw.mpn = p.sku ? present(p.sku) : absent();
    raw.condition = absent();
    const cats = Array.isArray(p.categories) ? p.categories.map((c) => c.name).filter(Boolean) : [];
    raw.google_product_category = cats.length ? present(cats.join(' > ')) : absent();
    raw.item_group_id = p.has_variations ? present(p.id) : absent();
    raw.shipping = absent();
    raw.size = absent();
    raw.color = absent();
    const currencyKnownForThis = !!prices.currency_code;
    const prod = normalizeFromRaw(raw, index, currencyKnownForThis);
    if (prices.currency_code) {
      prod.currency = prices.currency_code;
      if (prod.sale_price != null) prod._raw.sale_price = present(String(prod.sale_price));
    }
    return prod;
  });
}

/**
 * Detects the format (unless `format` is given) and parses `text` into an
 * array of normalized products plus feed-level metadata.
 * @param {string} text
 * @param {{ format?: string }} [opts]
 */
export function parseFeed(text, opts) {
  const options = opts || {};
  const format = options.format || detectFormat(text);
  let products = [];
  switch (format) {
    case 'google_rss':
    case 'generic_xml':
      products = parseXmlLike(text);
      break;
    case 'facebook_csv':
    case 'generic_csv':
      products = parseCsvLike(text);
      break;
    case 'shopify_json':
      products = parseShopifyJson(text);
      break;
    case 'woocommerce_json':
      products = parseWooCommerceJson(text);
      break;
    default:
      products = [];
  }
  return { format, products };
}

// ───────────────────────── rules ─────────────────────────
// Each rule is { id, severity, spec, title, check(products) }.
// check() returns an array of { index, id, title, detail } for every product
// (or, for feed-wide rules, every affected row) that violates the rule.
// severity is one of 'error' | 'warning' | 'info'.

const USED_KEYWORDS = ['used', 'refurbished', 'renewed', 'open box', 'pre-owned', 'preowned', 'second hand', 'secondhand'];
const VALID_CONDITIONS = ['new', 'refurbished', 'used'];
const VALID_AVAILABILITY = ['in stock', 'out of stock', 'preorder', 'backorder'];
const DUPLICATE_TITLE_THRESHOLD = 3;
const TEXT_FIELDS_FOR_ENCODING_CHECK = ['title', 'description', 'brand', 'gtin', 'mpn', 'link', 'image_link'];
const WHITESPACE_CHECK_FIELDS = ['id', 'title', 'description', 'brand', 'gtin', 'mpn', 'link', 'image_link'];

function ref(p, extra) {
  return { index: p._index, id: p.id, title: p.title, detail: extra };
}

function requiredFieldRule(id, field, spec) {
  return {
    id,
    severity: 'error',
    spec,
    title: `Missing ${spec}`,
    check(products) {
      return products.filter((p) => isBlank(p[field])).map((p) => ref(p, `${spec} is missing or empty.`));
    },
  };
}

export const RULES = [
  requiredFieldRule('missing_id', 'id', 'id'),
  requiredFieldRule('missing_title', 'title', 'title'),
  requiredFieldRule('missing_description', 'description', 'description'),
  requiredFieldRule('missing_link', 'link', 'link'),
  requiredFieldRule('missing_image_link', 'image_link', 'image_link'),
  {
    // Not built with requiredFieldRule(): p.price is the *parsed* number,
    // which is also null when the raw value is present but unparsable
    // (e.g. "call for price"). That case is price_not_numeric's job, not
    // this rule's, so this checks the raw value's presence instead.
    id: 'missing_price',
    severity: 'error',
    spec: 'price',
    title: 'Missing price',
    check(products) {
      return products.filter((p) => !p._raw.price.present || isBlank(p._raw.price.raw)).map((p) => ref(p, 'price is missing or empty.'));
    },
  },
  requiredFieldRule('missing_availability', 'availability', 'availability'),
  {
    id: 'missing_condition_used',
    severity: 'error',
    spec: 'condition',
    title: 'condition missing on an apparently used item',
    check(products) {
      return products
        .filter((p) => isBlank(p.condition))
        .filter((p) => {
          const text = `${s(p.title)} ${s(p.description)}`.toLowerCase();
          return USED_KEYWORDS.some((kw) => text.includes(kw));
        })
        .map((p) => ref(p, 'The title or description suggests a used/refurbished item, but condition is not set.'));
    },
  },
  {
    id: 'invalid_condition',
    severity: 'warning',
    spec: 'condition',
    title: 'condition is not new, refurbished or used',
    check(products) {
      return products
        .filter((p) => !isBlank(p.condition) && !VALID_CONDITIONS.includes(s(p.condition).trim().toLowerCase()))
        .map((p) => ref(p, `condition is "${p.condition}", expected one of: ${VALID_CONDITIONS.join(', ')}.`));
    },
  },
  {
    id: 'duplicate_id',
    severity: 'error',
    spec: 'id',
    title: 'Duplicate id',
    check(products) {
      const byId = new Map();
      for (const p of products) {
        if (isBlank(p.id)) continue;
        const key = p.id.trim();
        if (!byId.has(key)) byId.set(key, []);
        byId.get(key).push(p);
      }
      const out = [];
      for (const [key, group] of byId) {
        if (group.length > 1) {
          for (const p of group) out.push(ref(p, `id "${key}" is used by ${group.length} items; id must be unique per item.`));
        }
      }
      return out;
    },
  },
  {
    id: 'title_too_long',
    severity: 'warning',
    spec: 'title',
    title: 'Title over 150 characters',
    check(products) {
      return products
        .filter((p) => !isBlank(p.title) && p.title.length > 150)
        .map((p) => ref(p, `title is ${p.title.length} characters; Merchant Center truncates title beyond 150.`));
    },
  },
  {
    id: 'title_all_caps',
    severity: 'warning',
    spec: 'title',
    title: 'Title is all caps',
    check(products) {
      return products
        .filter((p) => {
          if (isBlank(p.title)) return false;
          const hasLetters = /[a-zA-Z]/.test(p.title);
          return hasLetters && p.title === p.title.toUpperCase();
        })
        .map((p) => ref(p, 'title is written in all caps; use normal capitalization.'));
    },
  },
  {
    id: 'description_too_short',
    severity: 'warning',
    spec: 'description',
    title: 'Description shorter than 50 characters',
    check(products) {
      return products
        .filter((p) => !isBlank(p.description) && p.description.length < 50)
        .map((p) => ref(p, `description is only ${p.description.length} characters; add more detail.`));
    },
  },
  {
    id: 'description_has_html',
    severity: 'warning',
    spec: 'description',
    title: 'Description contains HTML',
    check(products) {
      return products
        .filter((p) => !isBlank(p.description) && hasHtmlTag(p.description))
        .map((p) => ref(p, 'description contains HTML markup; description should be plain text.'));
    },
  },
  {
    id: 'price_not_numeric',
    severity: 'error',
    spec: 'price',
    title: 'price is not a valid number',
    check(products) {
      return products
        .filter((p) => p._raw.price.present && !isBlank(p._raw.price.raw) && p.price === null)
        .map((p) => ref(p, `price "${p._raw.price.raw}" could not be read as a number.`));
    },
  },
  {
    id: 'price_missing_currency',
    severity: 'error',
    spec: 'price',
    title: 'price has no currency',
    check(products) {
      return products
        .filter((p) => p._currencyKnown && p.price != null && !p.currency)
        .map((p) => ref(p, `price "${p._raw.price.raw}" has no currency code; price must include a currency, e.g. "${p.price} USD".`));
    },
  },
  {
    id: 'price_negative',
    severity: 'error',
    spec: 'price',
    title: 'price is negative',
    check(products) {
      return products.filter((p) => p.price != null && p.price < 0).map((p) => ref(p, `price is ${p.price}, which is negative.`));
    },
  },
  {
    id: 'sale_price_gte_price',
    severity: 'error',
    spec: 'sale_price',
    title: 'sale_price is not lower than price',
    check(products) {
      return products
        .filter((p) => p.sale_price != null && p.price != null && p.sale_price >= p.price)
        .map((p) => ref(p, `sale_price (${p.sale_price}) is not lower than price (${p.price}).`));
    },
  },
  {
    id: 'link_invalid',
    severity: 'error',
    spec: 'link',
    title: 'link is not a valid absolute URL',
    check(products) {
      return products.filter((p) => !isBlank(p.link) && !parseUrl(p.link)).map((p) => ref(p, `link "${p.link}" is not a valid, fully-qualified URL.`));
    },
  },
  {
    id: 'link_not_https',
    severity: 'warning',
    spec: 'link',
    title: 'link is not https',
    check(products) {
      return products
        .filter((p) => !isBlank(p.link) && parseUrl(p.link) && parseUrl(p.link).protocol !== 'https:')
        .map((p) => ref(p, `link uses "${parseUrl(p.link).protocol}", expected https:.`));
    },
  },
  {
    id: 'image_link_invalid',
    severity: 'error',
    spec: 'image_link',
    title: 'image_link is not a valid absolute URL',
    check(products) {
      return products
        .filter((p) => !isBlank(p.image_link) && !parseUrl(p.image_link))
        .map((p) => ref(p, `image_link "${p.image_link}" is not a valid, fully-qualified URL.`));
    },
  },
  {
    id: 'image_link_not_https',
    severity: 'warning',
    spec: 'image_link',
    title: 'image_link is not https',
    check(products) {
      return products
        .filter((p) => !isBlank(p.image_link) && parseUrl(p.image_link) && parseUrl(p.image_link).protocol !== 'https:')
        .map((p) => ref(p, `image_link uses "${parseUrl(p.image_link).protocol}", expected https:.`));
    },
  },
  {
    id: 'image_link_missing_extension',
    severity: 'info',
    spec: 'image_link',
    title: 'image_link has no recognizable image extension',
    check(products) {
      return products
        .filter((p) => {
          if (isBlank(p.image_link)) return false;
          const u = parseUrl(p.image_link);
          if (!u) return false;
          const path = u.pathname.toLowerCase();
          return !IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
        })
        .map((p) => ref(p, `image_link path "${parseUrl(p.image_link).pathname}" has no common image file extension.`));
    },
  },
  {
    id: 'availability_invalid',
    severity: 'error',
    spec: 'availability',
    title: 'availability is not a recognized value',
    check(products) {
      return products
        .filter((p) => {
          if (isBlank(p.availability)) return false;
          const norm = p.availability.trim().toLowerCase().replace(/_/g, ' ');
          return !VALID_AVAILABILITY.includes(norm);
        })
        .map((p) => ref(p, `availability is "${p.availability}", expected one of: ${VALID_AVAILABILITY.join(', ')}.`));
    },
  },
  {
    id: 'gtin_checksum_invalid',
    severity: 'error',
    spec: 'gtin',
    title: 'gtin fails the checksum',
    check(products) {
      return products
        .filter((p) => !isBlank(p.gtin) && !gtinChecksumValid(p.gtin))
        .map((p) => ref(p, `gtin "${p.gtin}" is not a valid GTIN-8/12/13/14 (wrong length or failed check digit).`));
    },
  },
  {
    id: 'missing_brand',
    severity: 'warning',
    spec: 'brand',
    title: 'Missing brand',
    check(products) {
      // Google ties brand to gtin/mpn for identifying (non-custom) products;
      // an item with neither identifier is typically a custom-made product,
      // where brand is commonly left out on purpose.
      return products
        .filter((p) => isBlank(p.brand) && (!isBlank(p.gtin) || !isBlank(p.mpn)))
        .map((p) => ref(p, 'brand is missing, but gtin/mpn is set, so this looks like a branded, non-custom product.'));
    },
  },
  {
    id: 'item_group_variant_missing_attrs',
    severity: 'warning',
    spec: 'item_group_id',
    title: 'item_group_id used without size or color',
    check(products) {
      return products
        .filter((p) => !isBlank(p.item_group_id) && isBlank(p.size) && isBlank(p.color))
        .map((p) => ref(p, `item_group_id "${p.item_group_id}" groups variants, but neither size nor color is set to tell them apart.`));
    },
  },
  {
    id: 'shipping_missing',
    severity: 'info',
    spec: 'shipping',
    title: 'No shipping information',
    check(products) {
      return products.filter((p) => isBlank(p.shipping)).map((p) => ref(p, 'shipping (cost/weight) is not set.'));
    },
  },
  {
    id: 'non_utf8_chars',
    severity: 'warning',
    spec: null,
    title: 'Non-UTF-8 / control characters found',
    check(products) {
      const out = [];
      for (const p of products) {
        for (const field of TEXT_FIELDS_FOR_ENCODING_CHECK) {
          const v = p[field];
          if (typeof v === 'string' && BAD_CHAR_RE.test(v)) {
            out.push(ref(p, `${field} contains a control character or the Unicode replacement character (U+FFFD), a sign the source bytes were not clean UTF-8.`));
            break;
          }
        }
      }
      return out;
    },
  },
  {
    id: 'whitespace_only_value',
    severity: 'warning',
    spec: null,
    title: 'Field present but only whitespace',
    check(products) {
      const out = [];
      for (const p of products) {
        for (const field of WHITESPACE_CHECK_FIELDS) {
          const entry = p._raw[field];
          if (entry && isWhitespaceOnly(entry.raw)) {
            out.push(ref(p, `${field} is present in the feed but contains only whitespace.`));
            break;
          }
        }
      }
      return out;
    },
  },
  {
    id: 'duplicate_titles',
    severity: 'warning',
    spec: 'title',
    title: `More than ${DUPLICATE_TITLE_THRESHOLD} items share the same title`,
    check(products) {
      const byTitle = new Map();
      for (const p of products) {
        if (isBlank(p.title)) continue;
        const key = p.title.trim().toLowerCase();
        if (!byTitle.has(key)) byTitle.set(key, []);
        byTitle.get(key).push(p);
      }
      const out = [];
      for (const [key, group] of byTitle) {
        if (group.length > DUPLICATE_TITLE_THRESHOLD) {
          for (const p of group) out.push(ref(p, `title "${p.title}" is shared by ${group.length} items; each item should describe one distinct product.`));
        }
      }
      return out;
    },
  },
];

const RULES_BY_ID = new Map(RULES.map((r) => [r.id, r]));

// ───────────────────────── running checks + scoring ─────────────────────────

/**
 * Runs every rule in RULES against `products`. Returns the full rule table
 * (every rule, with count 0 when nothing was found) plus the flattened list
 * of triggered rules (`problems`) ordered error -> warning -> info.
 */
export function checkProducts(products) {
  const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };
  const table = RULES.map((rule) => {
    const items = rule.check(products);
    return {
      id: rule.id,
      severity: rule.severity,
      spec: rule.spec,
      title: rule.title,
      count: items.length,
      examples: items.slice(0, 5),
      items,
    };
  });
  const problems = table
    .filter((r) => r.count > 0)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);
  return { table, problems };
}

/**
 * score formula (heuristic, not a Google-defined metric): start at 100,
 * subtract 3 points per error instance, 1 point per warning instance and 0.2
 * points per info instance found across the whole feed, floor at 0, round to
 * the nearest integer.
 */
export function computeScore(problems) {
  let penalty = 0;
  for (const p of problems) {
    const weight = p.severity === 'error' ? 3 : p.severity === 'warning' ? 1 : 0.2;
    penalty += weight * p.count;
  }
  return Math.max(0, Math.round(100 - penalty));
}

const MAX_DRILLDOWN_ISSUES = 200;

/**
 * Full pipeline: detect format (unless given), parse, normalize, run every
 * rule, score the result, and flatten the first MAX_DRILLDOWN_ISSUES
 * individual issues (across all rules) for a per-product drill-down.
 * @param {string} text
 * @param {{ format?: string }} [opts]
 */
export function analyze(text, opts) {
  const { format, products } = parseFeed(text, opts);
  const { table, problems } = checkProducts(products);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const p of problems) counts[p.severity] += p.count;
  const score = computeScore(problems);

  const issues = [];
  outer: for (const p of problems) {
    for (const item of p.items) {
      if (issues.length >= MAX_DRILLDOWN_ISSUES) break outer;
      issues.push({ ruleId: p.id, severity: p.severity, index: item.index, id: item.id, title: item.title, detail: item.detail });
    }
  }

  return {
    format,
    productCount: products.length,
    score,
    counts,
    rules: table,
    problems,
    issues,
    truncated: issues.length >= MAX_DRILLDOWN_ISSUES,
  };
}

export function ruleById(id) {
  return RULES_BY_ID.get(id) || null;
}

// ───────────────────────── CSV/JSON export helpers ─────────────────────────

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

export function issuesToCsv(issues) {
  const header = ['rule_id', 'severity', 'product_index', 'id', 'title', 'detail'];
  const lines = [header.join(',')];
  for (const it of issues) {
    lines.push([it.ruleId, it.severity, it.index, it.id || '', it.title || '', it.detail || ''].map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

export function reportToJson(report) {
  return JSON.stringify(
    {
      format: report.format,
      productCount: report.productCount,
      score: report.score,
      counts: report.counts,
      rules: report.rules.map((r) => ({ id: r.id, severity: r.severity, spec: r.spec, title: r.title, count: r.count, examples: r.examples })),
      issues: report.issues,
      truncated: report.truncated,
    },
    null,
    2
  );
}

// ───────────────────────── handoff to ARLing Asistent ─────────────────────────
// The results panel ends with one line offering to try the same feed in
// ARLing Asistent (a shopping assistant built from a product feed). When the
// feed came from a URL the visitor typed, that URL travels along as ?feed=
// so the Asistent trial form is prefilled; pasted or uploaded content has no
// URL, so the link is the plain Asistent page. Only http(s) URLs qualify.

export const ASISTENT_URL = 'https://arling.sk/asistent/';

export function asistentHandoffUrl(sourceUrl) {
  const raw = typeof sourceUrl === 'string' ? sourceUrl.trim() : '';
  if (!raw) return ASISTENT_URL;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (e) {
    return ASISTENT_URL;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ASISTENT_URL;
  return ASISTENT_URL + '?feed=' + encodeURIComponent(parsed.href) + '#playground';
}

// ───────────────────────── sample feed ─────────────────────────
// A small, self-contained Google Shopping RSS 2.0 feed: 12 items, 6
// deliberately broken in one distinct way each (everything else about them
// is otherwise valid), so the sample always demonstrates exactly six rule
// violations:
//   1. item 2  -> missing_description (description omitted entirely)
//   2. item 3  -> duplicate_id (reuses item 1's id, "sku-1001")
//   3. item 4  -> price_negative (price is "-9.99 USD")
//   4. item 5  -> image_link_not_https (image_link uses http://)
//   5. item 6  -> availability_invalid ("Available" is not a recognized value)
//   6. item 7  -> gtin_checksum_invalid (last digit of a real GTIN-13 changed)

export const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<atom:link href="https://shop.example.com/feed.xml" rel="self" type="application/rss+xml"/>
<title>Example Shop product feed</title>
<link>https://shop.example.com</link>
<description>Sample Google Shopping feed for Product Feed Doctor</description>
<item>
<g:id>sku-1001</g:id>
<title>Merino Wool Beanie, Charcoal</title>
<description>Soft 100% merino wool beanie, one size fits most, machine washable on cold.</description>
<link>https://shop.example.com/products/merino-beanie-charcoal</link>
<g:image_link>https://shop.example.com/img/beanie-charcoal.jpg</g:image_link>
<g:price>24.99 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:gtin>4006381333931</g:gtin>
<g:google_product_category>Apparel &amp; Accessories &gt; Clothing Accessories &gt; Hats</g:google_product_category>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1002</g:id>
<title>Merino Wool Beanie, Forest Green</title>
<link>https://shop.example.com/products/merino-beanie-green</link>
<g:image_link>https://shop.example.com/img/beanie-green.jpg</g:image_link>
<g:price>24.99 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:gtin>6291041500213</g:gtin>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1001</g:id>
<title>Merino Wool Scarf, Charcoal</title>
<description>Matching merino wool scarf, 180cm long, hand wash cold.</description>
<link>https://shop.example.com/products/merino-scarf-charcoal</link>
<g:image_link>https://shop.example.com/img/scarf-charcoal.jpg</g:image_link>
<g:price>32.00 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1004</g:id>
<title>Leather Belt, Brown</title>
<description>Full-grain leather belt with brushed brass buckle, sizes 30 to 42.</description>
<link>https://shop.example.com/products/leather-belt-brown</link>
<g:image_link>https://shop.example.com/img/belt-brown.jpg</g:image_link>
<g:price>-9.99 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1005</g:id>
<title>Canvas Tote Bag, Natural</title>
<description>Heavy 12oz canvas tote with interior pocket and reinforced handles.</description>
<link>https://shop.example.com/products/canvas-tote-natural</link>
<g:image_link>http://shop.example.com/img/tote-natural.jpg</g:image_link>
<g:price>18.50 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1006</g:id>
<title>Wool Blend Overcoat, Navy</title>
<description>Tailored wool blend overcoat, fully lined, welt pockets, size run 36 to 48.</description>
<link>https://shop.example.com/products/overcoat-navy</link>
<g:image_link>https://shop.example.com/img/overcoat-navy.jpg</g:image_link>
<g:price>189.00 USD</g:price>
<g:availability>Available</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1007</g:id>
<title>Ceramic Pour-Over Coffee Dripper</title>
<description>Hand-glazed ceramic pour-over dripper, fits standard size 02 filters.</description>
<link>https://shop.example.com/products/pour-over-dripper</link>
<g:image_link>https://shop.example.com/img/dripper.jpg</g:image_link>
<g:price>29.00 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:gtin>4006381333930</g:gtin>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1008</g:id>
<title>Stainless Steel Water Bottle, 750ml</title>
<description>Double-wall insulated stainless steel bottle, keeps drinks cold for 24 hours.</description>
<link>https://shop.example.com/products/water-bottle-750</link>
<g:image_link>https://shop.example.com/img/bottle-750.jpg</g:image_link>
<g:price>27.00 USD</g:price>
<g:sale_price>21.00 USD</g:sale_price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:item_group_id>bottle-group</g:item_group_id>
<g:size>750ml</g:size>
<g:color>Slate</g:color>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1009</g:id>
<title>Stainless Steel Water Bottle, 1L</title>
<description>Double-wall insulated stainless steel bottle, keeps drinks cold for 24 hours.</description>
<link>https://shop.example.com/products/water-bottle-1l</link>
<g:image_link>https://shop.example.com/img/bottle-1l.jpg</g:image_link>
<g:price>29.00 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:item_group_id>bottle-group</g:item_group_id>
<g:size>1L</g:size>
<g:color>Slate</g:color>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1010</g:id>
<title>Oak Cutting Board, Large</title>
<description>Solid oak end-grain cutting board, 45 x 30cm, food-safe mineral oil finish.</description>
<link>https://shop.example.com/products/oak-cutting-board</link>
<g:image_link>https://shop.example.com/img/cutting-board.jpg</g:image_link>
<g:price>54.00 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1011</g:id>
<title>Linen Throw Pillow Cover, Sand</title>
<description>Pre-washed European linen pillow cover, 45 x 45cm, hidden zip closure.</description>
<link>https://shop.example.com/products/linen-pillow-sand</link>
<g:image_link>https://shop.example.com/img/pillow-sand.jpg</g:image_link>
<g:price>22.00 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
<item>
<g:id>sku-1012</g:id>
<title>Cast Iron Skillet, 26cm</title>
<description>Pre-seasoned cast iron skillet, oven safe to 260C, works on induction.</description>
<link>https://shop.example.com/products/cast-iron-skillet-26</link>
<g:image_link>https://shop.example.com/img/skillet-26.jpg</g:image_link>
<g:price>39.00 USD</g:price>
<g:availability>in stock</g:availability>
<g:condition>new</g:condition>
<g:brand>Northline</g:brand>
<g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>4.99 USD</g:price></g:shipping>
</item>
</channel>
</rss>
`;

// Also expose as a plain browser global when loaded via <script type="module">.
if (typeof window !== 'undefined') {
  window.FeedDoctor = {
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
  };
}
