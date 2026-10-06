import { addRecurring, chooseMerchant, expect, itemRow, section, seedSampleItems, test } from './fixtures';

const STATUS_SELECT = '[data-external-id="add-recurring-group-status-select"]';
const MONARCH_MERCHANT = '[data-external-id="add-recurring-group-merchant-field"]';

test("Monarch's Add recurring dialog keeps its own fields until one of Wingspan's types is chosen", async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Add recurring' }).click();
	await page.getByRole('menuitem', { name: 'Add manually' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add recurring' });
	await expect(dialog.getByRole('combobox', { name: 'Type' })).toHaveText('Recurring merchant');
	await expect(dialog.locator(MONARCH_MERCHANT)).toBeVisible();

	await dialog.getByRole('combobox', { name: 'Type' }).click();
	await page.getByRole('option', { name: 'Bill' }).click();
	await expect(dialog.locator(MONARCH_MERCHANT)).toBeHidden();
	await expect(dialog.locator(STATUS_SELECT)).toBeHidden();
	await expect(dialog.locator('[data-wingspan-add-fields]').getByRole('combobox', { name: 'Merchant' })).toBeVisible();

	await dialog.getByRole('combobox', { name: 'Type' }).click();
	await page.getByRole('option', { name: 'Recurring merchant' }).click();
	await expect(dialog.locator(MONARCH_MERCHANT)).toBeVisible();
	await expect(dialog.locator(STATUS_SELECT)).toBeVisible();
	await expect(dialog.locator('[data-wingspan-add-fields]')).toBeHidden();
});

test("Wingspan's fields use Monarch's layout: the picker's filters on one line, and no empty footer next to Monarch's buttons", async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Add recurring' }).click();
	await page.getByRole('menuitem', { name: 'Add manually' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add recurring' });
	const footer = dialog.locator('[data-external-id="add-recurring-group-footer"]');
	await expect(dialog.locator('[data-wingspan-add-choice]')).toBeVisible();
	await expect(dialog.locator('[data-wingspan-add-footer]')).toBeHidden();
	const [cancelBox, footerBox] = [await footer.locator('[data-mds="dialog-close"]').boundingBox(), await footer.boundingBox()];
	expect((footerBox?.x ?? 0) + (footerBox?.width ?? 0) - ((cancelBox?.x ?? 0) + (cancelBox?.width ?? 0))).toBeGreaterThan(100);

	await dialog.getByRole('combobox', { name: 'Type' }).click();
	await page.getByRole('option', { name: 'Bill' }).click();
	const filtersBox = await dialog.getByText('Filters', { exact: true }).locator('xpath=../..').boundingBox();
	expect(filtersBox?.height).toBeLessThan(60);
});

test("a bill is added from Monarch's Add recurring dialog, with details inferred from its payments", async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Bill');
	await expect(dialog.getByRole('button', { name: 'Add recurring', exact: true }).last()).toBeDisabled();

	await chooseMerchant(page, dialog, 'Corner Cafe');
	await dialog
		.getByRole('checkbox', { name: /Corner Cafe/ })
		.first()
		.check();
	const add = dialog.getByRole('button', { name: 'Add recurring', exact: true }).last();
	await expect(add).toBeEnabled();
	await expect(dialog.getByRole('textbox', { name: 'Name' }).last()).toHaveValue(/Corner Cafe/i);
	await add.click();

	await expect(dialog).toBeHidden();
	await expect(
		section(page, 'Expenses')
			.getByRole('button', { name: /Corner Cafe/i })
			.last()
	).toBeVisible();
});

test("a row opens its details next to the list, and closing them shows Monarch's summary again", async ({ page, open }) => {
	await open();
	await itemRow(page, 'Piano Lessons').click();
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await expect(details).toBeVisible();
	await expect(details).toContainText('Amount history');
	await expect(details).toContainText('Transactions');
	await expect(itemRow(page, 'Piano Lessons')).toHaveAttribute('data-selected', 'true');
	await details.getByRole('button', { name: /close/i }).click();
	await expect(details).toBeHidden();
	await expect(page.locator('[data-external-id="recurring-summary-sidebar"]')).toBeVisible();
});

test("the row's ⋯ menu can edit and remove the item", async ({ page, open }) => {
	await open();
	const row = itemRow(page, 'Piano Lessons');
	await row.getByRole('button', { name: 'More options' }).click();
	await page.getByRole('menuitem', { name: 'Edit' }).click();
	const dialog = page.getByRole('dialog', { name: 'Edit Piano Lessons' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	// Closing returns focus to the row's ⋯ button, which opened it.
	await expect(row.getByRole('button', { name: 'More options' })).toBeFocused();

	await row.getByRole('button', { name: 'More options' }).click();
	await page.getByRole('menuitem', { name: 'Remove' }).click();
	await page.getByRole('alertdialog', { name: 'Remove Piano Lessons?' }).getByRole('button', { name: 'Remove' }).click();
	await expect(itemRow(page, 'Piano Lessons')).toHaveCount(0);
	// The row and its menu are gone, so focus moves to an adjacent row instead of the top of the page.
	await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName)).not.toBe('BODY');
});

test("closing a row's details with Escape returns focus to the row", async ({ page, open }) => {
	await open();
	const row = itemRow(page, 'Piano Lessons');
	await row.focus();
	await page.keyboard.press('Enter');
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await details.getByRole('button', { name: 'Close detail panel' }).focus();
	await page.keyboard.press('Escape');

	await expect(details).toBeHidden();
	await expect(row).toBeFocused();
});

test("cancelling a removal returns focus to the row's ⋯ button", async ({ page, open }) => {
	await open();
	const menuButton = itemRow(page, 'Piano Lessons').getByRole('button', { name: 'More options' });
	await menuButton.click();
	await page.getByRole('menuitem', { name: 'Remove' }).click();
	await page.getByRole('alertdialog', { name: 'Remove Piano Lessons?' }).getByRole('button', { name: 'Cancel' }).click();

	await expect(menuButton).toBeFocused();
});

test('cancelling a removal from the editor keeps the editor open', async ({ page, open }) => {
	await open();
	const row = itemRow(page, 'Piano Lessons');
	await row.getByRole('button', { name: 'More options' }).click();
	await page.getByRole('menuitem', { name: 'Edit' }).click();
	const editor = page.getByRole('dialog', { name: 'Edit Piano Lessons' });
	await editor.getByRole('button', { name: 'Remove' }).click();
	const confirm = page.getByRole('alertdialog', { name: 'Remove Piano Lessons?' });
	await page.keyboard.press('Escape');
	await expect(confirm).toBeHidden();
	await expect(editor).toBeVisible();
	await editor.getByRole('button', { name: 'Cancel' }).click();
	await expect(row).toBeVisible();
});

test('pressing ⋯ again closes its menu', async ({ page, open }) => {
	await open();
	const more = itemRow(page, 'Piano Lessons').getByRole('button', { name: 'More options' });
	await more.click();
	await expect(page.getByRole('menu')).toBeVisible();
	await more.click();
	await expect(page.getByRole('menu')).toHaveCount(0);
});

test("choosing Card payment switches the form to a card's fields", async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Card payment');
	await expect(dialog.getByRole('combobox', { name: 'Card' })).toBeVisible();
	await dialog.getByRole('combobox', { name: 'Card' }).click();
	await page.getByRole('option', { name: 'Rewards Card (...1234)' }).click();
	await expect(dialog.getByRole('textbox', { name: 'Name' }).last()).toHaveValue('Rewards Card (...1234)');
	// Picking another card renames the item, since its name was still the card's name.
	await dialog.getByRole('combobox', { name: 'Card' }).click();
	await page.getByRole('option', { name: 'Flex Card (...5678)' }).click();
	await expect(dialog.getByRole('textbox', { name: 'Name' }).last()).toHaveValue('Flex Card (...5678)');
	await expect(dialog.getByRole('button', { name: 'Add recurring', exact: true }).last()).toBeEnabled();
});

