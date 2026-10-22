import type { Page } from '@playwright/test';
import type { Locale } from '../support/content';
import { routes } from '../support/routes';

export class HomePage {
  constructor(readonly page: Page, readonly locale: Locale = 'es') {}

  get status() {
    return this.page.locator('[data-status]');
  }
  get focus() {
    return this.page.locator('[data-focus]');
  }
  get hoursToday() {
    return this.page.locator('.today-hours');
  }
  get moments() {
    return this.page.locator('[data-day] li');
  }
  get visitHours() {
    return this.page.locator('[data-visit] address p[data-row]').nth(3);
  }
  /** Note shown only until the page hydrates and the live line takes over (and always without JavaScript). */
  get staticNote() {
    return this.page.locator('.today-static');
  }
  get seasonal() {
    return this.page.locator('[data-seasonal]');
  }
  moment = (state: 'past' | 'current' | 'next' | 'later') => this.moments.and(this.page.locator(`[data-state="${state}"]`));

  goto() {
    return this.page.goto(routes[0][this.locale]);
  }
}
