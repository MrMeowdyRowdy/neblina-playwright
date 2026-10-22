# neblina-playwright

End-to-end tests for [Neblina](https://github.com/MrMeowdyRowdy/smb-sites/tree/main/apps/restaurant), a demo café site (Next.js static export, Spanish and English), written with Playwright, TypeScript and Page Objects.

[![playwright](https://github.com/MrMeowdyRowdy/neblina-playwright/actions/workflows/playwright.yml/badge.svg)](https://github.com/MrMeowdyRowdy/neblina-playwright/actions/workflows/playwright.yml)
[Latest report](https://mrmeowdyrowdy.github.io/neblina-playwright/)

## What it tests

100 tests per browser profile, run on 3 profiles (300 runs): desktop Chromium, Pixel 7 (Chromium) and iPhone 14 (WebKit). Every test is tagged `@regression`; 34 of them are also `@smoke`.

| Area | File | Tests | What is checked |
|---|---|---|---|
| Cart and order | `cart.spec.ts` | 18 | empty state, add/remove/quantity, exact totals for a cart of every dish (integer cents), Spanish and English formats, sold-out dishes, the take away / eat here dialog, the `wa.me` message line by line for both options and both languages, new-tab link behaviour, persistence across reload and across languages, corrupt or stale `localStorage` |
| "Hoy en Neblina" | `today.spec.ts` | 19 | open / closed / opens-today / opens-tomorrow, exact open and close minutes, Sunday's shorter day, the live line, a visitor in Tokyo or Los Angeles still sees Quito time, no-JavaScript fallback, seasonal item date window. All with a pinned clock (`page.clock`) |
| Language | `language.spec.ts` | 19 | the switcher on all 8 pages, canonical and hreflang pairs (reciprocal, `x-default` = Spanish), titles and descriptions, every dish name and price in both languages |
| SEO | `seo.spec.ts` | 7 | `robots.txt`, `sitemap.xml` (every page once, alternates correct, every URL answers 200), JSON-LD against the content files, real 404 status |
| QR and quality pages | `pages.spec.ts` | 5 | QR image is labelled, square, scannable size, points at the menu; the quality report shows exactly the numbers in `content/quality.json` |
| Health and links | `links-and-health.spec.ts` | 17 | no console errors, failed requests or third-party requests on load; no horizontal scroll; every internal link returns 200 and every `#fragment` has a target; external `_blank` links carry `noopener` |
| Accessibility | `a11y.spec.ts` | 15 | axe (WCAG 2.1 AA) on 8 pages, plus states: cart filled, order dialog open, home open and closed; keyboard: skip link, Enter on a focused add button |

Two tests are `test.fixme` because they document a real defect in the app (see [docs/findings.md](docs/findings.md)).

## Design choices and why

- **Page Objects, small.** `MenuPage` and `HomePage` own the selectors (the app exposes `data-testid` hooks for the cart); specs read as behaviour.
- **The app's content files are the oracle.** Totals, messages, hours and JSON-LD are computed from `menu.json` / `site.json`, never hard-coded, so a price change does not break the suite and a wrong total does.
- **Time is controlled, not awaited.** `page.clock.setFixedTime` pins "now" to a Quito wall-clock time (UTC-5). Boundaries (the closing minute, the seasonal window's first and last day) are tested, not just mid-day cases.
- **Deeper than the app's own smoke tests.** Neblina ships 22 end-to-end checks of its own; this suite does not repeat them but goes into the cart arithmetic, the message format, time logic, edge data and mobile.
- **Three profiles, WebKit included.** Mobile layouts and Safari are where static sites break; the same specs run on all three.
- **No pixel snapshots.** Screenshot baselines depend on OS and font rendering and flake between a laptop and CI. The suite asserts structure, text, geometry and axe instead.
- **Retries only in CI** (2). Locally a flaky test should fail loudly. Trace and screenshot are kept on failure; `workers: 2` keeps a small machine safe.
- **axe runs with reduced motion.** The app's GSAP reveals fade content in; axe sampling a half-faded element reports false contrast failures. The app honours `prefers-reduced-motion`, so the final state is what is scanned.
- **Decoupled from the build.** The suite serves the built `out/` folder, or tests any deployed copy with `BASE_URL`. See [docs/test-strategy.md](docs/test-strategy.md) for scope and risks.

## Run it

Prerequisites: Node 20.19+, a built Neblina (clone [smb-sites](https://github.com/MrMeowdyRowdy/smb-sites) next to this repo and run `npm ci && npm run build -w apps/restaurant` in it).

```bash
npm ci
npx playwright install --with-deps chromium webkit
npx playwright test                      # everything, 3 profiles
npx playwright test --grep @smoke        # smoke only
npx playwright test --project=mobile-safari
npx playwright show-report
```

| Variable | Default | Meaning |
|---|---|---|
| `NEBLINA_APP` | `../smb-sites/apps/restaurant` | the app folder: `out/` is served, `content/` is the oracle |
| `BASE_URL` | unset | test a deployed site instead of serving `out/` (content is still read from `NEBLINA_APP`) |

## CI

`.github/workflows/playwright.yml` runs on push and pull request to `main`, nightly at 06:00 UTC, and on manual dispatch (with an optional `base_url`). It checks out this repo and `smb-sites`, builds the restaurant app, type-checks, installs Chromium and WebKit with system dependencies, runs the suite, uploads the HTML report as an artifact (traces and screenshots of failures too) and, on `main`, publishes the report to GitHub Pages.

## Findings

Four things the suite found or had to work around in Neblina; details in [docs/findings.md](docs/findings.md).

1. The build bakes `http://localhost:3000` into canonical, hreflang, sitemap and robots unless `NEXT_PUBLIC_SITE_URL` is set; a test guards the deployed site.
2. The order bar says "1 productos" / "1 items" (`test.fixme`).
3. On phones, decorative category lettering fails axe contrast (1.2:1); the app's own axe run is desktop only.
4. The tall home page re-lays out while loading; a click on its footer language link right after `load` can miss in WebKit.
