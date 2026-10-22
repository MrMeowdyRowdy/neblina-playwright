# Test strategy

## Scope
System under test: Neblina, a fictional Quito café (`smb-sites/apps/restaurant`), a statically exported Next.js site in Spanish and English with a client-side cart that hands the order to WhatsApp. There is no server, no payment and no account: all behaviour is in the browser or in static files.

In scope, by risk:

| Risk | Why it matters | Covered by |
|---|---|---|
| Wrong total or wrong order message | the only transaction the site has; the café reads the message to prepare the order | `cart.spec.ts` |
| Wrong open/closed text | the first thing a visitor reads; depends on the Quito time zone, not the visitor's | `today.spec.ts` |
| Language pairs broken | duplicate or orphaned pages hurt search and visitors | `language.spec.ts`, `seo.spec.ts` |
| Not discoverable | missing sitemap entries, wrong canonicals, bad JSON-LD | `seo.spec.ts` |
| Not usable by everyone | contrast, labels, keyboard, dialog state | `a11y.spec.ts` |
| Broken on phones or Safari | most visitors are on phones | all specs on three profiles, plus the layout check |
| Dead links, console errors, third-party calls | privacy promise and basic polish | `links-and-health.spec.ts` |

## Approach
- UI-level end-to-end tests with Playwright against the built static site. Content files are the oracle for expected values.
- A cart state is created through the UI; only "bad stored data" tests write `localStorage` directly, because that is the only way to reach states the UI cannot produce.
- Time-dependent behaviour is pinned with `page.clock`, including edge minutes and time zones.
- Tags: `@smoke` (34 fast, high-value checks for every push) and `@regression` (all 100). Both run in CI today; the tags exist so a slower future suite can split them.

## Not tested, and why
- **Pixel-level visual regression.** OS- and font-dependent, flaky across machines; structure and axe cover the same risk more reliably.
- **Performance and Lighthouse.** Neblina's own CI runs Lighthouse and publishes the numbers on its quality page; this suite only checks that page renders them faithfully. Load testing a static file server proves little (load testing lives in [k6-test](https://github.com/MrMeowdyRowdy/k6-test)).
- **WhatsApp itself.** Clicking an order link is stubbed (`context.route`); the contract is the link, not wa.me.
- **Maps, photos and animation art.** Decorative; the motion layer is exercised only so far as it must not hide content or break axe.
- **Firefox and desktop Safari.** Chromium (desktop and Pixel) and WebKit (iPhone) cover both engines that matter for the audience; adding desktop WebKit or Firefox is a config line if needed.
- **Real device time zones and DST.** Quito has no DST; other zones are emulated, not exhaustively enumerated.
- **The live site's TLS, headers and caching.** Not deployed yet; the suite already accepts `BASE_URL` for when it is.

## Known limits
- Spanish message text (`Hola, quisiera hacer este pedido:`) and some UI strings are written into the tests as the specification of the app's copy. A copy change is a deliberate test update.
- The local build uses whatever `out/` holds; the suite does not rebuild it. CI always builds from `main`.
