import { expect, test } from '@playwright/test';
import { menu, site } from './support/content';
import { allPaths, routes } from './support/routes';

const pathOf = (u: string) => new URL(u).pathname;

test.describe('sitemap.xml and robots.txt', () => {
  test('robots allows crawling and names the sitemap @smoke @regression', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/^Allow: \/$/m);
    expect(body).not.toMatch(/^Disallow: \/\s*$/m);
    expect(body).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  test('sitemap lists every page once, each with es / en / x-default alternates @smoke @regression', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const xml = await res.text();

    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
    const locs = urls.map((u) => pathOf(u.match(/<loc>(.*?)<\/loc>/)![1]));
    expect([...locs].sort()).toEqual([...allPaths].sort()); // no page missing, none twice, none extra

    for (const u of urls) {
      const loc = pathOf(u.match(/<loc>(.*?)<\/loc>/)![1]);
      const route = routes.find((r) => r.es === loc || r.en === loc)!;
      const alt = (lang: string) => pathOf(u.match(new RegExp(`hreflang="${lang}" href="([^"]+)"`))![1]);
      expect(alt('es'), loc).toBe(route.es);
      expect(alt('en'), loc).toBe(route.en);
      expect(alt('x-default'), loc).toBe(route.es);
    }
  });

  test('every sitemap URL answers 200 on this host @regression', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const m of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
      const res = await request.get(pathOf(m[1]));
      expect(res.status(), m[1]).toBe(200);
    }
  });
});

test.describe('absolute URLs', () => {
  test('canonical, hreflang and sitemap point at the host under test, not localhost @regression', async ({ page, request, baseURL }) => {
    test.skip(!process.env.BASE_URL, 'only meaningful against a deployed site (BASE_URL); the local build is made without NEXT_PUBLIC_SITE_URL, see docs/findings.md #1');
    const origin = new URL(baseURL!).origin;
    await page.goto('/menu/');
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(`${origin}/menu/`);
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).not.toContain('localhost');
    expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });
});

test.describe('structured data', () => {
  for (const [locale, path] of [['es', '/'], ['en', '/en/']] as const) {
    test(`${locale}: JSON-LD matches the content files @regression`, async ({ page }) => {
      await page.goto(path);
      const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
      expect(ld['@type']).toBe('CafeOrCoffeeShop');
      expect(ld.name).toBe(site.name);
      expect(ld.telephone).toBe(`+${site.whatsapp}`);
      expect(ld.openingHoursSpecification).toHaveLength(site.hours.length);
      for (const [i, h] of site.hours.entries()) {
        expect(ld.openingHoursSpecification[i]).toMatchObject({ dayOfWeek: h.days, opens: h.opens, closes: h.closes });
      }
      const sections = ld.hasMenu.hasMenuSection;
      expect(sections.map((s: { name: string }) => s.name)).toEqual(menu.categories.map((c) => c.name[locale]));
      const offers = sections.flatMap((s: { hasMenuItem: unknown[] }) => s.hasMenuItem);
      expect(offers).toHaveLength(menu.items.length);
      expect(offers.every((o: { offers: { priceCurrency: string } }) => o.offers.priceCurrency === 'USD')).toBe(true);
    });
  }
});

test.describe('unknown routes', () => {
  test('an unknown path returns a real 404 page, not a soft 200 @regression', async ({ request }) => {
    const res = await request.get('/no-such-page/');
    expect(res.status()).toBe(404);
  });
});