test("a card that already has a card payment can't get a second one", async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Card payment');
	await dialog.getByRole('combobox', { name: 'Card' }).click();
	await page.getByRole('option', { name: 'Rewards Card (...1234)' }).click();
	await expect(dialog.getByRole('button', { name: 'Add recurring', exact: true }).last()).toBeDisabled();
});

test("Escape closes the panel's ⋯ menu first, then the panel", async ({ page, open }) => {
	await open();
	await itemRow(page, 'Piano Lessons').click();
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await details.getByRole('button', { name: 'More options' }).click();
	await expect(page.getByRole('menu')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(details).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(details).toBeHidden();
});

test('changing the due day in the panel updates the item', async ({ page, open }) => {
	await open();
	await itemRow(page, 'Piano Lessons').click();
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await details.getByRole('button', { name: 'Due day' }).click();
	await page.getByRole('radio', { name: '5th of the month', exact: true }).click();
	await expect(details.getByRole('button', { name: 'Due day' })).toHaveText('5th of the month');
	await expect(itemRow(page, 'Piano Lessons')).toContainText(/Due \w{3} 5/);
});

test("the editor fills in Monarch's transactions when they arrive after it opens", async ({ page, household, api }) => {
	api.delayMs = 1500;
	await seedSampleItems(page, household);
	await page.goto('https://app.monarch.com/recurring-v2/monthly');
	const dialog = await addRecurring(page, 'Bill');
	await chooseMerchant(page, dialog, 'Corner Cafe');
	await expect(dialog.getByRole('checkbox', { name: /Corner Cafe/ })).toBeVisible();
});

test('the 31st is shown as the last day of the month', async ({ page, open }) => {
	await open();
	await itemRow(page, 'Piano Lessons').click();
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await details.getByRole('button', { name: 'Due day' }).click();
	await expect(page.getByText('29–31 fall on the last day in shorter months.')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(details).toBeVisible();
	await details.getByRole('button', { name: 'Due day' }).click();
	await page.getByRole('radio', { name: 'Last day of the month' }).click();
	await expect(details.getByRole('button', { name: 'Due day' })).toHaveText('Last day of the month');
});

test("a bill's Any amount checkbox toggles from the box or its label, and amount filters are formatted as dollars", async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Bill');
	const minimumAmount = dialog.getByRole('textbox', { name: 'Minimum amount' });
	await minimumAmount.fill('12');
	await minimumAmount.blur();
	await expect(minimumAmount).toHaveValue('$12.00');
	await dialog.getByRole('textbox', { name: 'Transaction contains' }).fill('Maple Music');
	const anyAmount = dialog.getByRole('checkbox', { name: 'Any amount' });
	await anyAmount.click();
	await expect(anyAmount).toBeChecked();
	await dialog.getByText('Any amount', { exact: true }).click();
	await expect(anyAmount).not.toBeChecked();
});

test("the picker filters by category and shows Monarch's match card as an overlay on its list", async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Bill');
	await chooseMerchant(page, dialog, 'Maple Music');
	await expect(dialog.getByRole('combobox', { name: 'Category' })).toBeEnabled();
	await expect(dialog.getByText('Lessons', { exact: true }).first()).toBeVisible();

	await dialog.getByRole('checkbox').first().click();
	const matchCard = dialog.getByRole('region', { name: 'Match found' });
	await expect(matchCard).toBeVisible();
	await expect(matchCard.locator('xpath=..').locator('li[aria-hidden="true"]')).toHaveCount(1);
	await expect(dialog).toBeVisible();
});

