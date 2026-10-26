import type { Page } from '@playwright/test';
import { APP, expect, gridArea, test } from './fixtures';

const card = (page: Page) => page.getByRole('group', { name: 'Projected balances' });
const stat = (page: Page, label: string) => card(page).locator('[data-external-id="stat-item"]').filter({ hasText: label }).locator('span.h-9');
const amountOf = async (page: Page, label: string) => Number((await stat(page, label).textContent())?.replace(/[^\d.-]/g, ''));

test("projected balances show below Cash Flow's bar chart, above the date and View menu, as a stat bar and a chart", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	await expect(card(page)).toBeVisible();
	await expect(gridArea(page, 'chart').locator('[data-wingspan-cash-flow-section]')).toHaveCount(1);
	for (const label of ['Free cash today', 'Monthly surplus', 'Credit left', 'Checking runs out']) await expect(card(page).getByTestId('projected-balances-stat-bar')).toContainText(label);
	await expect(card(page).getByRole('img', { name: /^Checking from / })).toBeVisible();
});

test('credit left shows the total limit of the included cards and the lowest utilization', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const creditLeft = card(page).locator('[data-external-id="stat-item"]').filter({ hasText: 'Credit left' });
	await expect(creditLeft).toContainText(/of \$[\d,]+\.\d\d · \d{1,3}% utilization/);
});

test("the header shows checking's net change over the chart's range", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const netChange = card(page).getByTestId('projected-balances-net-change');
	await expect(netChange).toHaveText(/^[+-]\$[\d,]+\.\d\dnet by \w{3} \d{1,2}, \d{4}$/);
	const sign = (await netChange.textContent())?.startsWith('-') ? -1 : 1;
	const amount = sign * Number((await netChange.textContent())?.replace(/net by.*/, '').replace(/[^\d.]/g, ''));
	// The household's paychecks are more than its bills and spending.
	expect(amount).toBeGreaterThan(0);
});

test("the chart shows each day's balance on hover, beside the pointer rather than under it", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const chart = card(page).getByRole('img', { name: /^Checking from / });
	const chartBox = await chart.boundingBox();
	if (!chartBox) throw new Error('No chart');

	for (const across of [0.3, 0.95]) {
		const pointer = { x: chartBox.x + chartBox.width * across, y: chartBox.y + chartBox.height / 2 };
		await page.mouse.move(pointer.x, pointer.y);
		const tooltip = card(page).locator('[data-theme="dark"]');
		await expect(tooltip).toContainText(/\w{3} \d{1,2}, \d{4}\s*-?\$[\d,]+\.\d\d/);
		const tooltipBox = await tooltip.boundingBox();
		if (!tooltipBox) throw new Error('No tooltip');
		expect(pointer.x < tooltipBox.x || pointer.x > tooltipBox.x + tooltipBox.width).toBe(true);
	}
});

test('the chart marks and labels the lowest checking gets, with only that one dot', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const chart = card(page).getByRole('img', { name: /^Checking from / });
	const lowest = (await chart.getAttribute('aria-label'))?.match(/lowest (\$[\d,.]+)/)?.[1];
	await expect(chart.locator('text', { hasText: /^Low \$[\d,.]+K? · / })).toHaveCount(1);
	await expect(chart.locator('circle')).toHaveCount(1);
	expect(lowest).toBeTruthy();
});

test("the chart projects as far ahead as Cash Flow's selected month, quarter or year", async ({ page, open }) => {
	const daysOut = (days: number) => {
		const date = Temporal.Now.plainDateISO().add({ days }).toString();
		return new RegExp(
			`^[+-]\\$[\\d,]+\\.\\d\\dnet by ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))}$`
		);
	};
	const netChange = () => card(page).getByTestId('projected-balances-net-change');

	await open({ path: '/cash-flow?timeframe=quarter', waitForRows: false });
	await expect(netChange()).toHaveText(daysOut(90));

	await page.goto(`${APP}/cash-flow?timeframe=year`);
	await expect(netChange()).toHaveText(daysOut(365));
	await expect(stat(page, 'Free cash today')).toHaveText(/\$/);
});

