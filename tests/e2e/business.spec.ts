import type { Page } from '@playwright/test';
import { APP, expect, itemRow, reloadExtension, section, test } from './fixtures';

const BUSINESS_ID = 'biz-contoso';

/** Monarch's own row. Its accessible name starts with the item name and continues into the subtitle. */
const monarchRow = (page: Page, sectionName: string, name: string) => section(page, sectionName).getByRole('button', { name: new RegExp(`^${name}`) });

const switcher = (page: Page) => page.locator('[data-wingspan-workspace-switcher]').getByRole('button');
const summaryLine = (page: Page, line: 'expense' | 'income') => page.locator(`[data-wingspan-entity-summary="${line}"]`);
/** Monarch's own business filter button, as on Cash Flow. */
const monarchFilter = (page: Page) => page.locator('button:has([class*="BusinessEntityFilterButton__ButtonText"])');

/** Switches workspace from the sidebar, which reloads the page into it. */
async function switchTo(page: Page, name: string) {
	await switcher(page).click();
	await Promise.all([page.waitForEvent('load'), page.getByRole('menuitem', { name }).click()]);
}

/** Toggles one option in Monarch's own business filter on Cash Flow. */
async function chooseOnCashFlow(page: Page, name: string) {
	const options = page.locator('[class*="BusinessEntityFilterButton__PopoverContent"]');
	await monarchFilter(page).click();
	await options.getByText(name, { exact: true }).click();
	// Monarch's popover closes from its button, not Escape.
	await monarchFilter(page).click();
	await expect(options).toBeHidden();
}

