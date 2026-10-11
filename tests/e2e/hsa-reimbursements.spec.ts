import type { Page } from '@playwright/test';
import { expect, type OpenOptions, test } from './fixtures';

const HSA_PATH = '/accounts/details/acct-hsa';

const openHsa = async (page: Page, open: (options?: OpenOptions) => Promise<void>) => {
	await open({ path: HSA_PATH, waitForRows: false });
	const card = page.getByRole('group', { name: 'HSA reimbursements' });
	await expect(card).toBeVisible();
	return card;
};

test("an HSA's page totals the tagged expenses left to reimburse, oldest first, and flags missing receipts", async ({ page, household, open }) => {
	household.addHsaExpenses();

	const card = await openHsa(page, open);

	await expect(card.getByText('$597.85', { exact: true })).toBeVisible();
	await expect(card.getByText('to reimburse from your HSA · 2 expenses · 1 without a receipt')).toBeVisible();
	const rows = card.getByRole('list', { name: 'Expenses to reimburse' }).getByRole('link');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('Contoso Dental');
	await expect(rows.nth(0)).toContainText('Crown, EOB claim 0001');
	await expect(rows.nth(0)).toContainText('Receipt');
	await expect(rows.nth(1)).toContainText('Fabrikam Clinic');
	await expect(rows.nth(1)).toContainText('No receipt');
});

test('reimbursed expenses, from any year, are totalled in a section that opens on request', async ({ page, household, open }) => {
	household.addHsaExpenses();
	const card = await openHsa(page, open);

	const reimbursed = card.getByRole('button', { name: /Reimbursed · 1 expense/ });
	await expect(reimbursed).toContainText('$42.10');
	await expect(card.getByRole('list', { name: 'Reimbursed expenses' })).toHaveCount(0);

	await reimbursed.click();

	await expect(card.getByRole('list', { name: 'Reimbursed expenses' }).getByRole('link')).toHaveText([/Contoso Pharmacy/]);
});

test('an expense opens its transaction in Monarch, where its receipt and notes are kept', async ({ page, household, open }) => {
	household.addHsaExpenses();
	const card = await openHsa(page, open);

	await card.getByRole('link', { name: /^Fabrikam Clinic, .*, no receipt$/ }).click();

	await expect(page).toHaveURL(/\/transactions\/tx-clinic$/);
	await expect(card).toHaveCount(0);
});

test('tags named differently are chosen once, then the expenses show', async ({ page, household, open }) => {
	household.addHsaExpenses({ toReimburseName: 'Medical – Pay back', reimbursedName: 'Medical – Paid back' });
	const card = await openHsa(page, open);
	await expect(card).toContainText('Tag the medical expenses you paid yourself');

	await card.getByRole('button', { name: 'Choose tags' }).click();
	const dialog = page.getByRole('dialog', { name: 'HSA tags' });
	await dialog.getByRole('combobox', { name: 'Expenses to reimburse' }).click();
	await page.getByRole('option', { name: 'Medical – Pay back' }).click();
	await expect(page.getByRole('listbox')).toHaveCount(0);
	await dialog.getByRole('combobox', { name: 'Reimbursed expenses' }).click();
	await page.getByRole('option', { name: 'Medical – Paid back' }).click();
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(dialog).toHaveCount(0);
	await expect(card.getByText('$597.85', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('group', { name: 'HSA reimbursements' }).getByText('$597.85', { exact: true })).toBeVisible();
});

test("other accounts' pages don't get the card", async ({ page, household, open }) => {
	household.addHsaExpenses();

	await open({ path: '/accounts/details/acct-savings', waitForRows: false });

	await expect(page.getByText('Transactions', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('group', { name: 'HSA reimbursements' })).toHaveCount(0);
});