test('projected balances still show when Cash Flow shows the Sankey diagram', async ({ page, open }) => {
	await open({ path: '/cash-flow?breakdown=category&sankey=category&timeframe=month&view=sankey', waitForRows: false });
	await expect(page.locator('[data-external-id="cash-flow-sankey-card"]')).toBeVisible();
	await expect(card(page)).toBeVisible();
});

test('the minimum checking balance is subtracted from free cash', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	await expect(stat(page, 'Free cash today')).toHaveText(/\$/);
	const before = await amountOf(page, 'Free cash today');
	expect(before).toBeGreaterThan(1000);

	await card(page).getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	await dialog.getByRole('textbox', { name: 'Always keep' }).fill('1000');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();

	await expect.poll(() => amountOf(page, 'Free cash today')).toBeCloseTo(before - 1000, 2);
});

test("transactions are read without asking Monarch for each one's recurring item, which is slow on Monarch's side", async ({ open, apiLog }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const transactionQueries = apiLog.wingspanQueries.filter(query => query.includes('allTransactions'));
	expect(transactionQueries.length).toBeGreaterThan(0);
	for (const query of transactionQueries) expect(query).not.toContain('recurrenceGroup');
	expect(apiLog.operations).toContain('wingspan_GetRecurringLinks');
});

test("free cash is split into money set aside for Monarch goals and money that's actually free", async ({ page, open }) => {
	// This month's remaining 150, plus next month's 250 once the window (to the next payday or 30 days out) reaches next month.
	await open({ path: '/cash-flow', waitForRows: false });
	const freeCash = card(page).locator('[data-external-id="stat-item"]').filter({ hasText: 'Free cash today' });
	await expect(freeCash).toContainText(/\$(150|400)\.00 to goals · \$[\d,]+\.\d\d truly free/);
	const free = await amountOf(page, 'Free cash today');
	const goals = freeCash.getByRole('button', { name: /to goals$/ });
	const promised = Number((await goals.textContent())?.replace(/[^\d.]/g, ''));
	const trulyFree = Number((await freeCash.getByText(/truly free/).textContent())?.replace(/[^\d.]/g, ''));
	expect(trulyFree).toBeCloseTo(free - promised, 2);

	await goals.click();
	await expect(page).toHaveURL(/\/goals/);
});

test("going over a card's limit or below the minimum checking balance is flagged", async ({ page, open }) => {
	await open({ path: '/cash-flow?timeframe=year', waitForRows: false });
	await card(page).getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	await dialog.getByRole('combobox', { name: 'High-Yield Savings counts as' }).click();
	await page.getByRole('option', { name: 'Not counted' }).click();
	await dialog.getByRole('textbox', { name: 'Always keep' }).fill('40000');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();

	await expect(stat(page, 'Credit left')).toHaveText('$0.00');
	await expect(card(page).locator('[data-external-id="stat-item"]').filter({ hasText: 'Credit left' })).toContainText(/maxes out \w{3} \d{1,2}/);
	await expect(card(page).locator('[data-external-id="stat-item"]').filter({ hasText: 'Checking runs out' })).toContainText(/Drops below the amount you keep \w{3} \d{1,2}/);
	await expect(card(page).getByTestId('projected-balances-stat-bar')).toContainText(/Short from/);
});

test("when Monarch can't be reached, the card shows an error and Try again loads it once Monarch is reachable", async ({ page, open, api }) => {
	api.failure = 'network';
	await open({ path: '/cash-flow', waitForRows: false });
	await expect(card(page)).toContainText("Couldn't load from Monarch, so there's nothing to project.", { timeout: 20_000 });

	api.failure = null;
	await card(page).getByRole('button', { name: 'Try again' }).click();
	await expect(card(page).getByRole('img', { name: /^Checking from / })).toBeVisible();
	await expect(card(page)).not.toContainText("Couldn't load");
});

