# Sweeter Mundane Studio — Website

A static storefront for the Sweeter Mundane Studio Etsy shop, styled after the
Stereoscope Coffee reference (`stereoscopecoffee.com/shop/coffee`).

Open `index.html` in a browser, or serve the folder:

```bash
cd /Volumes/Wei/yigewang/Documents/0-Biz/Website
python3 -m http.server 8899
# then open http://127.0.0.1:8899/index.html
```

No build step. No dependencies. Works from `file://` or any static host
(GitHub Pages, Netlify, Cloudflare Pages, S3).

---

## What's here

```
index.html              shop page — hero, category filter, product grid, editorial
product.html            product detail — gallery, options, qty, add to bag
assets/
  css/site.css          the whole design system
  js/site.js            catalogue render, filters, product page, bag
  fonts/                Brunswick Grotesque Regular (woff2 + woff)
  hero.jpg              wide hero band (Fluid Purse, 1400×781)
  feature-*.jpg         editorial sections
  products/*.jpg        99 product images, max 1200px, q76
data/
  products.js           the storefront catalog (window.SMS_PRODUCTS)
  products.json         same data, pretty-printed
  catalog.json          raw Etsy API dump (source of truth)
data/../build scripts   see "Refreshing" below
```

---

## Design system

Lifted directly from the reference site so the two read as siblings:

| Token | Value | Source |
|---|---|---|
| Type | Brunswick Grotesque, 400 | reference `@font-face` (self-hosted here) |
| Ink | `#1d1d1b` | reference `--color-black` |
| Gray | `#f3f3f3` | reference `--color-gray-20` |
| Muted | `#6c6c6c` | reference `--color-gray-90` |
| Nav panels | `rgba(243,243,243,0.75)` + `backdrop-blur(12px)` | reference header |
| Grid | 3 columns, hairline black borders, `bg-gray-20` cards | reference product grid |
| Card media | `aspect-ratio: 3/4`, `object-fit: cover` | reference `aspect-[3/4]` |
| Card hover | 32px plus glyph fades in | reference `group-hover:block` |
| Category list | 20px/500 uppercase, active `opacity 1`, inactive `opacity 0.5` | reference filter rail |
| Prices | `FROM $32.11` when a listing has a range | reference price style |

The reference uses only one font weight, so the site does too — hierarchy comes
from size, opacity and rules rather than bold.

---

## Products

All 21 active Etsy listings, pulled live from the Etsy v3 API:

- **7 Pet Busts** — English Bulldog, Golden Retriever, Doberman, Poodle,
  Golden Doodle, German Shepherd, French Bulldog
- **3 Zen Yoga Meditating Pets** — English Bulldog, Pug, French Bulldog
- **4 Soundwave Art** — XL Sound of Love, Sound of Love, two framed versions
- **2 Map Arts** — Downtown Houston, New York City
- **2 Unique Purses** — The Halo Purse, The Fluid Purse
- **3 Design Objects** — The Miracle of Life, Coral Form, Jewelry Trinket Tray

Per-product data includes: real price and price range, every live variant with
its option names and values, stock availability per variant, description,
tags, materials, personalisation flags, and the Etsy listing URL.

Variants come from Etsy's `inventory.products[]` — each product is one
variant, its `property_values` give the option names/values, and its
`offerings` carry the real price and stock. An option that is out of stock
renders struck through and cannot be selected.

---

## Checkout

The bag is real and works — add, quantity, remove, persists in `localStorage`
across reloads. **Checkout hands off to Etsy**, where shipping and
personalisation are handled, because this build has no payment processor
wired up. The `Buy on Etsy` button on each product goes straight to the
listing.

To take payments on-site instead, the locked Phase 2 spec in
`../E Commerce Store/specs/phase-2-schema-and-api.md` covers Stripe,
Shippo, the Prisma schema, and the admin app. The `data/products.json` shape
maps onto `Product` + `ProductVariant` + `ProductMedia` — `id` is the Etsy
listing id and maps to `etsyListingId`.

---

## Refreshing

The catalog is rebuilt from Etsy with three scripts in
`~/.hermes/scripts/`. Run them in order:

```bash
PY=/Volumes/Wei/yigewang/.hermes/hermes-agent/venv/bin/python

# 1. pull listings + images + inventory from Etsy -> data/catalog.json
$PY ~/.hermes/scripts/etsy_fetch_catalog.py \
    /Volumes/Wei/yigewang/Documents/0-Biz/Website/data/catalog.json

# 2. normalise into the storefront model + download/resize images
$PY ~/.hermes/scripts/build_site_catalog.py

# 3. emit data/products.js and copy the hero/feature images
$PY ~/.hermes/scripts/build_site_data.py
```

The Etsy OAuth token in `~/.etsy-secrets/` expires hourly; the scripts
refresh it on a 401 and persist the rotated refresh token.

If you add or replace products by hand, also update the hard-coded category
counts in `index.html` — they are written as literal text to match the
reference's `COFFEE (9)` style.

---

## Notes and known limits

- **The hero and the two editorial images are pulled from existing listing
  photography.** The hero (`Fluid Purse`, a wide marble still life) is the only
  landscape image in the catalogue, so the site has one hero; a dedicated
  studio shot would suit better.
- **Some listing photos have baked-in text** ("I Love You" waveforms, a
  "Fluid Purse" title). They are correct for those products but are not used
  in the hero.
- **Image quality is uneven** — it is marketplace photography, so backgrounds,
  lighting and resolution vary between shots. A dedicated photo set would
  make the grid look more consistent.
- **The newsletter form is non-functional.** It shows a "Subscribed" state
  but posts nowhere.
- **No product has a live "sold out" state yet**, because every current
  listing has stock. The card and the product page handle it if that changes.
