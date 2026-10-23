import { defineConfig } from '@playwright/test';

export default defineConfig({
	fullyParallel: true,
	// On GitHub, failures are also annotated on the PR's changed lines.
	reporter: process.env.GITHUB_ACTIONS ? [['list'], ['github']] : [['list']],
	outputDir: 'tests/test-results',
	projects: [
		{ name: 'e2e', testDir: 'tests/e2e', use: { trace: 'retain-on-failure', viewport: { width: 1440, height: 960 } } },
		// Skips what needs real extension machinery: reloading from chrome://extensions, and retail sync's background script.
		// WebKit compiles Monarch's bundle slowly on CI's small runners, so a cold page can take longer than the default wait.
		{
			name: 'e2e-webkit',
			testDir: 'tests/e2e',
			testIgnore: [/reload\.spec\.ts/, /retail-sync\.spec\.ts/],
			expect: { timeout: 10_000 },
			use: { browserName: 'webkit', trace: 'retain-on-failure', viewport: { width: 1440, height: 960 } }
		},
		{ name: 'e2e-firefox', testDir: 'tests/e2e', testMatch: /smoke\.spec\.ts/, use: { browserName: 'firefox', trace: 'retain-on-failure', viewport: { width: 1440, height: 960 } } },
		{ name: 'screenshots', testDir: 'tests/e2e', testMatch: /\.shots\.ts/, workers: 1, use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
		{ name: 'video', testDir: 'tests/e2e', testMatch: /\.video\.ts/ }
	]
});
