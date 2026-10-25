import type { Locator, Page } from '@playwright/test';
import { addRecurring, chooseMerchant, expect, gridArea, itemRow, monarchRow, type OpenOptions, section, test, useTheme } from './fixtures';

/*
 * The README's screenshots (assets/screenshots, at 2x), the site's feature pages' (site/src/assets/screenshots,
 * at 2x, light and dark) and the stores' (store/screenshots, 1280x800), all from the e2e tests' made-up household.
 */
const README = 'assets/screenshots';
const SITE = 'site/src/assets/screenshots';
const STORE = 'store/screenshots';
const THEMES = ['light', 'dark'] as const;

const DETAIL_PANEL = '[data-external-id="recurrence-group-detail-panel-view"]';
const projectedBalances = (page: Page) => page.getByRole('group', { name: 'Projected balances' });

type Open = (options?: OpenOptions) => Promise<void>;

/** Opens a page without waiting for Wingspan's rows, which only Recurring has. */
async function openPage(open: Open, path?: string) {
	await open({ path, waitForRows: false });
}

async function openCashFlow(page: Page, open: Open) {
	await openPage(open, '/cash-flow');
	await expect(projectedBalances(page).getByRole('img', { name: /^Checking from / })).toBeVisible();
}

async function storeShot(page: Page, name: string) {
	await page.mouse.move(0, 0);
	await expect(page.locator("[data-wingspan-toasts] [role='status'], [data-wingspan-toasts] [role='alert']")).toHaveCount(0);
	await page.screenshot({ path: `${STORE}/${name}.png`, animations: 'disabled' });
}

async function scrollToTop(target: Locator) {
	await target.evaluate(element => element.scrollIntoView({ block: 'start' }));
}

for (const theme of THEMES) {
	test(`README: projected balances, ${theme}`, async ({ page, open }) => {
		await openCashFlow(page, open);
		await useTheme(page, theme);
		const card = projectedBalances(page);
		await expect(card.getByRole('img', { name: /^Checking from / })).toBeVisible();
		await card.scrollIntoViewIfNeeded();
		await page.mouse.move(0, 0);
		await card.screenshot({ path: `${README}/projected-balances-${theme}.png`, animations: 'disabled' });
	});
}

/**
 * Shoots `target`. For a menu, which sits outside the button that opened it, `band` shoots the page's top band down to the menu;
 * `pad` adds the surroundings to a target that has no padding of its own.
 */
async function siteShot(page: Page, name: string, theme: string, target: Locator, options: { band?: boolean; pad?: number } = {}) {
	await page.mouse.move(0, 0);
	await expect(page.locator("[data-wingspan-toasts] [role='status'], [data-wingspan-toasts] [role='alert']")).toHaveCount(0);
	const path = `${SITE}/${name}-${theme}.png`;
	if (!options.band && !options.pad) {
		await target.screenshot({ path, animations: 'disabled' });
		return;
	}
	if (!options.band) await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
	const box = await target.boundingBox();
	const viewport = page.viewportSize();
	if (!box || !viewport) throw new Error(`Nothing to shoot for ${name}`);
	const pad = options.pad ?? 0;
	const clip = options.band
		? { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, box.y + box.height + 32) }
		: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad };
	await page.screenshot({ path, animations: 'disabled', clip });
}

