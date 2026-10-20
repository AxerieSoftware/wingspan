import { expect, test } from './fixtures';

const transactionsBadge = '[data-external-id="side-bar"] a[href="/transactions"] [data-wingspan-sidebar-badge]';

test("Transactions in the sidebar counts the transactions to review, beside Accounts' own count", async ({ page, household, open }) => {
	household.markForReview(3);
	household.addLoanPayment();
	household.linkLoanPayment();
	await open({ path: '/cash-flow', waitForRows: false });

	await expect(page.locator(`${transactionsBadge} [data-mds="badge-label"]`)).toHaveText('3');
	await expect(page.locator(transactionsBadge)).toContainText('3 transactions to review');
	await expect(page.locator('a[href="/accounts"] [data-wingspan-sidebar-badge]')).toContainText('1');
});

test('Transactions has no count when nothing needs review', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });

	await expect(page.getByRole('group', { name: 'Projected balances' })).toBeVisible();
	await expect(page.locator(transactionsBadge)).toHaveCount(0);
});
