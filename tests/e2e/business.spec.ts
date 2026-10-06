import { APP, expect, itemRow, reloadExtension, section, test } from './fixtures';

/** Monarch's own row. Its accessible name starts with the item name and continues into the subtitle. */
const monarchRow = (page: import('@playwright/test').Page, sectionName: string, name: string) => section(page, sectionName).getByRole('button', { name: new RegExp(`^${name}`) });

const entitySwitch = (page: import('@playwright/test').Page) => page.locator('[data-wingspan-entity-switch]').getByRole('button');
const switchLabel = (page: import('@playwright/test').Page) => entitySwitch(page).locator('[data-mds="button-label"]');
const summaryLine = (page: import('@playwright/test').Page, line: 'expense' | 'income') => page.locator(`[data-wingspan-entity-summary="${line}"]`);

async function choose(page: import('@playwright/test').Page, ...names: string[]) {
	await entitySwitch(page).click();
	for (const name of names) await page.getByRole('menuitemcheckbox', { name }).click();
	await page.keyboard.press('Escape');
}

/** Toggles one option in Monarch's own business filter on Cash Flow. */
async function chooseOnCashFlow(page: import('@playwright/test').Page, name: string) {
	const trigger = page.locator('button:has([class*="BusinessEntityFilterButton__ButtonText"])');
	const options = page.locator('[class*="BusinessEntityFilterButton__PopoverContent"]');
	await trigger.click();
	await options.getByText(name, { exact: true }).click();
	// Monarch's popover closes from its button, not Escape.
	await trigger.click();
	await expect(options).toBeHidden();
}

test.describe("with Monarch's Plus plan", () => {
	test.beforeEach(({ household }) => household.addBusiness());

	test("Recurring gets a business filter like Cash Flow's, showing everything until one is chosen", async ({ page, open }) => {
		await open();
		await expect(switchLabel(page)).toHaveText('Business');
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
		await expect(monarchRow(page, 'Expenses', 'Rent')).toHaveCount(2);
		await expect(page.locator('[data-wingspan-entity-count]')).toHaveCount(0);
	});

	test("Household hides the business's items and counts and totals only the household's", async ({ page, open }) => {
		await open();
		await choose(page, 'Household');

		await expect(switchLabel(page)).toHaveText('Household only');
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

	test("a business shows only its own items, Monarch's and Wingspan's", async ({ page, open }) => {
		await open();
		await choose(page, 'Pottery Studio');

		await expect(switchLabel(page)).toHaveText('Pottery Studio');
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

	test("Cash Flow's projection starts from only the chosen household's or business's checking", async ({ page, open }) => {
		await open({ path: '/cash-flow', waitForRows: false });
		const netChange = page.getByRole('button', { name: /minus checking now/ });
		await expect(netChange).toHaveAccessibleName(/minus checking now \(\$10,610\.55\)/);
		await chooseOnCashFlow(page, 'Household');
		await expect(netChange).toHaveAccessibleName(/minus checking now \(\$4,210\.55\)/);
		await chooseOnCashFlow(page, 'Household');
		await chooseOnCashFlow(page, 'Pottery Studio');
		await expect(netChange).toHaveAccessibleName(/minus checking now \(\$6,400\.00\)/);
	});

	test("after an extension update disconnects Wingspan, Monarch's rows and totals are restored instead of left frozen", async ({ page, context, open }) => {
		await open();
		await choose(page, 'Household');
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeHidden();

		await reloadExtension(context);
		await page.getByRole('heading', { level: 1 }).click();

		await expect(page.getByText('Wingspan was updated or disabled. Reload the page to continue.')).toBeVisible();
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
		await expect(page.locator('[data-wingspan-entity-summary], [data-wingspan-entity-count], [data-wingspan-entity-switch]')).toHaveCount(0);
	});

	test('the choice persists across a reload', async ({ page, open }) => {
		await open();
		await choose(page, 'Household');
		await page.reload();
		await expect(switchLabel(page)).toHaveText('Household only');
		await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeHidden();
	});

	test('the household and each business keep their own cash and card settings', async ({ page, open }) => {
		await open();
		await choose(page, 'Pottery Studio');
		await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
		await expect(dialog.getByRole('combobox', { name: 'Settings for' })).toHaveText('Pottery Studio');
		await expect(dialog.getByRole('group', { name: 'Cash accounts' }).getByRole('combobox')).toHaveCount(1);
		await expect(dialog.getByRole('combobox', { name: 'Studio Checking counts as' })).toHaveText('Checking');
		await dialog.getByRole('textbox', { name: 'Always keep' }).fill('1000');
		await dialog.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(dialog).toBeHidden();

		await choose(page, 'Pottery Studio', 'Household');
		await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		const household = page.getByRole('dialog', { name: 'Cash and cards' });
		await expect(household.getByRole('combobox', { name: 'Settings for' })).toHaveText('Household');
		await expect(household.getByRole('switch', { name: 'Studio Checking' })).toHaveCount(0);
		await expect(household.getByRole('textbox', { name: 'Always keep' })).toHaveValue('$0.00');
	});

	test("on Cash Flow, Wingspan follows Monarch's business filter, and Recurring uses the same choice", async ({ page, open }) => {
		await open({ path: '/cash-flow', waitForRows: false });
		await chooseOnCashFlow(page, 'Pottery Studio');

		await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
		await expect(dialog.getByRole('combobox', { name: 'Settings for' })).toHaveText('Pottery Studio');
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

		await page.goto(`${APP}/recurring-v2/monthly`);
		await expect(switchLabel(page)).toHaveText('Pottery Studio');
	});
});

test("without Monarch's Plus plan (required for its business filter), there's no switch and nothing is hidden", async ({ page, open, household }) => {
	household.addBusiness({ hasPlus: false });
	await open();
	await expect(monarchRow(page, 'Expenses', 'Kiln Lease')).toBeVisible();
	await expect(page.locator('[data-wingspan-entity-switch]')).toHaveCount(0);
});
