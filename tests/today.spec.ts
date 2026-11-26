import { expect, test, type Page } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { menu, site, type Locale } from './support/content';

// Quito is UTC-5 all year (no DST), so a wall-clock time in Quito is an unambiguous instant.
const quito = (local: string) => new Date(`${local}-05:00`);
// Week of 2026-10-19: Mon 19, Tue 20, Wed 21, Thu 22, Fri 23, Sat 24, Sun 25.
const DAY = { Mon: '2026-10-19', Wed: '2026-10-21', Fri: '2026-10-23', Sat: '2026-10-24', Sun: '2026-10-25' } as const;
const hoursOn = (d: string) => site.hours.find((h) => h.days.includes(d))!;
const ritual = (id: string) => site.rituals.find((r) => r.id === id)!;

async function openAt(page: Page, when: Date, locale: Locale = 'es') {
  await page.clock.setFixedTime(when); // Date.now() is pinned; timers keep running
  const home = new HomePage(page, locale);
  await home.goto();
  await expect(home.liveMark).toHaveCount(1); // hydrated: the band now follows the pinned clock
  return home;
}

test.describe('open / closed status and the hours band (Quito time)', () => {
  test('mid-morning on a weekday: open until closing, opening is now, bread is next @smoke @regression', async ({ page }) => {
    const mon = hoursOn('Monday');
    const home = await openAt(page, quito(`${DAY.Mon}T09:00:20`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${mon.closes}`);
    await expect(home.todayStatus).toHaveText(`Ahora: ${ritual('opens').label.es}. Siguiente a las ${ritual('pan').at}`);
    await expect(home.clock).toHaveText('09:00');
    await expect(home.hoursToday).toContainText(`${mon.opens} a ${mon.closes}`);
    await expect(home.moment('now')).toHaveCount(1);
    await expect(home.moment('now')).toContainText(ritual('opens').label.es);
    await expect(home.moment('next').first()).toContainText(ritual('pan').label.es);
    await expect(home.moment('past')).toHaveCount(0);
    await expect(home.dayLabel).toHaveCount(0);
  });

  test('exactly on a ritual time that ritual is now @regression', async ({ page }) => {
    const home = await openAt(page, quito(`${DAY.Wed}T10:00:20`));
    await expect(home.todayStatus).toHaveText(`Ahora: ${ritual('pan').label.es}. Siguiente a las ${ritual('almuerzo').at}`);
    await expect(home.moment('now')).toContainText(ritual('pan').label.es);
    await expect(home.moment('past')).toHaveCount(1);
  });

  test('before opening: closed, opens today, ring at the opening @regression', async ({ page }) => {
    const mon = hoursOn('Monday');
    const home = await openAt(page, quito(`${DAY.Mon}T06:00:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos hoy a las ${mon.opens}`);
    await expect(home.todayStatus).toHaveText(`Cerrado. Abrimos hoy a las ${mon.opens}`);
    await expect(home.clock).toHaveText(mon.opens);
    await expect(home.page.locator('[data-ring]')).toHaveCount(1);
    await expect(home.moment('now')).toHaveCount(0);
    await expect(home.dayLabel).toHaveText('Hoy, lunes');
  });

  test('after closing: closed, the band shows tomorrow @smoke @regression', async ({ page }) => {
    const tue = hoursOn('Tuesday');
    const home = await openAt(page, quito(`${DAY.Mon}T20:00:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${tue.opens}`);
    await expect(home.todayStatus).toHaveText(`Cerrado. Abrimos mañana, martes, a las ${tue.opens}`);
    await expect(home.dayLabel).toHaveText('Mañana, martes');
    await expect(home.moment('past')).toHaveCount(0);
    await expect(home.moment('now')).toHaveCount(0);
  });

  test('"tomorrow" uses the next day\'s own hours (Friday night -> Saturday, Saturday night -> Sunday) @regression', async ({ page }) => {
    let home = await openAt(page, quito(`${DAY.Fri}T21:00:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Saturday').opens}`);
    await expect(home.todayStatus).toHaveText(`Cerrado. Abrimos mañana, sábado, a las ${hoursOn('Saturday').opens}`);
    home = await openAt(page, quito(`${DAY.Sat}T20:30:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Sunday').opens}`);
  });

  test('Sunday closes early: rituals at or after closing are dropped from the band @regression', async ({ page }) => {
    const sun = hoursOn('Sunday');
    const home = await openAt(page, quito(`${DAY.Sun}T14:00:10`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${sun.closes}`);
    await expect(home.todayStatus).toHaveText(`Ahora: ${ritual('almuerzo').label.es}. Siguiente a las ${sun.closes}`);
    // "La hora de la neblina" (15:00) coincides with Sunday's closing time, so it is not a moment of that day.
    const inside = site.rituals.filter((r) => r.at === 'opens' || r.at === 'closes' || (r.at > sun.opens && r.at < sun.closes));
    await expect(home.moments).toHaveCount(inside.length);
    await expect(home.moments.filter({ hasText: ritual('neblina').label.es })).toHaveCount(0);
  });

  test('opening minute is open, closing minute is closed @regression', async ({ page }) => {
    const mon = hoursOn('Monday');
    let home = await openAt(page, quito(`${DAY.Mon}T${mon.opens}:00`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${mon.closes}`);
    await expect(home.moment('now')).toContainText(ritual('opens').label.es);
    home = await openAt(page, quito(`${DAY.Mon}T${mon.closes}:00`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Tuesday').opens}`);
  });

  test('English copy follows the same states @regression', async ({ page }) => {
    let home = await openAt(page, quito(`${DAY.Mon}T09:00:20`), 'en');
    await expect(home.status).toHaveText(`Open now · until ${hoursOn('Monday').closes}`);
    await expect(home.todayStatus).toHaveText(`Now: ${ritual('opens').label.en}. Next at ${ritual('pan').at}`);
    home = await openAt(page, quito(`${DAY.Mon}T06:00:10`), 'en');
    await expect(home.status).toHaveText(`Closed · we open today at ${hoursOn('Monday').opens}`);
    home = await openAt(page, quito(`${DAY.Mon}T20:00:10`), 'en');
    await expect(home.status).toHaveText(`Closed · we open tomorrow at ${hoursOn('Tuesday').opens}`);
    await expect(home.todayStatus).toHaveText(`Closed. We open tomorrow, Tuesday, at ${hoursOn('Tuesday').opens}`);
  });

  test('the Visit block marks the hours that apply today @regression', async ({ page }) => {
    for (const [at, d] of [[`${DAY.Sun}T10:00:10`, 'Sunday'], [`${DAY.Sat}T10:00:10`, 'Saturday']] as const) {
      const h = hoursOn(d);
      const home = await openAt(page, quito(at));
      await expect(home.visitHours).toHaveCount(1);
      await expect(home.visitHours).toContainText(h.label.es);
      await expect(home.visitHours).toContainText(`${h.opens} a ${h.closes}`);
    }
  });
});

test.describe('visitor in another time zone still sees Quito time', () => {
  // 03:00 UTC on Tue 20 is Monday 22:00 in Quito, but already Tuesday noon in Tokyo.
  const instant = new Date('2026-10-20T03:00:30Z');
  for (const timezoneId of ['Asia/Tokyo', 'America/Los_Angeles', 'Europe/Madrid']) {
    test.describe(() => {
      test.use({ timezoneId });
      test(`${timezoneId} @regression`, async ({ page }) => {
        const home = await openAt(page, instant);
        await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Tuesday').opens}`);
      });
    });
  }
});

test.describe('the live line moves on its own', () => {
  test('crossing closing time while the page is open flips the status @regression', async ({ page }) => {
    const mon = hoursOn('Monday');
    const home = await openAt(page, quito(`${DAY.Mon}T18:59:30`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${mon.closes}`);
    // Move the pinned clock past closing; the page's own 15 s poll (real time) must notice without a reload.
    // (page.clock.install + runFor is not used: it left the status blank in WebKit, so this variant runs the same in every browser.)
    await page.clock.setFixedTime(quito(`${DAY.Mon}T19:00:30`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Tuesday').opens}`, { timeout: 25_000 });
  });
});

test.describe('without JavaScript the static page is still useful', () => {
  test.use({ javaScriptEnabled: false });
  test('names the first hours group and lists its whole day @regression', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    const first = site.hours[0];
    await expect(home.todayStatus).toHaveText(`${first.label.es}: abrimos a las ${first.opens}`);
    const inside = site.rituals.filter((r) => r.at === 'opens' || r.at === 'closes' || (r.at > first.opens && r.at < first.closes));
    await expect(home.moments).toHaveCount(inside.length);
    await expect(home.liveMark).toHaveCount(0);
  });
});

for (const [n, { from, to, name }] of menu.seasonal.entries()) test.describe(`seasonal window ${n} ${from}..${to} (Quito dates)`, () => {
  const year = 2026;
  const day = (md: string, shift = 0) => {
    const d = new Date(`${year}-${md}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + shift);
    return d.toISOString().slice(0, 10);
  };
  const cases = [
    { label: 'day before the window', at: `${day(from, -1)}T23:59:00`, shown: false },
    { label: 'first minute of the window', at: `${day(from)}T00:00:00`, shown: true },
    { label: 'last minute of the window', at: `${day(to)}T23:59:00`, shown: true },
    { label: 'day after the window', at: `${day(to, 1)}T00:00:00`, shown: false },
  ];
  for (const c of cases) {
    test(`${c.label}: ${c.shown ? 'shown' : 'hidden'} @regression`, async ({ page }) => {
      const home = await openAt(page, quito(c.at));
      if (c.shown) {
        await expect(home.seasonal).toContainText(name.es);
      } else {
        await expect(home.seasonal).toHaveCount(0);
      }
    });
  }

  test('English seasonal note uses the English name @regression', async ({ page }) => {
    const home = await openAt(page, quito(`${day(from)}T12:00:00`), 'en');
    await expect(home.seasonal).toContainText(name.en);
  });
});
