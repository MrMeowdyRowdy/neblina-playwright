import { expect, type Page } from '@playwright/test';
import type { Locale } from '../support/content';
import { routes } from '../support/routes';

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
  add = (id: string) => this.page.getByTestId(`add-${id}`);
  remove = (id: string) => this.page.getByTestId(`remove-${id}`);
  qty = (id: string) => this.page.getByTestId(`qty-${id}`);

  async goto() {
    await this.page.goto(this.path);
    // The cart is read after hydration; wait until the buttons are interactive.
    await expect(this.add('espresso')).toBeVisible();
  }

  async addItem(id: string, times = 1) {
    for (let i = 0; i < times; i++) await this.add(id).click();
  }

  /** Decoded text of a WhatsApp link: the message the café would receive. */
  async message(link: 'takeaway' | 'here') {
    const href = (await (link === 'takeaway' ? this.takeawayLink : this.hereLink).getAttribute('href'))!;
    return { href, text: decodeURIComponent(href.split('?text=')[1]) };
  }
}
