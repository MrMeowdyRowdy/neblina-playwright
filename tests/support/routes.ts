export const routes = [
  { id: 'home', es: '/', en: '/en/' },
  { id: 'menu', es: '/menu/', en: '/en/menu/' },
  { id: 'qr', es: '/menu/qr/', en: '/en/menu/qr/' },
  { id: 'quality', es: '/calidad/', en: '/en/quality/' },
] as const;

export const allPaths = routes.flatMap((r) => [r.es, r.en]);
