import type { Page } from '@playwright/test';
import { expect, itemRow, reloadExtension, test } from './fixtures';

const STALE_MESSAGE = 'Wingspan was updated or disabled. Reload the page to continue.';

/** Any click makes the disconnected content script try to sync, which is when it detects that it's disconnected. */
async function nudge(page: Page) {
	await page.getByRole('heading', { level: 1 }).click();
}

test('a content script disconnected by an extension update greys out what it added and asks for a reload, replacing other notices', async ({ page, context, open }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await open();
	await expect(page.getByText('Wingspan now saves to your Monarch account')).toBeVisible();
	await reloadExtension(context);
	await nudge(page);

	const row = itemRow(page, 'Piano Lessons');
	await expect(row).toBeVisible();
	await expect.poll(() => row.evaluate(rowEl => Number(getComputedStyle(rowEl).opacity))).toBeLessThan(1);
	await expect.poll(() => row.evaluate(rowEl => getComputedStyle(rowEl).pointerEvents)).toBe('none');
	await expect(page.getByText(STALE_MESSAGE)).toBeVisible();
	await expect(page.getByText('Wingspan now saves to your Monarch account')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Internet' })).not.toContainText('· Due');
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await page.waitForTimeout(500);
	expect(errors).toEqual([]);

	// The test browser won't run an unpacked extension once it's reloaded, so this only checks that Reload reloads the page.
	const reloaded = page.waitForEvent('load');
	await page.getByRole('button', { name: 'Reload' }).click();
	await reloaded;
});

test("a disconnected content script closes an item's details, so Monarch's month summary shows again", async ({ page, context, open }) => {
	await open();
	await itemRow(page, 'Piano Lessons').click();
	await expect(page.locator('[data-wingspan-detail]')).toBeVisible();

	await reloadExtension(context);
	await nudge(page);

	await expect(page.getByText(STALE_MESSAGE)).toBeVisible();
	await expect(page.locator('[data-wingspan-detail]')).toHaveCount(0);
	await expect(page.locator('[data-external-id="recurring-summary-sidebar"]')).toBeVisible();
});

test('the disconnected content script shuts down when a newer one starts on the page', async ({ page, context, open }) => {
	await open();
	await reloadExtension(context);
	await nudge(page);
	await expect(page.getByText(STALE_MESSAGE)).toBeVisible();

	await page.evaluate(() => window.dispatchEvent(new CustomEvent('wingspan:started')));
	await expect(page.locator('[data-wingspan-row]')).toHaveCount(0);
	await expect(page.getByText(STALE_MESSAGE)).toHaveCount(0);
	await expect(page.locator('style[data-wingspan-stale]')).toHaveCount(0);
});
