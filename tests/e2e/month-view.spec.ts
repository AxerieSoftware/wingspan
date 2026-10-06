import { APP, ascending, expect, itemRow, rowDates, rowNames, section, seedExtensionStorage, settled, shownYear, storageKey, test } from './fixtures';

test("adds Wingspan's bills next to Monarch's, with due dates on every row", async ({ page, open }) => {
	await open();
	const expenses = section(page, 'Expenses');
	await expect(itemRow(expenses, 'Piano Lessons')).toBeVisible();
	await expect(expenses.getByRole('button', { name: 'Internet' })).toContainText(/· Due \w{3} 30/);
	await expect(
		section(page, 'Income')
			.getByRole('button', { name: /Paycheck/ })
			.last()
	).toContainText(/· Due \w{3} 15/);
});

test("a bill unpaid from earlier months shares one row with this month's, showing the total owed", async ({ page, open }) => {
	await open();
	const row = itemRow(section(page, 'Expenses'), 'Piano Lessons');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText(/2 owed since \w{3} 1/);
	await expect(row).toContainText('$280.00');
});

test('orders every table by date, paid or not', async ({ page, open }) => {
	await open();
	const year = await shownYear(page);
	await expect.poll(async () => ascending(await rowDates(section(page, 'Expenses'), year))).toBe(true);
	expect(await rowNames(section(page, 'Expenses'))).toEqual(expect.arrayContaining(['Streaming', 'Phone', 'Internet', 'Piano Lessons']));
});

test('puts card payments in Statements in place of Coming soon', async ({ page, open }) => {
	await open();
	await expect(page.locator('[data-external-id="recurring-coming-soon-content"]')).toBeHidden();
	const statements = page.locator('[data-wingspan-statements]');
	for (const name of ['Rewards Card', 'Store Card', 'Travel Card']) await expect(itemRow(statements, name)).toBeVisible();
});

test('a card not in Monarch with no typical payment shows an unknown amount due and is never counted as paid', async ({ page, household }) => {
	const items = household.sampleItems() as { recurring: { recurringItems: { id: string; amount: number }[] } };
	for (const item of items.recurring.recurringItems) if (item.id === 'store') item.amount = 0;
	await seedExtensionStorage(page, { [storageKey('wingspan')]: { version: 1, etag: 'sample', value: items } });
	await page.goto(`${APP}/recurring-v2/monthly`);

	const statements = page.locator('[data-wingspan-statements]');
	const storeCard = itemRow(statements, 'Store Card');
	await expect(storeCard).toContainText('Unknown');
	await expect(storeCard).toContainText('Set a typical payment');
	await expect(storeCard).not.toContainText('$0.00');
	await expect(statements).toContainText(/1 amount unknown/);
	await expect(statements).not.toContainText('All paid');
	await expect(statements).not.toContainText('covered by checking');
});

test('without card payments, Statements says how to add one instead of Coming soon', async ({ page, open }) => {
	await open({ withSampleItems: false, waitForRows: false });
	await expect(page.locator('[data-wingspan-statements]')).toContainText('No card payments yet. Add one with Add recurring.');
	await expect(page.locator('[data-external-id="recurring-coming-soon-content"]')).toBeHidden();
});

test("screen readers announce a row's schedule, status and amount after its name, and which row a menu belongs to", async ({ page, open }) => {
	await open();
	const row = itemRow(section(page, 'Expenses'), 'Piano Lessons');
	await expect(row).toHaveAccessibleDescription(/Due .*\$/);
	await expect(row.getByRole('button', { name: 'More options for Piano Lessons' })).toBeVisible();
});

test('updates when Monarch changes months', async ({ page, open, apiLog }) => {
	await open();
	const title = page.getByRole('heading', { level: 1 });
	const before = await title.textContent();
	await page.getByRole('button', { name: 'Next month' }).click();
	await expect(title).not.toHaveText(before ?? '');
	await settled(apiLog);
	await expect(itemRow(section(page, 'Expenses'), 'Piano Lessons')).toBeVisible();
	const year = await shownYear(page);
	await expect.poll(async () => ascending(await rowDates(section(page, 'Expenses'), year))).toBe(true);
	await page.getByRole('button', { name: 'Previous month' }).click();
	await page.getByRole('button', { name: 'Previous month' }).click();
	await expect(itemRow(section(page, 'Expenses'), 'Piano Lessons')).toBeVisible();
});

test.describe('grouped by category', () => {
	test.use({ groupBy: 'category' });

	test('puts each row in the section Monarch groups it by', async ({ page, open }) => {
		await open();
		await expect(itemRow(section(page, 'Other'), 'Piano Lessons')).toBeVisible();
		await expect(page.locator('[data-wingspan-statements]')).toHaveCount(0);
	});
});

test.describe('grouped by status', () => {
	test.use({ groupBy: 'status' });

	test("adds a status section Monarch doesn't have yet", async ({ page, open }) => {
		await open();
		const own = page.locator('[data-wingspan-section]');
		await expect(own.first()).toBeVisible();
		const names = await own.evaluateAll(cards => cards.map(card => card.getAttribute('data-testid')));
		expect(names.every(name => /recurring-section-card-(Overdue|Upcoming|Paid)$/.test(name ?? ''))).toBe(true);
	});
});
