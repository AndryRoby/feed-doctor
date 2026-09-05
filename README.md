# Product Feed Doctor

A free tool that finds what is wrong with a shopping/product feed before Google, Meta, or a shopping assistant does.

Live: https://arling.sk/feed-doctor/

Paste a feed URL and click Fetch, paste the feed content directly, or upload the downloaded file. The tool detects the format, parses it, normalizes every row to one product shape, and runs 31 rules against it: missing required fields, duplicate ids, price and link formatting, GTIN checksum validity, availability and condition values, and more. Everything runs in the browser; nothing is uploaded.

## Supported formats

- Google Shopping / Merchant Center RSS 2.0 (the `g:` namespace, with or without an `atom:link` tag)
- Facebook/Meta catalog CSV
- Shopify `/products.json`
- WooCommerce Store API JSON
- Generic XML with repeating `<item>` elements
- Generic CSV with a header row

## What it checks

Each check is a `code` `feed-doctor.js`'s `analyze()` can return, with a `severity` (`error`, `warning`, `info`):

- `missing_id`, `missing_title`, `missing_description`, `missing_link`, `missing_image_link`, `missing_price`, `missing_availability`: a required Merchant Center attribute is absent or blank.
- `missing_condition_used`: the title/description reads as used/refurbished but `condition` is not set. `invalid_condition`: `condition` is set to something other than `new`/`refurbished`/`used`.
- `duplicate_id`: the same `id` is reused. `duplicate_titles`: more than three items share the exact same `title`.
- `title_too_long` (>150 chars), `title_all_caps`.
- `description_too_short` (<50 chars), `description_has_html`.
- `price_not_numeric`, `price_missing_currency`, `price_negative`, `sale_price_gte_price`.
- `link_invalid`, `link_not_https`, `image_link_invalid`, `image_link_not_https`, `image_link_missing_extension` (info).
- `availability_invalid` (outside `in stock`/`out of stock`/`preorder`/`backorder`).
- `gtin_checksum_invalid` (GS1 mod-10 check digit, GTIN-8/12/13/14).
- `missing_brand` (blank while `gtin`/`mpn` is set), `item_group_variant_missing_attrs` (`item_group_id` used without `size`/`color`), `shipping_missing` (info).
- `non_utf8_chars`, `whitespace_only_value`.

The full, generated-from-source rule table is on the page itself under "What it checks".

## What it does not do

- It does not call your shop's backend, submit anything to Google or Meta, or "fix" your feed for you. It only reports what is wrong and how to fix it.
- It does not proxy feed URLs. If it fetches a URL you paste, your own browser makes that request directly; there is no server in between.
- It does not send, store, or log your feed content anywhere.

## How it works

Static HTML plus one dependency-free JavaScript file, `feed-doctor.js`. The page calls a single pure function, `analyze(feedText)`, entirely in your browser:

```js
import { analyze } from './feed-doctor.js';

const report = analyze(feedText);
// report.format, report.productCount, report.score, report.counts,
// report.rules (all 31, with counts), report.problems (triggered only),
// report.issues (first 200, flattened), report.truncated
```

## Run locally

No build step, no dependencies.

```bash
git clone https://github.com/AndryRoby/feed-doctor.git
cd feed-doctor
python -m http.server
# or just open index.html directly in a browser
```

## Tests

```bash
node tests.mjs
```

288 assertions, 288 passed, 0 failed as of this writing, covering every parser (Google RSS, generic XML, generic/Facebook CSV, Shopify JSON, WooCommerce JSON) and every rule.

## Privacy

Everything runs client-side; nothing you paste or upload is sent anywhere, ever. If you paste a feed URL and click Fetch, your browser fetches it directly (most platforms block this via CORS, in which case paste or upload instead). Product analytics (page views, "analyze" clicked, with format/score/count only) go to a self-hosted Umami instance with no cookies and no personal data. Joining the "tell me about new tools" email list is entirely optional and separate from using the tool. Full policy: https://arling.sk/privacy/.

## Sources

Field names and required-ness are drawn from Google's Merchant Center product data specification (https://support.google.com/merchants/answer/7052112), cited by attribute name only. The GTIN check is the standard GS1 mod-10 check-digit calculation for GTIN-8/12/13/14. This tool is not affiliated with or endorsed by Google, Meta, Shopify, or Automattic/WooCommerce.

## Report a problem

Found a real feed this tool gets wrong, or a check that flags something that's actually fine? Open an issue: https://github.com/AndryRoby/feed-doctor/issues, or write to andrej@arling.sk. Please redact anything sensitive (API keys, internal URLs) before posting; issues are public.

## License

All rights reserved, see [LICENSE-NOTICE.md](LICENSE-NOTICE.md). Reading the source and learning from it is fine; deploying your own copy of it as a competing product is not.

---

ARLing s. r. o., Bratislava, Slovakia. andrej@arling.sk

Hub (more free tools): https://arling.sk/

Built for: ARLing Asistent, a shopping assistant built from your product feed: https://arling.sk/asistent/
