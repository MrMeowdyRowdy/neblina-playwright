import fs from 'node:fs';
import path from 'node:path';
import { appDir } from './paths';

type L10n = { es: string; en: string };
export type MenuItem = { id: string; category: string; name: L10n; description: L10n; price: number; tags: string[]; available: boolean };
export type Menu = {
  categories: { id: string; name: L10n }[];
  items: MenuItem[];
  seasonal: { from: string; to: string; name: L10n; note: L10n };
};
export type Site = {
  name: string;
  whatsapp: string;
  hours: { label: L10n; days: string[]; opens: string; closes: string }[];
  rituals: { id: string; at: string; label: L10n; note: L10n }[];
};

// The app's own content files are the oracle: totals, messages and hours are computed from them, never hard-coded.
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(appDir, 'content', file), 'utf8'));
export const menu = read<Menu>('menu.json');
export const site = read<Site>('site.json');

export const item = (id: string) => menu.items.find((i) => i.id === id)!;
export const available = menu.items.filter((i) => i.available);
export type Locale = 'es' | 'en';

/** "$12,50" in Spanish, "$12.50" in English, from integer cents (no float drift). */
export const usd = (cents: number, locale: Locale) => {
  const s = `$${(cents / 100).toFixed(2)}`;
  return locale === 'es' ? s.replace('.', ',') : s;
};
export const cents = (price: number) => Math.round(price * 100);
