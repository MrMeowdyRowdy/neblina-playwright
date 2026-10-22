import type { Page } from '@playwright/test';
import type { Locale } from '../support/content';
import { routes } from '../support/routes';

const CART_KEY = 'neblina-cart'; // localStorage key owned by the app

export class MenuPage {
  constructor(readonly page: Page, readonly locale: Locale = 'es') {}

  get path() {
    return routes[1][this.locale];
  }
  get total() {
    return this.page.getByTestId('total');
  }
  get orderButton() {
    return this.page.getByTestId('order-open');
  }
  get takeawayLink() {
    return this.page.getByTestId('order-link-takeaway');
  }
  get hereLink() {
    return this.page.getByTestId('order-link-here');
  }
  get orderBar() {
    return this.page.getByRole('region', { name: this.locale === 'es' ? 'Tu pedido' : 'Your order' });
  }
  get dishes() {
    return this.page.locator('[data-dish]');
  }
  get qrLink() {
    return this.page.getByRole('link', { name: this.locale === 'es' ? 'Versión imprimible con código QR' : 'Printable version with QR code' });
  }
  add = (id: string) => this.page.getByTestId(`add-${id}`);
  remove = (id: string) => this.page.getByTestId(`remove-${id}`);
  qty = (id: string) => this.page.getByTestId(`qty-${id}`);

  async goto() {
    await this.page.goto(this.path);
    // The add buttons are in the static HTML, so a click before hydration is lost. The app saves the
    // cart right after hydrating; on the first visit in a context, that save is the signal.
    await this.page.waitForFunction((key) => localStorage.getItem(key) !== null, CART_KEY);
  }

  async addItem(id: string, times = 1) {
    for (let i = 0; i < times; i++) await this.add(id).click();
  }

  /**
   * Store a raw cart value and reload, to reach states the UI cannot produce.
   * The key already exists on reload, so this cannot wait for hydration: assert on a state only the hydrated app shows.
   */
  async seedCart(value: string) {
    await this.goto();
    await this.page.evaluate(([key, v]) => localStorage.setItem(key, v), [CART_KEY, value]);
    await this.page.reload();
  }

  /** The stored cart as raw text (it may not be valid JSON). */
  storedCart() {
    return this.page.evaluate((key) => localStorage.getItem(key), CART_KEY);
  }

  /** Decoded text of a WhatsApp link: the message the café would receive. */
  async message(link: 'takeaway' | 'here') {
    const href = (await (link === 'takeaway' ? this.takeawayLink : this.hereLink).getAttribute('href'))!;
    return { href, text: decodeURIComponent(href.split('?text=')[1]) };
  }
}
