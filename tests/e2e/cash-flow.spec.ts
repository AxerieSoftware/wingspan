import type { Page } from '@playwright/test';
import { APP, expect, test } from './fixtures';

const card = (page: Page) => page.getByRole('group', { name: 'Projected balances' });
const stat = (page: Page, label: string) => card(page).locator('[data-external-id="stat-item"]').filter({ hasText: label }).locator('span.h-9');
const amountOf = async (page: Page, label: string) => Number((await stat(page, label).textContent())?.replace(/[^\d.-]/g, ''));

test("projected balances show below Cash Flow's bar chart, above the date and View menu, as a stat bar and a chart", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	await expect(card(page)).toBeVisible();
	await expect(page.locator('[style*="grid-area: chart"] [data-wingspan-cash-flow-section]')).toHaveCount(1);
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
	const box = await chart.boundingBox();
	if (!box) throw new Error('No chart');

	for (const across of [0.3, 0.95]) {
		const pointer = { x: box.x + box.width * across, y: box.y + box.height / 2 };
		await page.mouse.move(pointer.x, pointer.y);
		const tooltip = card(page).locator('[data-theme="dark"]');
		await expect(tooltip).toContainText(/\w{3} \d{1,2}, \d{4}\s*-?\$[\d,]+\.\d\d/);
		const tip = await tooltip.boundingBox();
		if (!tip) throw new Error('No tooltip');
		expect(pointer.x < tip.x || pointer.x > tip.x + tip.width).toBe(true);
	}
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
