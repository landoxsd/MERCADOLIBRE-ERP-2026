import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno para los tests (incluye MELI_TEST_SESSION_COOKIE)
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Configuración de Playwright para ML ERP — Módulo de Scraping V4
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,         // Secuencial para no sobrecargar ML con requests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,                   // Un worker: scraping respetuoso con el servidor
  timeout: 60000,               // 60 segundos por test (páginas ML pueden tardar)
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],                   // Output en consola también
  ],

  use: {
    // ERP local — para tests de integración con el dashboard
    baseURL: 'http://localhost:3000',

    // Screenshots en caso de fallo (útil para debug de scraping)
    screenshot: 'only-on-failure',
    screenshotMode: 'viewport',

    // Grabar video en caso de fallo (muy útil para debug de scraping)
    video: 'on-first-retry',

    // Trace para análisis detallado
    trace: 'on-first-retry',

    // Carpeta de salida para screenshots de tests
    testIdAttribute: 'data-testid',
  },

  // Carpeta de outputs (screenshots, videos, traces)
  outputDir: 'tests/test-results/',

  /* Solo Chromium para scraping (más rápido y estable) */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Emular navegador real (anti-detección básica)
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'es-VE',
        timezoneId: 'America/Caracas',
        viewport: { width: 1366, height: 768 },
      },
    },

    // Firefox disponible pero desactivado por defecto (activar si ML bloquea Chrome)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  /* Descomenta para iniciar el servidor de Next.js automáticamente antes de los tests */
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true,
  //   timeout: 120000,
  // },
});
