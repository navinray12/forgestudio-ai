# 12 — Editor Widget Catalogue (all 127 element types)

Source of truth: the `ElementType` union in `frontend/src/pages/editor/types/index.ts` (127 types).
Columns were computed mechanically (read-only script) from **files the app actually loads** (dead files excluded, see [11](11-ui-api-contract-and-dead-code.md)):

- **In palette** — listed in `ALL_WIDGET_REGISTRY` (`types/index.ts`). Basic widgets are also offered from the editor sidebar, so "—" here does not mean "cannot be inserted".
- **Has defaults** — `createDefaultElement` has a `case` for it (`pages/editor/defaults/index.ts`), i.e. it can be created.
- **Editor canvas** — an `el.type === "<type>"` / `case "<type>"` branch exists in `WebsiteEditor.tsx`, `widgets/renderers.tsx` or `navigation/NavigationRenderers.tsx`.
- **Inspector** — a settings panel branch exists (`selectedElement.type === "<type>"`).
- **Published site** — the type string appears in `pages/published/PublishedSite.tsx`. Its `RenderNode` ends with `return null` (line ~823) and has **no generic fallback**, so an unlisted type renders nothing at `/site/:id` and `/preview/site/:id`.
- **Static export** — the type appears in `pages/editor/utils/codeExporter.ts` (frontend HTML export). The backend `services/destinations/staticCompiler.ts` and `codeGenerator.service.ts` handle some additional types for ZIP/SFTP output (not tabulated).

Status meanings: **COMPLETE (unverified in browser)** = renders in editor and on published site (no browser test exists) · **BROKEN — disappears on published site** = user can build with it, it vanishes after publishing · **BROKEN — insertable but no renderer** · **PARTIAL** · **TYPE ONLY** = declared in the type union with no implementation.

## Summary

| Status | Count |
|---|---|
| COMPLETE (unverified in browser) | 82 |
| WORKS (structural: `container`, `div-block`) | 2 |
| BROKEN — disappears on published site | 21 |
| BROKEN — insertable but no renderer (`social-icons`) | 1 |
| PARTIAL — published only (`icon`) | 1 |
| TYPE ONLY — no implementation | 20 |
| **Total** | **127** |

Finding: PROD-10 in [08](08-verification-and-evidence-ledger.md). Notable broken ones a user is likely to use: `progress-bar`, `counter`, `rating`, `alert`, `google-maps`, `icon-box`, `image-box`, `icon-list`, `nested-tabs`, `nested-accordion`, `posts`, `portfolio`, `video-playlist`, `template`, `link-in-bio`, `menu-widget`, `off-canvas-nav`.
Verification still needed: a browser check (insert each widget → publish → open `/site/:id`) to confirm at runtime.

## Full table

