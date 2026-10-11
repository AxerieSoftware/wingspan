import type { Locator, Page } from '@playwright/test';
import { addRecurring, chooseMerchant, expect, itemRow, type OpenOptions, section, test, useTheme } from './fixtures';

/*
 * The README's screenshots (assets/screenshots, at 2x), the site's feature pages' (site/src/assets/screenshots,
 * at 2x, light and dark) and the stores' (store/screenshots, 1280x800), all from the e2e tests' made-up household.
 */
const README = 'assets/screenshots';
const SITE = 'site/src/assets/screenshots';
const STORE = 'store/screenshots';
const THEMES = ['light', 'dark'] as const;

const projectedBalances = (page: Page) => page.getByRole('group', { name: 'Projected balances' });

type Open = (options?: OpenOptions) => Promise<void>;

/** Opens a page as a household that has used Wingspan before: otherwise the first open creates the hidden account and shows a notice about it. */
async function openAsReturning(page: Page, open: Open, path?: string) {
	await open({ path, waitForRows: false });
	await expect(page.getByText(/now saves to your Monarch account/)).toBeVisible();
	await page.reload();
}

async function openCashFlow(page: Page, open: Open) {
	await openAsReturning(page, open, '/cash-flow');
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
			await openAsReturning(page, open);
			await useTheme(page, theme);
			const expenses = section(page, 'Expenses');
			await expect(expenses.locator('[data-wingspan-row]').first()).toBeVisible();
			await siteShot(page, 'due-dates', theme, expenses);
		});

		test('manual bills', async ({ page, open }) => {
			await openAsReturning(page, open);
			await useTheme(page, theme);
			await itemRow(page, 'Piano Lessons').click();
			const details = page.getByRole('region', { name: 'Piano Lessons details' });
			await expect(details).toContainText('Transactions');
			await siteShot(page, 'manual-bills', theme, details);
		});

		test('expected income', async ({ page, open }) => {
			await openAsReturning(page, open);
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
			await openAsReturning(page, open);
			await useTheme(page, theme);
			const statements = page.locator('[data-wingspan-statements]');
			await expect(itemRow(statements, 'Rewards Card')).toBeVisible();
			await siteShot(page, 'card-payments', theme, statements);
		});

		test('free cash in the summary', async ({ page, open }) => {
			await openAsReturning(page, open);
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
			await openAsReturning(page, open, '/accounts/details/acct-hsa');
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
			await openAsReturning(page, open);
			await useTheme(page, theme);
			await page.locator('[data-wingspan-workspace-switcher]').getByRole('button').click();
			const menu = page.getByRole('menu');
			await expect(menu.getByRole('menuitem').first()).toBeVisible();
			await siteShot(page, 'workspaces', theme, menu, { band: true });
		});

		test('sidebar items', async ({ page, open }) => {
			await openAsReturning(page, open, '/settings/wingspan');
			await useTheme(page, theme);
			const group = page.getByRole('group', { name: 'Sidebar' });
			await group.getByRole('checkbox', { name: 'Investments' }).click();
			await group.getByRole('checkbox', { name: 'Invite a friend, get $30' }).click();
			await siteShot(page, 'sidebar-items', theme, group, { pad: 24 });
		});

		test('where Wingspan saves', async ({ page, open }) => {
			await openAsReturning(page, open, '/settings/display');
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
		await openAsReturning(page, open);
		await expect(page.locator('[data-wingspan-row]').first()).toBeVisible();
		await storeShot(page, '1-recurring');
	});

	test("a bill's details", async ({ page, open }) => {
		await openAsReturning(page, open);
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
