// L0-03 / L0-04 : configuration des tests qui ouvrent la vraie application dans un vrai navigateur.
// Trois profils : un iPhone (WebKit), un Android modeste (Chromium), et un Chromium sans window.caches
// pour simuler le Chrome d'iPhone, où le cache hors ligne n'existe pas (appareil D2 du cahier).
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tools/e2e',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 5_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone-13-webkit',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
    {
      name: 'pixel-5-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'chromium-sans-caches',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node tools/serve.mjs --artifact',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
