import { defineConfig } from '@playwright/test';

export default defineConfig({
	fullyParallel: true,
	// GitHub's runners have 4 cores, and Playwright would use only half. The tests mostly wait on the page, so all 4 are fine.
	workers: process.env.GITHUB_ACTIONS ? 4 : undefined,
	// On GitHub, failures are also annotated on the PR's changed lines.
	reporter: process.env.GITHUB_ACTIONS ? [['list'], ['github']] : [['list']],
	outputDir: 'tests/test-results',
	projects: [
		{ name: 'e2e', testDir: 'tests/e2e', use: { trace: 'retain-on-failure', viewport: { width: 1440, height: 960 } } },
		{ name: 'screenshots', testDir: 'tests/e2e', testMatch: /\.shots\.ts/, workers: 1, use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } }
	]
});
