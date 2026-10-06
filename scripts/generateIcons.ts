// Renders public/icon/*.png from assets/logo.svg
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 96, 128];
// Easier to see in the toolbar than the original color
const TOOLBAR_FILL = '#6B747E';

async function main(): Promise<void> {
	await mkdir('public/icon', { recursive: true });
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const svg = (await readFile('assets/logo.svg', 'utf8')).replace(/fill="#[0-9A-Fa-f]{6}"/, `fill="${TOOLBAR_FILL}"`);
	for (const size of SIZES) {
		await page.setViewportSize({ width: size, height: size });
		await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
		await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
	}
	await browser.close();
	console.log('Rendered', SIZES.map(size => `${size}px`).join(', '));
}

await main();
