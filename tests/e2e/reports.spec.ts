import { expect, test } from './fixtures';

const REPORTS_THIS_MONTH = '/reports/cash-flow?timeframeIncludeCurrent=true&timeframeUnit=month&timeframeValue=1';

test("loans paid down shows after Reports' Savings rate for the report's dates, as a share of the total income it shows", async ({ page, open }) => {
	await open({ path: REPORTS_THIS_MONTH, waitForRows: false });
	const paydown = page.getByTestId('loans-paid-down-card');
	const totalIncome = page.locator('[data-external-id="deprecated-statistic-card"]').filter({ hasText: 'Total income' });

	await expect(page.locator('[style*="grid-area: chart"] > [data-external-id="flex-container-base"] > :last-child')).toHaveAttribute('data-wingspan-reports-summary-card', '');
	// The auto loan's balance drops $340 each month.
	await expect(paydown).toContainText('$340');
	const income = Number((await totalIncome.locator('span').first().textContent())?.replace(/[^\d.]/g, ''));
	await expect(paydown).toContainText(`$340Loans paid down · ${new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 }).format(340 / income)} of income`);
});

test("loans paid down isn't shown while Reports covers all time", async ({ page, open }) => {
	await open({ path: '/reports/cash-flow', waitForRows: false });

	await expect(page.locator('[data-external-id="deprecated-statistic-card"]').filter({ hasText: 'Total income' })).toBeVisible();
	await expect(page.getByTestId('loans-paid-down-card')).toHaveCount(0);
});
