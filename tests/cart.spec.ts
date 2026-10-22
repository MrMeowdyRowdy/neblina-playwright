import { expect, test } from '@playwright/test';
import { MenuPage } from './pages/MenuPage';
import { available, cents, item, menu, site, usd } from './support/content';

const intro = { es: 'Hola, quisiera hacer este pedido:', en: 'Hello, I would like to place this order:' };
const mode = {
  es: { takeaway: 'Para llevar', here: 'Para comer aquí' },
  en: { takeaway: 'To take away', here: 'To eat here' },
} as const;

test.describe('cart basics', () => {
  test('empty cart: zero total, disabled order button, no quantities @smoke @regression', async ({ page }) => {
    const m = new MenuPage(page);
    await m.goto();
    await expect(m.orderBar).toContainText('Aún no has agregado nada.');
    await expect(m.total).toHaveText('$0,00');
    await expect(m.orderButton).toBeDisabled();
    await expect(page.locator('[data-testid^="qty-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="remove-"]')).toHaveCount(0);
  });

  test('add, add again, remove: quantity and total follow @smoke @regression', async ({ page }) => {
    const m = new MenuPage(page);
    await m.goto();
    const p = cents(item('cafe-pasado').price);

    await m.addItem('cafe-pasado');
    await expect(m.qty('cafe-pasado')).toHaveText('1');
    await expect(m.total).toHaveText(usd(p, 'es'));
    await expect(m.orderButton).toBeEnabled();

    await m.addItem('cafe-pasado');
    await expect(m.qty('cafe-pasado')).toHaveText('2');
    await expect(m.total).toHaveText(usd(2 * p, 'es'));

    await m.remove('cafe-pasado').click();
    await expect(m.qty('cafe-pasado')).toHaveText('1');
    await expect(m.total).toHaveText(usd(p, 'es'));
  });

  for (const [locale, wrong, right] of [['es', '1 productos', '1 producto'], ['en', '1 items', '1 item']] as const) {
    test(`${locale}: one unit reads "${right}", not "${wrong}" @regression`, async ({ page }) => {
      test.fixme(true, 'Finding: the order bar always uses the plural ("{n} productos" / "{n} items"). See docs/findings.md #2.');
      const m = new MenuPage(page, locale);
      await m.goto();
      await m.addItem('espresso');
      await expect(m.orderBar).toContainText(right);
      await expect(m.orderBar).not.toContainText(wrong);
    });
  }

  test('removing the last unit clears the line and disables ordering @regression', async ({ page }) => {
    const m = new MenuPage(page);
    await m.goto();
    await m.addItem('humita');
    await m.remove('humita').click();
    await expect(m.qty('humita')).toHaveCount(0);
    await expect(m.remove('humita')).toHaveCount(0);
    await expect(m.total).toHaveText('$0,00');
    await expect(m.orderButton).toBeDisabled();
  });

  test('total is exact for a mixed cart of every available item @regression', async ({ page }) => {
    test.slow(); // dozens of clicks in one test; WebKit on CI runners needs >30 s
    const m = new MenuPage(page);
    await m.goto();
    let expected = 0;
    let units = 0;
    for (const [i, it] of available.entries()) {
      const qty = (i % 3) + 1; // 1, 2 or 3 of each, so rounding errors have room to show up
      await m.addItem(it.id, qty);
      expected += qty * cents(it.price);
      units += qty;
    }
    await expect(m.total).toHaveText(usd(expected, 'es'));
    await expect(m.orderBar).toContainText(`${units} productos`);
  });

  test('English menu formats the total with a decimal point and counts "items" @regression', async ({ page }) => {
    const m = new MenuPage(page, 'en');
    await m.goto();
    await m.addItem('capuchino', 2);
    await expect(m.total).toHaveText(usd(2 * cents(item('capuchino').price), 'en'));
    await expect(m.orderBar).toContainText('2 items');
  });

  test('sold-out dishes offer no add button @regression', async ({ page }) => {
    const soldOut = menu.items.filter((i) => !i.available);
    test.skip(soldOut.length === 0, 'no sold-out dish in the current menu data');
    const m = new MenuPage(page);
    await m.goto();
    for (const it of soldOut) {
      await expect(m.add(it.id)).toHaveCount(0);
      await expect(m.dishes.filter({ hasText: it.name.es })).toContainText('Agotado');
    }
  });
});

