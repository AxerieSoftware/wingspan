import { expect, itemRow, test } from './fixtures';

const summary = (page: import('@playwright/test').Page) => page.locator('[data-external-id="recurring-summary-sidebar"]');

test("the summary's Statements line shows how much of this month's statements is paid and how much is left, like Expenses", async ({ page, open }) => {
	await open();
	const statements = summary(page).locator('[data-wingspan-summary-statements]');
	await expect(statements.getByRole('meter', { name: 'Statements paid' })).toBeVisible();
	await expect(statements).toContainText(/\$[\d,]+ paid\s*\$[\d,]+ left/);
	await expect(summary(page).getByText('Coming soon')).toBeHidden();
});

test("the summary shows today's free cash and links to the projection on Cash Flow", async ({ page, open }) => {
	await open();
	await expect(summary(page)).toContainText(/Free cash today\s*\$[\d,]+\.\d\d/);
	await summary(page)
		.getByRole('button', { name: /See projected balances/ })
		.click();
	await expect(page).toHaveURL(/\/cash-flow/);
	await expect(page.getByRole('group', { name: 'Projected balances' })).toBeVisible();
});

test('each unpaid card shows how much checking can pay on its due date', async ({ page, open }) => {
	await open();
	await expect(itemRow(page.locator('[data-wingspan-statements]'), 'Store Card')).toContainText('Can pay in full');
});

test('a minimum balance higher than checking has leaves card minimum payments uncovered, with a warning', async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	await dialog.getByRole('textbox', { name: 'Always keep' }).fill('50000');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(itemRow(page.locator('[data-wingspan-statements]'), 'Store Card')).toContainText(/Can pay \$0\.00 of \$[\d,]+\.\d\d min/);
});

test('cash accounts, cards and the minimum balance are set in a modal', async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	const role = (name: string) => dialog.getByRole('combobox', { name: `${name} counts as` });
	await expect(role('Everyday Checking')).toHaveText('Checking');
	await expect(role('High-Yield Savings')).toHaveText('Reserve');
	await expect(dialog.getByRole('switch', { name: 'Rewards Card (...1234)' })).toHaveAttribute('aria-checked', 'true');

	await dialog.getByRole('textbox', { name: 'Always keep' }).fill('2500');
	await role('High-Yield Savings').click();
	await page.getByRole('option', { name: 'Not counted' }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const reopened = page.getByRole('dialog', { name: 'Cash and cards' });
	await expect(reopened.getByRole('textbox', { name: 'Always keep' })).toHaveValue('$2,500.00');
	await expect(reopened.getByRole('combobox', { name: 'High-Yield Savings counts as' })).toHaveText('Not counted');
});

test('the household can choose how far ahead free cash stays safe, and the choice is saved', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const card = page.getByRole('group', { name: 'Projected balances' });
	await card.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	await expect(dialog.getByRole('combobox', { name: 'Keep free cash safe for' })).toHaveText('30 days');
	await dialog.getByRole('combobox', { name: 'Keep free cash safe for' }).click();
	await page.getByRole('option', { name: '90 days' }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();

	await card.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Cash and cards' }).getByRole('combobox', { name: 'Keep free cash safe for' })).toHaveText('90 days');
});

test('cards are used in the order the household sets', async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	const cards = dialog.getByRole('group', { name: /^Cards counted as debt/ });
	const names = () => cards.locator('[data-mds="switch-label"]').allTextContents();
	expect(await names()).toEqual(['Rewards Card (...1234)', 'Flex Card (...5678)']);
	await expect(cards.getByRole('button', { name: 'Move Rewards Card (...1234) up' })).toBeHidden();

	await cards.getByRole('button', { name: 'Move Flex Card (...5678) up' }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	expect(await names()).toEqual(['Flex Card (...5678)', 'Rewards Card (...1234)']);
});

test("a card without a credit limit, APR or minimum payment in Monarch is flagged, with a note on how it's handled", async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const cards = page.getByRole('dialog', { name: 'Cash and cards' }).getByRole('group', { name: /^Cards counted as debt/ });
	await expect(
		cards.getByRole('button', {
			name: /No credit limit, so Wingspan won't borrow on this card.*No APR, so it's paid down after the cards that have one.*No minimum payment, so Wingspan estimates one/
		})
	).toHaveCount(1);
	await expect(cards.getByRole('button', { name: /^No / })).toHaveCount(1);
});

test('only shows for the current month', async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Next month' }).click();
	await expect(page.getByRole('button', { name: 'Edit checking accounts and amount kept' })).toHaveCount(0);
});

test('keyboard focus stays in the cash and cards dialog', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	await expect(dialog).toBeVisible();
	for (let press = 0; press < 40; press++) {
		await page.keyboard.press('Tab');
		// Base UI's focus guards sit just outside the popup and send focus back in.
		expect(await dialog.evaluate(dialogEl => dialogEl.contains(document.activeElement) || document.activeElement?.hasAttribute('data-base-ui-focus-guard'))).toBe(true);
	}
});

test('a minimum balance higher than checking has is flagged without blocking Save', async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	await page.getByRole('button', { name: 'Edit cash and cards', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
	await dialog.getByRole('textbox', { name: 'Always keep' }).fill('10000000');
	await expect(dialog.getByText(/This is more than checking has now \(.*\), so there's no free cash until checking reaches it\./)).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
});
