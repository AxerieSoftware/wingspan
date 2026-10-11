import type { Page } from '@playwright/test';
import { APP, addRecurring, chooseMerchant, dismissFirstRunNotice, expect, section, test } from './fixtures';

const netChange = (page: Page) => page.getByRole('group', { name: 'Projected balances' }).getByTestId('projected-balances-net-change');
const netChangeAmount = async (page: Page) => {
	const text = (await netChange(page).textContent()) ?? '';
	return (text.startsWith('-') ? -1 : 1) * Number(text.replace(/net by.*/, '').replace(/[^\d.]/g, ''));
};

/** Adds the household's client payouts as weekly income from three of their deposits. */
async function addPayouts(page: Page, expectedAmount: string) {
	const dialog = await addRecurring(page, 'Income');
	await chooseMerchant(page, dialog, 'Fabrikam Payouts');
	const deposits = dialog.getByRole('checkbox', { name: /Fabrikam Payouts/ });
	for (const index of [0, 1, 2]) await deposits.nth(index).check();
	await dialog.getByRole('textbox', { name: 'Expected amount' }).fill(expectedAmount);
	return dialog;
}

test("income is added from Add recurring into Monarch's Income section, received when its deposit arrives", async ({ page, open }) => {
	await open();
	await dismissFirstRunNotice(page);
	const dialog = await addPayouts(page, '430');
	await expect(dialog.getByText('Select the deposits that belong to this income.')).toBeVisible();
	await expect(dialog.getByText('Paid into')).toBeVisible();
	await expect(dialog.getByRole('checkbox', { name: 'Any amount' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Add recurring', exact: true }).last().click();
	await expect(dialog).toBeHidden();

	await expect(
		section(page, 'Income')
			.getByRole('button', { name: /Fabrikam Payouts/ })
			.first()
	).toBeVisible();
	await expect(section(page, 'Income')).toContainText(/received/i);
	await expect(section(page, 'Expenses').getByRole('button', { name: /Fabrikam Payouts/ })).toHaveCount(0);

	await section(page, 'Income')
		.getByRole('button', { name: /Fabrikam Payouts/ })
		.first()
		.click();
	const details = page.getByRole('region', { name: 'Fabrikam Payouts details' });
	await expect(details).toContainText('“Fabrikam Payouts”');
	await expect(details).not.toContainText('any amount');
	await expect(details.locator('[data-external-id="recurring-stream-transaction-row"]').first()).toContainText(/\+\$[\d,]+\.\d\d/);
});

test("expected income raises Cash Flow's projected balance", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	await expect(netChange(page)).toHaveText(/net by/);
	const before = await netChangeAmount(page);

	await page.goto(`${APP}/recurring-v2/monthly`);
	await page.locator('[data-wingspan-row]').first().waitFor();
	const dialog = await addPayouts(page, '430');
	await dialog.getByRole('button', { name: 'Add recurring', exact: true }).last().click();
	await expect(dialog).toBeHidden();

	await page.goto(`${APP}/cash-flow`);
	await expect.poll(() => netChangeAmount(page)).toBeGreaterThan(before + 430);
});
