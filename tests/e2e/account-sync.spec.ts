import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const syncButton = (page: Page) => page.locator('[data-wingspan-header-note]').getByRole('button', { name: /last account sync|^Refreshing|^Not synced/ });
const syncPopover = (page: Page) => page.getByRole('dialog', { name: 'Account syncs' });

test('Transactions says how long ago the accounts synced, and lists each account when opened', async ({ page, open }) => {
	await open({ path: '/transactions', waitForRows: false });

	await expect(syncButton(page)).toHaveText('2h ago');
	await expect(syncButton(page)).toHaveAccessibleName('2h ago, last account sync');
	await syncButton(page).click();

	await expect(syncPopover(page).getByRole('listitem').filter({ hasText: 'Everyday Checking' })).toContainText('2 hours ago');
});

test('an account stuck at an older sync is listed first and flagged, without holding back when the accounts synced', async ({ page, household, open }) => {
	household.stallAccountSync('acct-flex', 19);
	await open({ path: '/transactions', waitForRows: false });

	await expect(syncButton(page)).toHaveText('2h ago');
	await syncButton(page).click();

	const firstRow = syncPopover(page).getByRole('listitem').first();
	await expect(firstRow).toContainText('Flex Card');
	await expect(firstRow.getByText('19 days ago')).toHaveClass(/text-content-warning/);
});

test('Refresh all refreshes the accounts in Monarch and offers a reload to show new transactions', async ({ page, open, apiLog }) => {
	await open({ path: '/transactions', waitForRows: false });

	await syncButton(page).click();
	await syncPopover(page).getByRole('button', { name: 'Refresh all' }).click();

	await expect(page.getByText('Accounts refreshed')).toBeVisible();
	await expect(page.locator('[data-mds="toast"]').getByRole('button', { name: 'Reload' })).toBeVisible();
	await expect(syncButton(page)).toHaveText('just now');
	expect(apiLog.operations).toContain('wingspan_RefreshAllAccounts');
});

test('an account that needs signing in again is counted, and opens Accounts', async ({ page, household, open }) => {
	household.disconnectAccount('acct-flex');
	await open({ path: '/transactions', waitForRows: false });

	await expect(syncButton(page)).toHaveAccessibleName('2h ago, last account sync, 1 account needs attention');
	await syncButton(page).click();
	await syncPopover(page).getByRole('button', { name: 'Needs attention' }).click();

	await expect(page).toHaveURL(/\/accounts(\?|$)/);
});

test('the sync status shows only on Transactions', async ({ page, open }) => {
	await open({ path: '/transactions', waitForRows: false });
	await expect(syncButton(page)).toBeVisible();

	await page.getByRole('link', { name: 'Cash Flow' }).click();

	await expect(page).toHaveURL(/\/cash-flow/);
	await expect(syncButton(page)).toHaveCount(0);
});