test('choosing Custom frequency shows its every-and-unit fields, even before they change', async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Bill');
	await dialog.getByRole('combobox', { name: 'Frequency' }).click();
	await page.getByRole('option', { name: 'Custom…' }).click();
	await expect(dialog.getByRole('combobox', { name: 'Frequency' })).toHaveText('Custom…');
	await expect(dialog.getByRole('spinbutton', { name: 'Every' })).toBeVisible();
	await dialog.getByRole('combobox', { name: 'Repeats every' }).click();
	await page.getByRole('option', { name: 'weeks' }).click();
	await expect(dialog.getByRole('combobox', { name: 'Frequency' })).toHaveText('Custom…');
});

test('typing on the Merchant button searches merchants instead of picking the first match', async ({ page, open }) => {
	await open();
	const dialog = await addRecurring(page, 'Bill');
	const merchantButton = dialog.locator('button[aria-label^="Merchant: "]');
	await merchantButton.focus();
	await page.keyboard.type('map');

	const search = page.getByPlaceholder('Search merchants');
	await expect(search).toBeFocused();
	await expect(search).toHaveValue('map');
	await expect(page.getByRole('option')).toHaveText(['Maple Music']);
	await expect(merchantButton).toContainText('Choose a merchant');

	await page.keyboard.type('le');
	await expect(search).toHaveValue('maple');
	await page.keyboard.press('Enter');
	await expect(merchantButton).toContainText('Maple Music');
});
