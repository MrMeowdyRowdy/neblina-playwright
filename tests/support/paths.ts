import path from 'node:path';

/** The Neblina app checkout (smb-sites/apps/restaurant). Holds out/ (what is served) and content/ (the test oracle). */
export const appDir = path.resolve(process.env.NEBLINA_APP ?? '../smb-sites/apps/restaurant');
