export const routes = [
  { id: 'home', es: '/', en: '/en/' },
  { id: 'menu', es: '/menu/', en: '/en/menu/' },
  { id: 'qr', es: '/menu/qr/', en: '/en/menu/qr/' },
  { id: 'quality', es: '/calidad/', en: '/en/quality/' },
] as const;

export const allPaths = routes.flatMap((r) => [r.es, r.en]);

/** Path of an absolute URL, so checks hold on any origin (docs/findings.md #1). Throws on a relative URL, which canonical, hreflang and sitemap entries must not be. */
export const pathOf = (url: string) => new URL(url).pathname;
