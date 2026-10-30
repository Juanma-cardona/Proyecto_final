import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

/**
 * La URL base debe terminar en "/": así `request.get('v1/products')` se resuelve como
 * http://localhost:3000/api/v1/products (sin la barra se perdería "/api").
 */
const baseURL = (process.env.BASE_URL || 'http://localhost:3000/api/').replace(/\/*$/, '/');

export default defineConfig({
  testDir: './src/tests',
  /*
   * Las pruebas crean sus propios datos, pero comparten la misma base de datos.
   * Se ejecutan de una en una para evitar bloqueos de SQL Server entre pruebas simultáneas.
   */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html']],
  use: {
    baseURL,
    /* Evidencia cuando una prueba falla */
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
