import { defineConfig } from '@playwright/test';

// No hay backend PHP local -- las pruebas corren contra un sitio ya
// desplegado (por defecto, producción). Para probar contra otra URL:
// SITE_URL=https://otra-url npm run test:e2e
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.SITE_URL || 'https://paginaweb-the-club-house.fgkljr.easypanel.host',
  },
});