| # | Widget type | In palette | Has defaults | Editor canvas | Inspector | Published site | Static export | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `acf-integration` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 2 | `alert` | — | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 3 | `animated-headline` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 4 | `audio-playlist` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 5 | `basic-gallery` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 6 | `basic-media-carousel` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 7 | `blockquote` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 8 | `breadcrumbs` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 9 | `button` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 10 | `call-to-action` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 11 | `code-highlight` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 12 | `container` | yes | yes | yes | yes | yes | yes | WORKS (structural) |
| 13 | `countdown` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 14 | `counter` | — | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 15 | `crm-integration` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 16 | `custom-svg` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 17 | `display-conditions` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 18 | `div-block` | — | — | — | — | yes | — | WORKS (structural) |
| 19 | `divider` | — | — | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 20 | `dynamic-data` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 21 | `dynamic-lightbox` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 22 | `facebook-button` | — | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 23 | `facebook-comments` | — | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 24 | `facebook-embed` | — | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 25 | `facebook-feed` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 26 | `facebook-integration` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 27 | `facebook-like-button` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 28 | `facebook-page` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 29 | `favorite-widgets` | yes | — | yes | — | — | — | BROKEN — disappears on published site |
| 30 | `flip-box` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 31 | `form` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 32 | `gallery` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 33 | `google-calendar` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 34 | `google-maps` | — | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 35 | `gutenberg-blocks` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 36 | `heading` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 37 | `html` | — | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 38 | `icon` | — | — | — | — | yes | yes | PARTIAL — published only |
| 39 | `icon-box` | — | — | yes | yes | — | — | BROKEN — disappears on published site |
| 40 | `icon-library` | yes | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 41 | `icon-list` | — | — | yes | yes | — | — | BROKEN — disappears on published site |
| 42 | `image` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 43 | `image-box` | — | — | yes | yes | — | — | BROKEN — disappears on published site |
| 44 | `image-carousel` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 45 | `import-asset` | yes | — | yes | — | — | — | BROKEN — disappears on published site |
| 46 | `link-in-bio` | — | — | yes | yes | — | — | BROKEN — disappears on published site |
| 47 | `lms-compat` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 48 | `login` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 49 | `loop-carousel` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 50 | `loop-grid` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 51 | `lottie` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 52 | `media-carousel` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 53 | `mega-menu` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 54 | `menu-anchor` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 55 | `menu-widget` | — | — | yes | — | — | — | BROKEN — disappears on published site |
| 56 | `multisite-support` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 57 | `nav-menu` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 58 | `nested-accordion` | — | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 59 | `nested-carousel` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 60 | `nested-tabs` | — | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 61 | `off-canvas` | yes | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 62 | `off-canvas-nav` | — | — | yes | — | — | — | BROKEN — disappears on published site |
| 63 | `paragraph` | — | — | — | — | — | yes | TYPE ONLY — no implementation |
| 64 | `paypal` | — | — | — | yes | — | — | TYPE ONLY — no implementation |
| 65 | `paypal-button` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 66 | `pods-integration` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 67 | `portfolio` | yes | yes | yes | yes | — | yes | BROKEN — disappears on published site |
| 68 | `post-nav` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 69 | `posts` | yes | yes | yes | yes | — | yes | BROKEN — disappears on published site |
| 70 | `price-list` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 71 | `price-table` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 72 | `progress-bar` | — | yes | yes | yes | — | yes | BROKEN — disappears on published site |
| 73 | `query-builder` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 74 | `rating` | — | yes | yes | yes | — | yes | BROKEN — disappears on published site |
| 75 | `reusable-components` | yes | — | yes | — | — | — | BROKEN — disappears on published site |
| 76 | `reviews` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 77 | `search-bar` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 78 | `search-form` | — | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 79 | `share-buttons` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 80 | `shortcode` | — | yes | yes | yes | yes | — | COMPLETE (unverified in browser) |
| 81 | `site-search` | — | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 82 | `slides` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 83 | `social-icons` | — | yes | — | — | — | yes | BROKEN — insertable but no renderer |
| 84 | `soundcloud` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 85 | `spacer` | — | — | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 86 | `stripe` | — | — | — | yes | — | — | TYPE ONLY — no implementation |
| 87 | `stripe-button` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 88 | `table-of-contents` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 89 | `taxonomy-filter` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 90 | `template` | yes | yes | yes | yes | — | — | BROKEN — disappears on published site |
| 91 | `testimonial-carousel` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 92 | `text` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 93 | `toolset-integration` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 94 | `video` | yes | yes | yes | yes | yes | yes | COMPLETE (unverified in browser) |
| 95 | `video-playlist` | yes | yes | yes | yes | — | yes | BROKEN — disappears on published site |
| 96 | `wc-add-to-cart` | yes | yes | yes | — | yes | — | COMPLETE (unverified in browser) |
| 97 | `wc-additional-info` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 98 | `wc-builder` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 99 | `wc-cart` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 100 | `wc-checkout` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 101 | `wc-custom-add-to-cart` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 102 | `wc-menu-cart` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 103 | `wc-my-account` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 104 | `wc-notices` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 105 | `wc-product` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 106 | `wc-product-addons` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 107 | `wc-product-archive` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 108 | `wc-product-archive-templates` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 109 | `wc-product-categories` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 110 | `wc-product-content` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 111 | `wc-product-data-tabs` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 112 | `wc-product-images` | yes | yes | yes | — | yes | — | COMPLETE (unverified in browser) |
| 113 | `wc-product-meta` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 114 | `wc-product-page-templates` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 115 | `wc-product-price` | yes | yes | yes | — | yes | — | COMPLETE (unverified in browser) |
| 116 | `wc-product-rating` | yes | yes | yes | — | yes | — | COMPLETE (unverified in browser) |
| 117 | `wc-product-stock` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 118 | `wc-product-title` | yes | yes | yes | — | yes | — | COMPLETE (unverified in browser) |
| 119 | `wc-products` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 120 | `wc-purchase-summary` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 121 | `wc-related-products` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 122 | `wc-shop-layouts` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 123 | `wc-short-description` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 124 | `wc-upsells` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |
| 125 | `webhook-integration` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 126 | `wordpress-shortcode` | — | — | — | — | — | — | TYPE ONLY — no implementation |
| 127 | `wp-menu` | yes | — | yes | — | yes | — | COMPLETE (unverified in browser) |