test("loans paid down shows after Monarch's Savings rate as how much the loans went down this month and its share of income", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const paydown = page.getByTestId('loans-paid-down-card');
	const savingsRate = gridArea(page, 'summary').locator('[data-external-id="deprecated-statistic-card"]').filter({ hasText: 'Savings rate' });

	await expect(savingsRate.locator('xpath=following-sibling::*[1]')).toContainText('Loans paid down');
	// The auto loan's balance drops $340 each month.
	await expect(paydown).toContainText('$340');
	await expect(paydown).toContainText(/\$340Loans paid down · \d+% of income/);
});

test('loans paid down covers each month of a past quarter', async ({ page, open }) => {
	const quarterAgo = Temporal.Now.plainDateISO().subtract({ months: 3 });
	const quarterStart = `${quarterAgo.year}-${String(Math.floor((quarterAgo.month - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;

	await open({ path: `/cash-flow?timeframe=quarter&date=${quarterStart}`, waitForRows: false });

	await expect(page.getByTestId('loans-paid-down-card')).toContainText('$1,020');
});

test('free cash explains how pending money counts', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const freeCash = card(page).locator('[data-external-id="stat-item"]').filter({ hasText: 'Free cash today' });

	await expect(freeCash.getByRole('button', { name: /Pending purchases count as already spent; pending deposits count once they clear\./ })).toHaveCount(1);
});

test("this month's bars extend, dashed, to where the projection ends the month, and its tooltip adds the projected totals", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const bars = page.locator('[data-wingspan-cash-flow-chart-overlay]').getByRole('img', { name: /^Projected by / });
	await expect(bars).toHaveAttribute('aria-label', /^Projected by \w{3} \d{1,2}: \$[\d,]+ more income and \$[\d,]+ more expenses$/);
	await expect(bars.locator('rect[stroke-dasharray]').first()).toBeVisible();
	const [moreIncome, moreExpenses] = [...((await bars.getAttribute('aria-label')) ?? '').matchAll(/\$([\d,]+)/g)].map(match => Number(match[1]?.replaceAll(',', '')));

	const chart = page.locator('.recharts-surface').first();
	const box = await chart.boundingBox();
	const monthLabel = chart.locator('.recharts-xAxis-tick-labels text').last();
	await page.mouse.move((box?.x ?? 0) + Number(await monthLabel.getAttribute('x')), (box?.y ?? 0) + 120);
	const tooltip = page.locator('.recharts-tooltip-wrapper');
	const rows = tooltip.locator('[data-external-id="chart-tooltip-data-row"], [data-wingspan-cash-flow-tooltip-rows] > div');
	const amount = async (label: string) =>
		Number(
			(
				await rows
					.filter({ hasText: new RegExp(`^${label}`) })
					.locator('span')
					.last()
					.textContent()
			)?.replace(/[^\d.]/g, '')
		);
	await expect(tooltip.getByText('Projected expenses:')).toBeVisible();

	// Each amount is rounded to the dollar on its own, so a total can be a dollar off the sum of its rounded parts.
	expect(Math.abs((await amount('Projected income:')) - (await amount('Income:')) - (moreIncome ?? 0))).toBeLessThanOrEqual(1);
	expect(Math.abs((await amount('Projected expenses:')) - (await amount('Expenses:')) - (moreExpenses ?? 0))).toBeLessThanOrEqual(1);
});

test("the projection isn't drawn on Quarterly or Yearly", async ({ page, open }) => {
	await open({ path: '/cash-flow?timeframe=year', waitForRows: false });
	await expect(page.locator('.recharts-surface').first()).toBeVisible();
	await expect(page.locator('[data-wingspan-cash-flow-chart-overlay]')).toHaveCount(0);
});

test('with an earlier month picked, the projection still extends this month at the end of the chart', async ({ page, open }) => {
	const lastMonth = Temporal.Now.plainDateISO().toPlainYearMonth().subtract({ months: 1 });
	await open({ path: `/cash-flow?date=${lastMonth.toString()}-01&timeframe=month`, waitForRows: false });

	await expect(page.locator('[data-wingspan-cash-flow-chart-overlay]').getByRole('img', { name: /^Projected by / })).toBeVisible();
});
