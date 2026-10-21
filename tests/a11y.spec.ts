import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';
import { allPaths } from './support/routes';

// Contrast is measured on final states: the app's GSAP reveals are skipped under reduced motion, so axe never samples a half-faded element.
test.use({ reducedMotion: 'reduce' });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// .cat-art-m is aria-hidden decorative category lettering shown on phones only (see docs/findings.md); axe flags its pale contrast although WCAG 1.4.3 exempts pure decoration.
const scan = async (page: Page) => (await new AxeBuilder({ page }).withTags(TAGS).exclude('.cat-art-m').analyze()).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`);

test.describe('axe, WCAG 2.1 AA', () => {
  for (const p of allPaths) {
    test(`${p} @regression`, async ({ page }) => {
      await page.goto(p);
      expect(await scan(page)).toEqual([]);
    });
  }

  for (const locale of ['es', 'en'] as const) {
    test(`${locale} menu with items in the cart @regression`, async ({ page }) => {
      const m = new MenuPage(page, locale);
      await m.goto();
      await m.addItem('espresso', 2);
      await m.addItem('humita');
      expect(await scan(page)).toEqual([]);
    });

    test(`${locale} menu with the take away / eat here dialog open @smoke @regression`, async ({ page }) => {
      const m = new MenuPage(page, locale);
      await m.goto();
      await m.addItem('espresso');
      await m.orderButton.click();
      await expect(m.takeawayLink).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }

  test('home page at night (closed state) and by day (open state) @regression', async ({ page }) => {
    for (const when of ['2026-10-21T10:00:20-05:00', '2026-10-21T22:00:20-05:00']) {
      await page.clock.setFixedTime(new Date(when));
      const home = new HomePage(page);
      await home.goto();
      await expect(home.status).not.toBeEmpty();
      expect(await scan(page), when).toEqual([]);
    }
  });
});

test.describe('keyboard', () => {
  test('the skip link is the first stop and moves focus to main content @regression', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile, 'no keyboard on touch profiles');
    test.skip(browserName === 'webkit', 'Safari does not Tab to links by default');
    await page.goto('/menu/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('a dish can be added with the keyboard alone @regression', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile || browserName === 'webkit', 'keyboard Tab flow is desktop Chromium/Firefox behavior');
    const m = new MenuPage(page);
    await m.goto();
    await m.add('espresso').focus();
    await page.keyboard.press('Enter');
    await expect(m.qty('espresso')).toHaveText('1');
    await expect(m.total).not.toHaveText('$0,00');
  });
});
