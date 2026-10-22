# Findings

Things the suite found in Neblina, or had to be designed around. Nothing here was fixed in the app (it is a separate repo); defects are `test.fixme` with a reason.

## 1. Build bakes `http://localhost:3000` into every absolute URL
`siteUrl` falls back to `http://localhost:3000` when `NEXT_PUBLIC_SITE_URL` is unset at build time. In the build used for these runs, canonical, hreflang, `sitemap.xml`, the `Sitemap:` line of `robots.txt` and the URL printed under the QR code all carry that origin. Fine for a local build, harmful if such a build were ever deployed. The local suite compares paths only (so it is green on any origin); `seo.spec.ts` has a check that runs when `BASE_URL` is set and fails if the deployed site still points at localhost.

## 2. "1 productos" / "1 items"
The order bar uses a single plural string (`{n} productos`, `{n} items`), so one dish reads "1 productos". Two `test.fixme` tests (es, en) in `cart.spec.ts` assert the singular and will start running when the copy is fixed (remove the `fixme` line).

## 3. Phone layout: decorative category lettering fails axe contrast
On phone-width viewports each menu category shows large pale lettering (`.cat-art-m`, `aria-hidden`). axe reports colour-contrast 1.2:1 on it for `/menu/` and `/en/menu/`. It is purely decorative, which WCAG 1.4.3 exempts, so the suite excludes that selector; but the app's own axe run (desktop Chromium only) never sees it, and its quality page claims "no violations" for the menu. A scan with a mobile profile finds it.

## 4. Home page layout shifts while loading (WebKit, iPhone profile)
The home page is about 7,200 px tall on an iPhone 14 viewport and re-lays out while images and the scroll pin settle. A click on the footer language link right after `load` landed in the wrong place in WebKit in several early runs (the page scrolled to the bottom but did not navigate). Waiting for `networkidle` before clicking removed it (32 passes afterwards: 8 pages x 4 repeats). Not proven to be a user-facing bug, but a fast tap on a slow phone could behave the same way.

## 5. Notes on the tooling (not app defects)
- axe sampling during the GSAP reveal reports false contrast failures. The suite scans with reduced motion, which the app honours.
- `page.clock.install()` + `runFor()` left the home status blank in WebKit. The live-update test pins the clock with `setFixedTime` and lets the page's own 15 s poll notice instead; it takes about 15 s per profile.
- Keyboard tests are skipped on touch profiles; the skip-link test, which relies on Tab reaching links, is also skipped on WebKit (Safari does not Tab to links by default).

## 6. Things checked that were fine
No console errors, failed requests or third-party requests on any of the 8 pages; every internal link and `#fragment` resolves; sitemap lists each page once with correct alternates; JSON-LD matches the content files; corrupt `localStorage` falls back to an empty cart; stale or sold-out IDs in a stored cart are ignored.
