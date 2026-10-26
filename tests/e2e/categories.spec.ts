import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Monarch's rows, and Wingspan's among them. */
const summaryRows = (page: Page) => page.locator('[data-external-id="summary-card-row"], [data-wingspan-category-summary-row] > div');
const summaryValue = (page: Page, label: string) => summaryRows(page).filter({ hasText: label }).locator('dd');
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const amountOf = async (page: Page, label: string) => Number((await summaryValue(page, label).textContent())?.replace(/[^\d.]/g, ''));

test("a category's Summary for this year adds its average per month, over the months so far, after Monarch's Average transaction", async ({ page, open }) => {
	const year = new Date().getFullYear();
	await open({ path: `/categories/cat-groceries?date=${year}-01-01&timeframe=year`, waitForRows: false });
	const average = summaryValue(page, 'Average per month');
	await expect(average).toBeVisible();

	const rowLabels = summaryRows(page).locator('dt');
	await expect(rowLabels.nth(3)).toHaveText('Average per month');
	await expect(rowLabels.nth(2)).toHaveText('Average transaction');
	await expect(average).toHaveText(money((await amountOf(page, 'Total spending')) / (new Date().getMonth() + 1)));
});

test("a category's all-time Summary averages from its first transaction's month through this one", async ({ page, open }) => {
	await open({ path: '/categories/cat-groceries', waitForRows: false });
	await expect(summaryValue(page, 'Average per month')).toBeVisible();

	// The household's first groceries were six months ago, so seven months count with this one.
	await expect(summaryValue(page, 'Average per month')).toHaveText(money((await amountOf(page, 'Total spending')) / 7));
});

test('a picked month has no average per month', async ({ page, open }) => {
	const month = new Date().toISOString().slice(0, 7);
	await open({ path: `/categories/cat-groceries?date=${month}-01&timeframe=month`, waitForRows: false });
	await expect(summaryValue(page, 'Total spending')).toBeVisible();
	await expect(page.locator('[data-wingspan-category-summary-row]')).toHaveCount(0);
});