for (const theme of THEMES) {
	test.describe(`site, ${theme}`, () => {
		test('due dates', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const expenses = section(page, 'Expenses');
			await expect(expenses.locator('[data-wingspan-row]').first()).toBeVisible();
			await siteShot(page, 'due-dates', theme, expenses);
		});

		test('manual bills', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			await itemRow(page, 'Piano Lessons').click();
			const details = page.getByRole('region', { name: 'Piano Lessons details' });
			await expect(details).toContainText('Transactions');
			await siteShot(page, 'manual-bills', theme, details);
		});

		test('manual bill editor', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const dialog = await addRecurring(page, 'Bill');
			await chooseMerchant(page, dialog, 'Maple Music');
			await dialog
				.getByRole('checkbox', { name: /Maple Music/ })
				.first()
				.check();
			await expect(dialog.getByRole('textbox', { name: 'Transaction contains' })).not.toHaveValue('');
			await siteShot(page, 'manual-bill-editor', theme, dialog);
		});

		test('manual bill fields', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const dialog = await addRecurring(page, 'Bill');
			await chooseMerchant(page, dialog, 'Maple Music');
			await dialog
				.getByRole('checkbox', { name: /Maple Music/ })
				.first()
				.check();
			await dialog.getByRole('textbox', { name: 'Transaction contains' }).scrollIntoViewIfNeeded();
			await siteShot(page, 'manual-bill-fields', theme, dialog);
		});

		test('card payment editor', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const dialog = await addRecurring(page, 'Card payment');
			await dialog.getByRole('combobox', { name: 'Card' }).click();
			await page.getByRole('option', { name: 'Not in Monarch' }).click();
			await dialog.getByRole('textbox', { name: 'Name' }).fill('Store Card');
			await dialog.getByRole('textbox', { name: 'Payment description contains' }).fill('4410');
			await dialog.getByRole('textbox', { name: 'Typical payment' }).fill('88.40');
			await dialog.getByRole('textbox', { name: 'Typical payment' }).blur();
			await siteShot(page, 'card-payment-editor', theme, dialog);
		});

		test('pays toward', async ({ page, household, open }) => {
			household.addLoanPayment();
			household.linkLoanPayment();
			await openPage(open);
			await useTheme(page, theme);
			await monarchRow(page, 'Auto Loan').click();
			await expect(page.getByRole('combobox', { name: 'Pays toward' })).toHaveText('Auto Loan');
			await siteShot(page, 'pays-toward', theme, page.locator(DETAIL_PANEL).locator('[data-external-id="meta-row"]').first().locator('..'), { pad: 16 });
		});

		test('payment update banner', async ({ page, household, open }) => {
			household.addLoanPayment();
			household.linkLoanPayment();
			await openPage(open, '/transactions/tx-auto-loan');
			await useTheme(page, theme);
			const banner = page.locator('[data-wingspan-transaction-banner]');
			await expect(banner).toContainText('This payment goes toward Auto Loan');
			await siteShot(page, 'payment-update-banner', theme, banner, { pad: 12 });
		});

		test('sync status', async ({ page, household, open }) => {
			household.stallAccountSync('acct-flex', 19);
			await page.setViewportSize({ width: 1440, height: 900 });
			await openPage(open, '/transactions');
			await useTheme(page, theme);
			await page
				.locator('[data-wingspan-header-note]')
				.getByRole('button', { name: /last account sync/ })
				.click();
			const popover = page.getByRole('dialog', { name: 'Account syncs' });
			await expect(popover).toBeVisible();
			await siteShot(page, 'sync-status', theme, popover, { band: true });
		});

		test('loans paid down and interest cost on Cash Flow', async ({ page, open }) => {
			// Wide enough for the row of totals, which Wingspan's two cards make six.
			await page.setViewportSize({ width: 1600, height: 900 });
			await openCashFlow(page, open);
			await useTheme(page, theme);
			const summary = gridArea(page, 'summary');
			await expect(summary.getByTestId('loans-paid-down-card')).toContainText('$340');
			await expect(summary.getByTestId('interest-cost-card')).toContainText('$49');
			await siteShot(page, 'loans-paid-down', theme, summary, { pad: 16 });
		});

		test('interest cost on Accounts', async ({ page, household, open }) => {
			household.addCardInterest();
			await openPage(open, '/accounts');
			await useTheme(page, theme);
			const loans = page.locator('[data-external-id="account-group-card"]').filter({ hasText: 'Auto Loan' });
			await expect(loans.locator('[data-wingspan-account-group-note]')).toContainText('a month in interest');
			await siteShot(page, 'interest-cost-accounts', theme, loans, { pad: 16 });
		});

		test("a loan's interest", async ({ page, household, open }) => {
			household.addLoanPayment();
			household.linkLoanPayment();
			await openPage(open, '/accounts/details/acct-loan');
			await useTheme(page, theme);
			const card = page.getByRole('group', { name: 'Interest', exact: true });
			await expect(card).toContainText('paid since');
			await card.scrollIntoViewIfNeeded();
			await siteShot(page, 'loan-interest', theme, card);
		});

		test('update balance', async ({ page, household, open }) => {
			household.addLoanPayment();
			household.linkLoanPayment();
			await openPage(open, '/accounts/details/acct-loan');
			await useTheme(page, theme);
			await page.getByRole('group', { name: 'Interest', exact: true }).getByRole('button', { name: 'Update balance' }).click();
			const dialog = page.getByRole('dialog', { name: 'Update balance' });
			await expect(dialog.getByRole('button', { name: 'Use estimate, $8,788.00' })).toBeVisible();
			await siteShot(page, 'update-balance', theme, dialog);
		});

		test('HSA tags', async ({ page, household, open }) => {
			household.addHsaExpenses();
			await openPage(open, '/accounts/details/acct-hsa');
			await useTheme(page, theme);
			await page.getByRole('group', { name: 'HSA reimbursements' }).getByRole('button', { name: 'Choose tags' }).click();
			const dialog = page.getByRole('dialog', { name: 'HSA tags' });
			await expect(dialog).toBeVisible();
			await siteShot(page, 'hsa-tags', theme, dialog);
		});

		test('expected income', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const dialog = await addRecurring(page, 'Income');
			await chooseMerchant(page, dialog, 'Fabrikam Payouts');
			const deposits = dialog.getByRole('checkbox', { name: /Fabrikam Payouts/ });
			for (const index of [0, 1, 2, 3]) await deposits.nth(index).check();
			await dialog.getByRole('textbox', { name: 'Expected amount' }).fill('430');
			await dialog.getByRole('button', { name: 'Add recurring', exact: true }).last().click();
			await expect(dialog).toBeHidden();
			await itemRow(section(page, 'Income'), 'Fabrikam Payouts').click();
			const details = page.getByRole('region', { name: 'Fabrikam Payouts details' });
			await expect(details).toContainText('Transactions');
			await siteShot(page, 'expected-income', theme, details);
		});

		test('card payments', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const statements = page.locator('[data-wingspan-statements]');
			await expect(itemRow(statements, 'Rewards Card')).toBeVisible();
			await siteShot(page, 'card-payments', theme, statements);
		});

		test('free cash in the summary', async ({ page, open }) => {
			await openPage(open);
			await useTheme(page, theme);
			const summary = page.locator('[data-external-id="recurring-summary-sidebar"]');
			await expect(summary).toContainText(/Free cash today\s*\$[\d,]+\.\d\d/);
			await siteShot(page, 'free-cash', theme, summary);
		});

		test('projected balances', async ({ page, open }) => {
			await openCashFlow(page, open);
			await useTheme(page, theme);
			const card = projectedBalances(page);
			await expect(card.getByRole('img', { name: /^Checking from / })).toBeVisible();
			await card.scrollIntoViewIfNeeded();
			await siteShot(page, 'projected-balances', theme, card);
		});

		test('HSA reimbursements', async ({ page, household, open }) => {
			household.addHsaExpenses();
			await openPage(open, '/accounts/details/acct-hsa');
			await useTheme(page, theme);
			const card = page.getByRole('group', { name: 'HSA reimbursements' });
			await card.getByRole('button', { name: /^Reimbursed/ }).click();
			await expect(card.getByText('Contoso Pharmacy')).toBeVisible();
			await card.scrollIntoViewIfNeeded();
			await siteShot(page, 'hsa-reimbursements', theme, card);
		});

		test('cash and cards', async ({ page, open }) => {
			await openCashFlow(page, open);
			await useTheme(page, theme);
			await projectedBalances(page).getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
			const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
			await expect(dialog).toBeVisible();
			await siteShot(page, 'cash-and-cards', theme, dialog);
		});

		test('retail receipt sync', async ({ page, open }) => {
			await open({ path: '/transactions/receipts', waitForRows: false });
			await useTheme(page, theme);
			const sync = page.locator('[data-wingspan-retail-sync]').getByRole('button', { name: 'Sync retailer' });
			await sync.click();
			const menu = page.getByRole('menu');
			await expect(menu.getByRole('menuitem')).toHaveText(['Walmart', 'Costco']);
			await siteShot(page, 'receipt-sync', theme, menu, { band: true });
		});

		test('workspaces', async ({ page, open, household }) => {
			household.addBusiness();
			await openPage(open);
			await useTheme(page, theme);
			await page.locator('[data-wingspan-workspace-switcher]').getByRole('button').click();
			const menu = page.getByRole('menu');
			await expect(menu.getByRole('menuitem').first()).toBeVisible();
			await siteShot(page, 'workspaces', theme, menu, { band: true });
		});

		test('sidebar items', async ({ page, open }) => {
			await openPage(open, '/settings/wingspan');
			await useTheme(page, theme);
			const group = page.getByRole('group', { name: 'Sidebar' });
			await group.getByRole('checkbox', { name: 'Investments' }).click();
			await group.getByRole('checkbox', { name: 'Invite a friend, get $30' }).click();
			await siteShot(page, 'sidebar-items', theme, group, { pad: 24 });
		});

		test('month-end projection', async ({ page, open }) => {
			await openPage(open, '/cash-flow');
			await useTheme(page, theme);
			await expect(page.locator('[data-wingspan-cash-flow-chart-overlay]').getByRole('img', { name: /^Projected by / })).toBeVisible();
			const chart = page.locator('.recharts-wrapper').first();
			const box = await chart.boundingBox();
			const monthLabel = chart.locator('.recharts-xAxis-tick-labels text').last();
			await page.mouse.move((box?.x ?? 0) + Number(await monthLabel.getAttribute('x')), (box?.y ?? 0) + 120);
			await expect(page.locator('.recharts-tooltip-wrapper').getByText('Projected expenses:')).toBeVisible();
			await page.screenshot({ path: `${SITE}/month-end-projection-${theme}.png`, animations: 'disabled', clip: box ?? undefined });
		});

		test('spending averages', async ({ page, open }) => {
			await openPage(open, '/plan');
			await useTheme(page, theme);
			await page.locator('[data-goal-row-id="cat-groceries"] input[name=budgeted]').click({ timeout: 30_000 });
			const popover = page.locator('[data-external-id="budget-amount-popover"]');
			await expect(popover.locator('[data-wingspan-budget-averages]').getByText('12-month average')).toBeVisible();
			await siteShot(page, 'spending-averages', theme, popover);
		});

		test("a category's average per month", async ({ page, open }) => {
			await openPage(open, `/categories/cat-groceries?date=${new Date().getFullYear()}-01-01&timeframe=year`);
			await useTheme(page, theme);
			const summary = page.locator('[data-external-id="summary-card-row"]').first().locator('..');
			await expect(summary.getByText('Average per month')).toBeVisible();
			await siteShot(page, 'category-average', theme, summary, { pad: 16 });
		});

		test('HSA spending on Budget', async ({ page, household, open }) => {
			household.addHsaExpenses();
			household.addHsaCardPurchase();
			await openPage(open, '/plan');
			await useTheme(page, theme);
			const medical = page.locator('[data-goal-row-id="cat-medical"]').first();
			await expect(medical.locator('[data-wingspan-budget-row-note]')).toBeVisible({ timeout: 30_000 });
			await siteShot(page, 'hsa-budget', theme, medical, { pad: 12 });
		});

		test('goal planner', async ({ page, household, open }) => {
			household.addSavingsGoals();
			// The planner's rows and chart need a desktop-wide page to show whole.
			await page.setViewportSize({ width: 1680, height: 1800 });
			await openPage(open, '/goals/savings');
			await useTheme(page, theme);
			const planner = page.getByRole('group', { name: 'Goal planner' });
			const cruise = planner.getByRole('textbox', { name: 'Contoso Cruise, extra a month' });
			await cruise.fill('200');
			await cruise.blur();
			await expect(planner.getByRole('img', { name: /Contoso Cruise: saved by month/ })).toBeVisible();
			await scrollToTop(planner);
			await siteShot(page, 'goal-planner', theme, planner);
		});

		test('order items', async ({ page, household, open }) => {
			household.addSyncedOrder();
			await openPage(open, '/transactions/tx-order-1');
			await useTheme(page, theme);
			const card = page.getByRole('group', { name: 'Items in this order' });
			await card.getByRole('combobox', { name: 'Fabrikam Espresso Maker, category' }).click();
			await page.getByRole('option', { name: 'Coffee Shops' }).click();
			await expect(card).toContainText('Saves as 3 splits');
			await siteShot(page, 'order-items', theme, card);
		});

		test('transactions to review', async ({ page, household, open }) => {
			household.markForReview(3);
			await openPage(open, '/cash-flow');
			await useTheme(page, theme);
			const link = page.locator('[data-external-id="side-bar"] a[href="/transactions"]');
			await expect(link.locator('[data-wingspan-sidebar-badge]')).toContainText('3');
			await siteShot(page, 'transactions-to-review', theme, link, { pad: 12 });
		});

		test('where Wingspan saves', async ({ page, open }) => {
			await openPage(open, '/settings/display');
			await useTheme(page, theme);
			await page.locator('[data-wingspan-card]').getByRole('link', { name: 'General' }).click();
			const group = page.getByRole('group', { name: 'Where Wingspan saves' });
			await expect(group).toBeVisible();
			await siteShot(page, 'where-wingspan-saves', theme, group, { pad: 24 });
		});
	});
}

test.describe('store', () => {
	// Monarch's sidebars fit at 1600px wide, and 0.8x zoom scales that to the stores' 1280x800.
	test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 0.8 });

	test('recurring with statements and due dates', async ({ page, open }) => {
		await openPage(open);
		await expect(page.locator('[data-wingspan-row]').first()).toBeVisible();
		await storeShot(page, '1-recurring');
	});

	test("a bill's details", async ({ page, open }) => {
		await openPage(open);
		await itemRow(page, 'Piano Lessons').click();
		await expect(page.getByRole('region', { name: 'Piano Lessons details' })).toContainText('Transactions');
		await storeShot(page, '2-bill-details');
	});

	test('projected balances', async ({ page, open }) => {
		await openCashFlow(page, open);
		await scrollToTop(projectedBalances(page));
		await storeShot(page, '3-projected-balances');
	});

	test('cash and cards', async ({ page, open }) => {
		await openCashFlow(page, open);
		await projectedBalances(page).getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Cash and cards' })).toBeVisible();
		await storeShot(page, '4-cash-and-cards');
	});
});