test.describe("with Monarch's Plus plan", () => {
	test.beforeEach(({ household }) => household.addBusiness());

	test("the sidebar starts in Household, and Recurring shows and totals only the household's items", async ({ page, open }) => {
		await open();
		await expect(switcher(page)).toHaveAccessibleName('Workspace: Household');
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeHidden();
		// The household and the business both have a Rent; the business's is identified by its amount.
		await expect(monarchRow(page, 'Expenses', 'Rent')).toHaveCount(1);
		await expect(monarchRow(page, 'Expenses', 'Rent')).toContainText('$1,450.00');
		// Gym Dues has no Monarch account, so it counts as the household's in both the rows and the totals.
		await expect(monarchRow(page, 'Expenses', 'Gym Dues')).toBeVisible();
		await expect(section(page, 'Expenses').locator('[data-wingspan-entity-count]').first()).toHaveText('5');
		await expect(summaryLine(page, 'expense')).toContainText('$1,590 due');
		await expect(page.getByRole('button', { name: /inactive/ })).toBeHidden();
		await expect(itemRow(page.locator('[data-wingspan-statements]'), 'Store Card')).toBeVisible();
	});

	test("switching to a business shows only its own items, Monarch's and Wingspan's", async ({ page, open }) => {
		await open();
		await switchTo(page, 'Contoso Pottery');

		await expect(switcher(page)).toHaveAccessibleName('Workspace: Contoso Pottery');
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
		await expect(monarchRow(page, 'Expenses', 'Rent')).toHaveCount(1);
		await expect(monarchRow(page, 'Expenses', 'Rent')).toContainText('$900.00');
		await expect(monarchRow(page, 'Expenses', 'Gym Dues')).toBeHidden();
		await expect(section(page, 'Expenses').locator('[data-wingspan-entity-count]').first()).toHaveText('2');
		await expect(summaryLine(page, 'expense')).toContainText('$1,210 due');
		await expect(page.getByRole('button', { name: /Show 1 inactive/ })).toBeVisible();
		await expect(section(page, 'Income')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Piano Lessons', exact: true })).toHaveCount(0);
		await expect(page.locator('[data-wingspan-statements]')).toContainText('No card payments');
	});

	test("Monarch's pages open filtered to the workspace, from a link or a fresh page load", async ({ page, open }) => {
		await open();
		await switchTo(page, 'Contoso Pottery');

		await page.locator('a[data-external-id="nav-bar-link"][href="/transactions"]').click();
		await expect(page).toHaveURL(new RegExp(`/transactions\\?businessEntitySet=${BUSINESS_ID}`));

		await page.goto(`${APP}/cash-flow`);
		await expect(page).toHaveURL(new RegExp(`businessEntitySet=${BUSINESS_ID}`));
		await expect(monarchFilter(page)).toContainText('Contoso Pottery');
	});

	test("Accounts, which a link can't open on Household, gets Household picked in Monarch's own filter", async ({ page, open }) => {
		await open();
		await page.locator('a[data-external-id="nav-bar-link"][href="/accounts"]').click();
		await expect(monarchFilter(page)).toContainText('Household only');
	});

	test('Accounts gets Household picked when opened from Transactions, whose filter shows a moment longer', async ({ page, open, api }) => {
		await open();
		await page.locator('a[data-external-id="nav-bar-link"][href="/transactions"]').click();
		await expect(monarchFilter(page)).toContainText('Household only');
		api.monarchDelayMs = 800;
		await page.locator('a[data-external-id="nav-bar-link"][href="/accounts"]').click();
		const accountsFilter = page.locator('[data-external-id="accounts-header-controls"]').locator(monarchFilter(page));
		await expect(accountsFilter).toBeVisible();
		await expect(accountsFilter).toContainText('Household only');
	});

	test("Cash Flow's projection starts from only the workspace's checking, and follows Monarch's filter while it's changed there", async ({ page, open }) => {
		await open({ path: '/cash-flow', waitForRows: false });
		const netChange = page.getByRole('button', { name: /minus checking now/ });
		await expect(netChange).toHaveAccessibleName(/minus checking now \(\$4,210\.55\)/);

		await chooseOnCashFlow(page, 'Contoso Pottery');
		await expect(netChange).toHaveAccessibleName(/minus checking now \(\$10,610\.55\)/);
		// Changing Monarch's filter on the page doesn't switch the workspace.
		await expect(switcher(page)).toHaveAccessibleName('Workspace: Household');

		await switchTo(page, 'Contoso Pottery');
		await expect(netChange).toHaveAccessibleName(/minus checking now \(\$6,400\.00\)/);
		await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Cash and cards' }).getByRole('combobox', { name: 'Settings for' })).toHaveText('Contoso Pottery');
	});

	test("after an extension update disconnects Wingspan, Monarch's rows and totals are restored instead of left frozen", async ({ page, context, open }) => {
		await open();
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeHidden();

		await reloadExtension(context);
		await page.getByRole('heading', { level: 1 }).click();

		await expect(page.getByText('Wingspan was updated or disabled. Reload the page to continue.')).toBeVisible();
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
		await expect(page.locator('[data-wingspan-entity-summary], [data-wingspan-entity-count], [data-wingspan-workspace-switcher]')).toHaveCount(0);
	});

	test("turning workspaces off in Wingspan's settings removes the switcher and shows everything again, after a reload too", async ({ page, open }) => {
		await open();
		await page.goto(`${APP}/settings/wingspan`);
		const workspaces = page.getByRole('switch', { name: 'Keep the household and businesses separate' });
		await expect(workspaces).toBeChecked();
		await workspaces.click();
		await expect(switcher(page)).toHaveCount(0);

		await page.goto(`${APP}/recurring-v2/monthly`);
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
		await expect(monarchRow(page, 'Expenses', 'Rent')).toHaveCount(2);
		await expect(switcher(page)).toHaveCount(0);

		await page.goto(`${APP}/settings/wingspan`);
		await page.getByRole('switch', { name: 'Keep the household and businesses separate' }).click();
		await expect(switcher(page)).toHaveAccessibleName('Workspace: Household');
	});

	test("pages Monarch can't filter by business say so in their header, and pages it can don't", async ({ page, open }) => {
		await open();
		await expect(page.locator('[data-wingspan-header-note]')).toHaveCount(0);

		await page.goto(`${APP}/goals/savings`);
		await expect(page.locator('[data-wingspan-header-note]').getByRole('button')).toHaveAccessibleName(
			"Not filtered by workspace. This page can't be filtered by workspace, so it shows all of them together."
		);
	});

	test('the household and each business keep their own cash and card settings', async ({ page, open }) => {
		await open();
		await switchTo(page, 'Contoso Pottery');
		await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
		await expect(dialog.getByRole('combobox', { name: 'Settings for' })).toHaveText('Contoso Pottery');
		await expect(dialog.getByRole('group', { name: 'Cash accounts' }).getByRole('combobox')).toHaveCount(1);
		await expect(dialog.getByRole('combobox', { name: 'Contoso Checking counts as' })).toHaveText('Checking');
		await dialog.getByRole('textbox', { name: 'Always keep' }).fill('1000');
		await dialog.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(dialog).toBeHidden();

		await switchTo(page, 'Household');
		await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		const householdDialog = page.getByRole('dialog', { name: 'Cash and cards' });
		await expect(householdDialog.getByRole('combobox', { name: 'Settings for' })).toHaveText('Household');
		await expect(householdDialog.getByRole('switch', { name: 'Contoso Checking' })).toHaveCount(0);
		await expect(householdDialog.getByRole('textbox', { name: 'Always keep' })).toHaveValue('$0.00');
	});
});

test("without Monarch's Plus plan (required for its business filter), there's no switcher and nothing is hidden", async ({ page, open, household }) => {
	household.addBusiness({ hasPlus: false });
	await open();
	await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
	await expect(page.locator('[data-wingspan-workspace-switcher]')).toHaveCount(0);
});
