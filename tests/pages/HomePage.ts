import type { Page } from '@playwright/test';
import type { Locale } from '../support/content';
import { routes } from '../support/routes';

export class HomePage {
  constructor(readonly page: Page, readonly locale: Locale = 'es') {}

  /** The hero's open / closed line ("Abierto ahora · hasta las 19:00"). */
  get status() {
    return this.page.locator('section:has(#hero-title) [data-status]');
  }
  /** The "Hoy en Neblina" status line: what runs now and what is next, or when it opens again. */
  get todayStatus() {
    return this.page.locator('[data-today] [data-status]');
  }
  get clock() {
    return this.page.locator('[data-today] [data-clock]');
  }
  /** The week's hours list in "Hoy"; the group that covers today is aria-current. */
  get hoursToday() {
    return this.page.locator('[data-today] .hy-hours [aria-current="date"]');
  }
  /** Every station of the hours band plus its closing end. */
  get moments() {
    return this.page.locator('[data-day] li');
  }
  /** Day label over the band when it shows another day ("Mañana, martes"). */
  get dayLabel() {
    return this.page.locator('[data-band] .dayl');
  }
  /** "ahora" marker while open, hollow ring at the next opening while closed: rendered only once the live clock runs. */
  get liveMark() {
    return this.page.locator('[data-band] :is([data-mark], [data-ring])');
  }
  get visitHours() {
    return this.page.locator('[data-visit] [data-row][aria-current="date"]');
  }
  get seasonal() {
    return this.page.locator('[data-today] figure[data-kind="season"]');
  }
  moment = (tone: 'past' | 'now' | 'next') => this.page.locator(`[data-day] li.seg.${tone}`);

  goto() {
    return this.page.goto(routes[0][this.locale]);
  }
}
