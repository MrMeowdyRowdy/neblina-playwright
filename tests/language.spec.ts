import { expect, test } from '@playwright/test';
import { menu, usd, cents } from './support/content';
import { routes } from './support/routes';

const pairs = routes.flatMap((r) => [
  { id: r.id, from: r.es, to: r.en, lang: 'es', toLang: 'en', label: 'Idioma' },
  { id: r.id, from: r.en, to: r.es, lang: 'en', toLang: 'es', label: 'Language' },
]);
const pathOf = (href: string | null) => new URL(href!, 'http://x').pathname;

test.describe('language switcher', () => {
  for (const p of pairs) {
    test(`${p.from} -> ${p.to} @smoke @regression`, async ({ page }) => {
      // networkidle: the tall home page re-lays out while images and the scroll pin settle, and a click during that lands on the wrong spot in WebKit.
      await page.goto(p.from, { waitUntil: 'networkidle' });
      const link = page.getByRole('navigation', { name: p.label }).getByRole('link');
      await expect(link).toHaveAttribute('href', p.to);
      await expect(link).toHaveAttribute('hreflang', p.toLang);
      await link.click();
      await expect(page).toHaveURL(p.to);
      await expect(page.locator('html')).toHaveAttribute('lang', p.toLang);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }
});

test.describe('hreflang and canonical', () => {
  for (const p of pairs) {
    test(`${p.from} declares itself canonical and points to its pair @regression`, async ({ page }) => {
      await page.goto(p.from);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(pathOf(canonical)).toBe(p.from);

      const alt = async (lang: string) => pathOf(await page.locator(`link[rel="alternate"][hreflang="${lang}"]`).getAttribute('href'));
      const es = routes.find((r) => r.id === p.id)!.es;
      expect(await alt(p.lang)).toBe(p.from);
      expect(await alt(p.toLang)).toBe(p.to);
      expect(await alt('x-default')).toBe(es); // Spanish is the default language
    });
  }

  test('each page has its own title and description in its language @regression', async ({ page }) => {
    const seen = new Set<string>();
    for (const p of pairs) {
      await page.goto(p.from);
      const title = await page.title();
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(title.length).toBeGreaterThan(5);
      expect(desc!.length).toBeGreaterThan(30);
      expect(seen.has(title), `duplicate title "${title}"`).toBe(false);
      seen.add(title);
    }
  });
});

test.describe('menu content per language', () => {
  for (const locale of ['es', 'en'] as const) {
    test(`${locale}: every dish shows its ${locale} name and locale-formatted price @regression`, async ({ page }) => {
      await page.goto(routes[1][locale]);
      await expect(page.locator('[data-dish]')).toHaveCount(menu.items.length);
      for (const it of menu.items) {
        const dish = page.locator('[data-dish]').filter({ has: page.getByRole('heading', { name: it.name[locale], exact: true }) });
        await expect(dish, it.id).toHaveCount(1);
        await expect(dish.locator('.dish-price')).toHaveText(usd(cents(it.price), locale));
      }
      for (const c of menu.categories) await expect(page.getByRole('heading', { level: 2, name: c.name[locale] })).toBeVisible();
    });
  }
});
