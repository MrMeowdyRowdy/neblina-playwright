import { expect, test } from '@playwright/test';
import { allPaths } from './support/routes';

test.describe('page load health', () => {
  for (const p of allPaths) {
    test(`${p}: no console errors, no failed or third-party requests @smoke @regression`, async ({ page, baseURL }) => {
      const problems: string[] = [];
      const origin = new URL(baseURL!).origin;
      page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('requestfailed', (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
      page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
      const foreign: string[] = [];
      page.on('request', (r) => !r.url().startsWith(origin) && !r.url().startsWith('data:') && foreign.push(r.url()));

      await page.goto(p, { waitUntil: 'networkidle' });
      expect(problems).toEqual([]);
      expect(foreign, 'the site promises no third-party requests').toEqual([]);
    });
  }
});

test.describe('layout', () => {
  for (const p of allPaths) {
    test(`${p}: no horizontal scroll at this viewport @regression`, async ({ page }) => {
      await page.goto(p, { waitUntil: 'networkidle' });
      const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(width);
    });
  }
});

test.describe('links', () => {
  test('every internal link resolves and every #fragment has a target @regression', async ({ page, request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const checked = new Map<string, number>();
    const fragments: { from: string; target: string; hash: string }[] = [];
    const external: { from: string; rel: string | null; target: string | null; href: string }[] = [];

    for (const p of allPaths) {
      await page.goto(p);
      for (const a of await page.locator('a[href]').all()) {
        const href = (await a.getAttribute('href'))!;
        if (/^(mailto|tel):/.test(href)) continue;
        const url = new URL(href, origin + p);
        if (url.origin !== origin) {
          external.push({ from: p, href, rel: await a.getAttribute('rel'), target: await a.getAttribute('target') });
          continue;
        }
        if (url.hash) fragments.push({ from: p, target: url.pathname, hash: url.hash.slice(1) });
        if (!checked.has(url.pathname)) checked.set(url.pathname, (await request.get(url.pathname)).status());
      }
    }

    expect([...checked].filter(([, s]) => s !== 200), 'internal links that do not return 200').toEqual([]);
    expect(checked.size).toBeGreaterThanOrEqual(allPaths.length);

    for (const f of fragments) {
      await page.goto(f.target);
      await expect(page.locator(`[id="${f.hash}"]`), `${f.from} -> ${f.target}#${f.hash}`).toHaveCount(1);
    }

    // Links that leave the site must open in a new tab without handing it window.opener.
    for (const e of external.filter((x) => x.target === '_blank')) {
      expect(e.rel, `${e.from} -> ${e.href}`).toMatch(/noopener/);
    }
    expect(external.length).toBeGreaterThan(0);
  });
});
