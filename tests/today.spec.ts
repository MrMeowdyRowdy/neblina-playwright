import { expect, test, type Page } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { menu, site, type Locale } from './support/content';

// Quito is UTC-5 all year (no DST), so a wall-clock time in Quito is an unambiguous instant.
const quito = (local: string) => new Date(`${local}-05:00`);
// Week of 2026-10-19: Mon 19, Tue 20, Wed 21, Thu 22, Fri 23, Sat 24, Sun 25.
const DAY = { Mon: '2026-10-19', Tue: '2026-10-20', Wed: '2026-10-21', Fri: '2026-10-23', Sat: '2026-10-24', Sun: '2026-10-25' } as const;
const hoursOn = (d: string) => site.hours.find((h) => h.days.includes(d))!;
const ritual = (id: string) => site.rituals.find((r) => r.id === id)!;

async function openAt(page: Page, when: Date, locale: Locale = 'es') {
  await page.clock.setFixedTime(when); // Date.now() is pinned; timers keep running
  const home = new HomePage(page, locale);
  await home.goto();
  await expect(home.staticNote).toHaveCount(0);
  return home;
}

test.describe('open / closed status and the focus line (Quito time)', () => {
  test('mid-morning on a weekday: open until closing, next ritual in 1 h 00 min @smoke @regression', async ({ page }) => {
    const home = await openAt(page, quito(`${DAY.Mon}T09:00:20`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${hoursOn('Monday').closes}`);
    await expect(home.focus).toContainText(ritual('pan').label.es);
    await expect(home.focus).toContainText('10:00');
    await expect(home.focus).toContainText('en 1 h 00 min');
    await expect(home.hoursToday).toHaveText(`Horario de hoy: ${hoursOn('Monday').opens} - ${hoursOn('Monday').closes}`);
    // The day line marks where we are: opening already started, bread is next, the rest is still ahead.
    await expect(home.moment('current')).toHaveCount(1);
    await expect(home.moment('current')).toContainText(ritual('opens').label.es);
    await expect(home.moment('next')).toContainText(ritual('pan').label.es);
    await expect(home.moment('later')).toHaveCount(site.rituals.length - 2);
    await expect(home.moment('past')).toHaveCount(0);
  });

  test('exactly on a ritual time the focus says "now" @regression', async ({ page }) => {
    const home = await openAt(page, quito(`${DAY.Wed}T10:00:20`));
    await expect(home.focus).toContainText(ritual('pan').label.es);
    await expect(home.focus).toContainText('ahora');
    await expect(home.moment('current')).toContainText(ritual('pan').label.es);
    await expect(home.moment('past')).toHaveCount(1);
  });

  test('before opening: closed, opens today, countdown to opening @regression', async ({ page }) => {
    const home = await openAt(page, quito(`${DAY.Mon}T06:00:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos hoy a las ${hoursOn('Monday').opens}`);
    await expect(home.focus).toContainText('en 1 h 30 min');
    await expect(home.moment('next')).toContainText(ritual('opens').label.es);
  });

  test('after closing: closed, opens tomorrow, whole day line is past @smoke @regression', async ({ page }) => {
    const home = await openAt(page, quito(`${DAY.Mon}T20:00:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Tuesday').opens}`);
    await expect(home.focus).toContainText('Cerrado');
    await expect(home.focus).toContainText(`Abrimos mañana a las ${hoursOn('Tuesday').opens}.`);
    await expect(home.moment('past')).toHaveCount(site.rituals.length);
  });

  test('"tomorrow" uses the next day\'s own hours (Friday night -> Saturday, Saturday night -> Sunday) @regression', async ({ page }) => {
    let home = await openAt(page, quito(`${DAY.Fri}T21:00:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Saturday').opens}`);
    home = await openAt(page, quito(`${DAY.Sat}T20:30:10`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Sunday').opens}`);
  });

  test('Sunday closes early: rituals after closing are dropped from the day line @regression', async ({ page }) => {
    const sun = hoursOn('Sunday');
    const home = await openAt(page, quito(`${DAY.Sun}T14:00:10`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${sun.closes}`);
    // "La hora de la neblina" (15:00) coincides with Sunday's closing time, so it is not a moment of that day.
    const inside = site.rituals.filter((r) => r.at === 'opens' || r.at === 'closes' || (r.at > sun.opens && r.at < sun.closes));
    await expect(home.moments).toHaveCount(inside.length);
    await expect(home.moments.filter({ hasText: ritual('neblina').label.es })).toHaveCount(0);
  });

  test('opening minute is open, closing minute is closed @regression', async ({ page }) => {
    const mon = hoursOn('Monday');
    let home = await openAt(page, quito(`${DAY.Mon}T${mon.opens}:00`));
    await expect(home.status).toHaveText(`Abierto ahora · hasta las ${mon.closes}`);
    await expect(home.focus).toContainText('ahora');
    home = await openAt(page, quito(`${DAY.Mon}T${mon.closes}:00`));
    await expect(home.status).toHaveText(`Cerrado · abrimos mañana a las ${hoursOn('Tuesday').opens}`);
  });

  test('English copy follows the same states @regression', async ({ page }) => {
    let home = await openAt(page, quito(`${DAY.Mon}T09:00:20`), 'en');
    await expect(home.status).toHaveText(`Open now · until ${hoursOn('Monday').closes}`);
    await expect(home.focus).toContainText('in 1 h 00 min');
    home = await openAt(page, quito(`${DAY.Mon}T06:00:10`), 'en');
    await expect(home.status).toHaveText(`Closed · we open today at ${hoursOn('Monday').opens}`);
    home = await openAt(page, quito(`${DAY.Mon}T20:00:10`), 'en');
    await expect(home.status).toHaveText(`Closed · we open tomorrow at ${hoursOn('Tuesday').opens}`);
    await expect(home.focus).toContainText(`We open tomorrow at ${hoursOn('Tuesday').opens}.`);
  });

  test('the Visit block names the hours that apply today @regression', async ({ page }) => {
    let home = await openAt(page, quito(`${DAY.Sun}T10:00:10`));
    await expect(home.visitHours).toHaveText(`Hoy ${hoursOn('Sunday').opens} - ${hoursOn('Sunday').closes}`);
    home = await openAt(page, quito(`${DAY.Sat}T10:00:10`));
    await expect(home.visitHours).toHaveText(`Hoy ${hoursOn('Saturday').opens} - ${hoursOn('Saturday').closes}`);
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
  test('shows the first hours group and the full list of rituals @regression', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    const first = site.hours[0];
    await expect(home.status).toHaveText(`${first.label.es}: ${first.opens} - ${first.closes}`);
    await expect(home.moments).toHaveCount(site.rituals.length);
    await expect(home.staticNote).toBeVisible();
  });
});

test.describe('seasonal item window (Quito dates)', () => {
  const { from, to, name } = menu.seasonal;
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