test.describe('order dialog and WhatsApp message', () => {
  test('asks take away or eat here, and can go back without losing the cart @smoke @regression', async ({ page }) => {
    const m = new MenuPage(page);
    await m.goto();
    await m.addItem('espresso');
    await m.orderButton.click();
    await expect(page.getByText('¿Para llevar o aquí?')).toBeVisible();
    await expect(m.takeawayLink).toBeVisible();
    await expect(m.hereLink).toBeVisible();
    await expect(m.orderButton).toHaveCount(0);

    await page.getByRole('button', { name: 'Volver al pedido' }).click();
    await expect(m.orderButton).toBeVisible();
    await expect(m.qty('espresso')).toHaveText('1');
  });

  for (const locale of ['es', 'en'] as const) {
    for (const link of ['takeaway', 'here'] as const) {
      test(`${locale}: ${link} message lists lines, total and the option @smoke @regression`, async ({ page }) => {
        const m = new MenuPage(page, locale);
        await m.goto();
        const picks = [['cafe-pasado', 2], ['pan-de-yuca', 1], ['limonada', 3]] as const;
        for (const [id, n] of picks) await m.addItem(id, n);
        await m.orderButton.click();

        const { href, text } = await m.message(link);
        const total = picks.reduce((s, [id, n]) => s + n * cents(item(id).price), 0);
        expect(href).toMatch(new RegExp(`^https://wa\\.me/${site.whatsapp}\\?text=`));

        const lines = text.split('\n');
        expect(lines[0]).toBe(intro[locale]);
        // One line per dish, in menu order, "- qty x name (unit price)".
        const body = menu.items
          .filter((i) => picks.some(([id]) => id === i.id))
          .map((i) => `- ${picks.find(([id]) => id === i.id)![1]} x ${i.name[locale]} (${usd(cents(i.price), locale)})`);
        expect(lines.slice(1, 1 + picks.length)).toEqual(body);
        expect(lines[1 + picks.length]).toBe(`Total: ${usd(total, locale)}`);
        expect(lines.at(-1)).toBe(mode[locale][link]);
        expect(lines).toHaveLength(picks.length + 3);
      });
    }
  }

  test('opening a WhatsApp link goes to a new tab, closes the dialog and keeps the cart @regression', async ({ page, context }) => {
    const m = new MenuPage(page);
    await m.goto();
    await m.addItem('locro', 2);
    await m.orderButton.click();
    await expect(m.hereLink).toHaveAttribute('rel', /noopener/);
    await expect(m.hereLink).toHaveAttribute('target', '_blank');

    await context.route('https://wa.me/**', (route) => route.fulfill({ body: 'stub', contentType: 'text/html' })); // never contact WhatsApp
    const href = (await m.hereLink.getAttribute('href'))!;
    const [popup] = await Promise.all([context.waitForEvent('page'), m.hereLink.click()]);
    expect(popup.url()).toBe(href);

    await expect(m.orderButton).toBeVisible(); // dialog closed
    await expect(m.qty('locro')).toHaveText('2'); // cart kept for a second order
  });
});

test.describe('persistence and bad stored data', () => {
  test('cart survives a reload and is stored as {id: qty} @smoke @regression', async ({ page }) => {
    const m = new MenuPage(page);
    await m.goto();
    await m.addItem('tigrillo', 2);
    await m.addItem('jugo-mora');
    await page.reload();
    await expect(m.qty('tigrillo')).toHaveText('2');
    await expect(m.qty('jugo-mora')).toHaveText('1');
    expect(JSON.parse((await m.storedCart())!)).toEqual({ tigrillo: 2, 'jugo-mora': 1 });
  });

  test('the same cart is shared between the Spanish and English menus @regression', async ({ page }) => {
    const es = new MenuPage(page, 'es');
    await es.goto();
    await es.addItem('bolon', 2);
    const en = new MenuPage(page, 'en');
    await en.goto();
    await expect(en.qty('bolon')).toHaveText('2');
    await en.orderButton.click();
    const { text } = await en.message('takeaway');
    expect(text).toContain(`- 2 x ${item('bolon').name.en}`);
    expect(text.split('\n')[0]).toBe(intro.en);
  });

  test('corrupt stored JSON falls back to an empty cart without errors @regression', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = new MenuPage(page);
    await m.seedCart('{not json');
    await expect.poll(() => m.storedCart()).toBe('{}'); // the hydrated app replaced the bad value
    await expect(m.total).toHaveText('$0,00');
    await expect(m.orderButton).toBeDisabled();
    await m.addItem('espresso'); // and it recovers
    await expect(m.qty('espresso')).toHaveText('1');
    expect(errors).toEqual([]);
  });

  test('stored lines for unknown, sold-out or non-positive items are ignored @regression', async ({ page }) => {
    const soldOut = menu.items.find((i) => !i.available);
    const stored: Record<string, number> = { ghost: 3, americano: -2, espresso: 2 };
    if (soldOut) stored[soldOut.id] = 1;
    const m = new MenuPage(page);
    await m.seedCart(JSON.stringify(stored));
    await expect(m.total).toHaveText(usd(2 * cents(item('espresso').price), 'es'));
    await expect(m.orderBar).toContainText('2 productos');
  });
});

