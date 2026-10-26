import { expect, test } from './fixtures';

/** The household's groceries in each of the last six full months: $310 last month, up $10 for each month further back. */
const groceriesMonthsAgo = (monthsAgo: number) => (monthsAgo <= 6 ? 300 + monthsAgo * 10 : 0);
const averageOfMonths = (count: number) => Array.from({ length: count }, (_, index) => groceriesMonthsAgo(index + 1)).reduce((total, amount) => total + amount, 0) / count;
const dollars = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

test("a category's budget History adds 3-month, 12-month and year-to-date averages and this year's spending under Monarch's own, and clicking an average enters it", async ({ page, open }) => {
	await open({ path: '/plan', waitForRows: false });
	const budgeted = page.locator('[data-goal-row-id="cat-groceries"] input[name=budgeted]');
	await budgeted.click();

	const averages = page.locator('[data-wingspan-budget-averages]');
	await expect(averages.getByRole('button')).toHaveText([
		`${dollars(averageOfMonths(3))}3-month average`,
		`${dollars(averageOfMonths(12))}12-month average`,
		...(new Date().getMonth() ? [`${dollars(averageOfMonths(new Date().getMonth()))}Year-to-date average`] : [])
	]);
	// This month's $45 so far, and each earlier month this year.
	const spentThisYear = 45 + Array.from({ length: new Date().getMonth() }, (_, index) => groceriesMonthsAgo(index + 1)).reduce((total, amount) => total + amount, 0);
	await expect(averages.getByText('Spent this year')).toBeVisible();
	await expect(page.locator('[data-wingspan-budget-averages] > div').last()).toContainText(`${dollars(spentThisYear)}Spent this year`);
	await expect(page.getByText('Monthly average')).toBeVisible();

	await averages.getByRole('button', { name: `12-month average, ${dollars(averageOfMonths(12))}. Use as budget` }).click();
	await budgeted.press('Enter');
	await expect(budgeted).toHaveValue(dollars(averageOfMonths(12)));
});

test('closing the History popover takes the averages with it', async ({ page, open }) => {
	await open({ path: '/plan', waitForRows: false });
	await page.locator('[data-goal-row-id="cat-groceries"] input[name=budgeted]').click();
	await expect(page.locator('[data-wingspan-budget-averages]').getByText('12-month average')).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page.locator('[data-wingspan-budget-averages]')).toHaveCount(0);
});

test("Budget notes how much of each row's spending was paid from the HSA: on its card, or tagged to reimburse from it", async ({ page, household, open }) => {
	household.addHsaExpenses();
	household.addHsaCardPurchase();
	await open({ path: '/plan', waitForRows: false });
	const medicalNote = page.locator('[data-goal-row-id="cat-medical"] [data-wingspan-budget-row-note]');

	// Monarch's Budget grid takes a while to draw in the e2e setup.
	await expect(medicalNote).toHaveText('$64 paid from HSA', { timeout: 30_000 });
	// Medical's group, Flexible, notes the same amount.
	await expect(page.locator('[data-wingspan-budget-row-note]')).toHaveText(['$64 paid from HSA', '$64 paid from HSA']);

	// Three months back, the clinic visit paid from checking was tagged to reimburse from the HSA.
	for (let monthsBack = 0; monthsBack < 3; monthsBack++) await page.getByRole('button', { name: 'Previous', exact: true }).click();
	await expect(medicalNote).toHaveText('$185 paid from HSA', { timeout: 30_000 });
});

test('a household with no HSA or HSA tags gets no notes on Budget', async ({ page, open }) => {
	await open({ path: '/plan', waitForRows: false });
	await expect(page.locator('[data-goal-row-id="cat-groceries"]').first()).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('[data-wingspan-budget-row-note]')).toHaveCount(0);
});
