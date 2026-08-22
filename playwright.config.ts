import { defineConfig, devices } from '@playwright/test'

/**
 * The browser-only behaviour suite. Three engines, deliberately.
 *
 * Timing lives elsewhere — `tools/browser/measure.mjs`, one engine — because a frame figure is only
 * comparable to itself. This file is the other half: the paths where engines genuinely disagree.
 *
 * **No `webServer` here.** `tools/browser/check.mjs` starts both harnesses and passes their origins
 * in, because the element harness needs a resolver for `zod` that no static config can express.
 */
export default defineConfig({
  testDir: './tools/browser',
  testMatch: /behaviour\.spec\.ts/,
  // A missing engine must fail this suite, never reduce it. Reporting two greens and omitting the
  // third is the shape of the four gates this repository has shipped with lists that reached
  // nothing.
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
