import { expect, test } from '@playwright/test';
import { MenuPage } from './pages/MenuPage';
import { quality, type Quality } from './support/content';
import { routes } from './support/routes';

test.describe('QR menu page', () => {
  for (const locale of ['es', 'en'] as const) {
    const copy = locale === 'es'
      ? { h1: 'Menú con código QR', alt: 'Código QR que lleva al menú', menu: '/menu/' }
      : { h1: 'QR menu', alt: 'QR code leading to the menu', menu: '/en/menu/' };

    test(`${locale}: renders a labelled QR image that points at the menu @smoke @regression`, async ({ page }) => {
      await page.goto(routes[2][locale]);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.h1);
      const qr = page.getByRole('img', { name: copy.alt });
      await expect(qr).toBeVisible();
      const box = await qr.locator('svg').boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(150); // scannable size
      expect(Math.abs(box!.width - box!.height)).toBeLessThan(2); // QR codes are square
      expect(await qr.locator('svg path').count()).toBeGreaterThan(0);
      // The URL printed under the code is the one encoded for the menu in this language.
      const printed = page.locator('.qr-sheet p', { hasText: /^https?:\/\// });
      expect(new URL((await printed.textContent())!).pathname).toBe(copy.menu);
    });
  }

  test('the menu links to its printable QR page in both languages @regression', async ({ page }) => {
    for (const locale of ['es', 'en'] as const) {
      const m = new MenuPage(page, locale);
      await m.goto();
      await m.qrLink.click();
      await expect(page).toHaveURL(routes[2][locale]);
    }
  });
});

test.describe('Quality report page', () => {
  for (const locale of ['es', 'en'] as const) {
    test(`${locale}: sections render and the numbers equal content/quality.json @smoke @regression`, async ({ page }) => {
      await page.goto(routes[3][locale]);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'es' ? 'Informe de calidad' : 'Quality report');
      // Always present, with or without a generated report.
      await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
      await expect(page.locator('main section')).not.toHaveCount(0);

      if (!quality.generated) {
        await expect(page.locator('table')).toHaveCount(0); // before the first CI run the tables are omitted
        return;
      }
      const { unit, e2e, axe, lighthouse } = quality as Required<Quality>;
      await expect(page.locator('main')).toContainText(`${unit.passed}/${unit.total}`);
      await expect(page.locator('main')).toContainText(`${e2e.passed}/${e2e.total}`);

      const lhRows = page.locator('table').first().locator('tbody tr');
      await expect(lhRows).toHaveCount(lighthouse.length);
      for (const [i, r] of lighthouse.entries()) {
        const cells = lhRows.nth(i).locator('th, td');
        await expect(cells).toHaveText([r.path, ...[r.performance, r.accessibility, r.bestPractices, r.seo].map((v) => String(Math.round(v * 100))), String(Math.round(r.lcp))]);
      }
      await expect(page.locator('table').nth(1).locator('tbody tr')).toHaveCount(axe.length);
      await expect(page.locator('table th:not([scope])')).toHaveCount(0); // every header cell is scoped for screen readers
    });
  }
});
