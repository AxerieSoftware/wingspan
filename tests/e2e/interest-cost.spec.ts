import type { Page } from '@playwright/test';
import { expect, type OpenOptions, test } from './fixtures';

const LOAN_PATH = '/accounts/details/acct-loan';
// The auto loan owes $9,120 at 6.5%: $592.80 a year, $49.40 a month and $1.62 a day.
const DAILY = '$1.62';
const MONTHLY = '$49';

const loanCard = (page: Page) => page.getByRole('group', { name: 'Interest', exact: true });

const openLoan = async (page: Page, open: (options?: OpenOptions) => Promise<void>) => {
	await open({ path: LOAN_PATH, waitForRows: false });
	await expect(loanCard(page)).toBeVisible();
	return loanCard(page);
};

test("a loan's page shows what its interest costs a day, a month and a year at its rate", async ({ page, open }) => {
	const card = await openLoan(page, open);

	await expect(card).toContainText(`${DAILY} a day`);
	await expect(card).toContainText(`${MONTHLY} a month · $593 a year, at 6.5% on $9,120.00`);
});

test("a manual loan's page shows when its balance was entered, and asks for a Loan payment to take payments off the estimate", async ({ page, open }) => {
	const card = await openLoan(page, open);

	await expect(card).toContainText(/Balance entered \w{3} \d{1,2}, \d{4}: \$9,120\.00\./);
	// Five days of interest since then, and no payment tracked.
	await expect(card).toContainText('About $9,128.12 today, with interest since.');
	await expect(card).toContainText('Add a Loan payment for this loan');
});

test("after a payment, Update balance starts at the balance plus interest since, minus the payment, and enters what's saved in Monarch", async ({ page, household, open }) => {
	household.addLoanPayment();
	const card = await openLoan(page, open);
	await expect(card).toContainText('About $8,788.12 today, with interest since, minus $340.00 paid since.');

	await card.getByRole('button', { name: 'Update balance' }).click();
	const dialog = page.getByRole('dialog', { name: 'Update balance' });
	const balance = dialog.getByRole('textbox', { name: 'Balance' });
	await expect(balance).toHaveValue('$8,788.12');
	await balance.fill('8790.5');
	await dialog.getByRole('button', { name: 'Save' }).click();

	// Monarch's page reloads to show the new balance, entered today.
	await expect(loanCard(page)).toContainText('on $8,790.50');
	await expect(loanCard(page)).toContainText('About $8,790.50 today');
});

test('a loan payment is added on Recurring with the loan it pays toward', async ({ page, household, open }) => {
	household.addLoanPayment();
	await open();

	const row = page.locator('[data-wingspan-row]').filter({ hasText: 'Auto Loan' });
	await expect(row).toContainText('Loan');
	await row.getByText('Auto Loan', { exact: true }).click();
	await expect(page.getByText('Fabrikam Auto', { exact: false }).first()).toBeVisible();
});

test("Cash Flow's totals end with what debt interest costs a month and a day", async ({ page, open }) => {
	await open({ path: '/cash-flow', waitForRows: false });
	const interest = page.getByTestId('interest-cost-card');

	await expect(interest).toContainText(MONTHLY);
	await expect(interest).toContainText('Interest a month');
	await expect(page.locator('[style*="grid-area: summary"] [data-external-id="flex-container-base"] > :last-child')).toContainText('Interest a month');
	await expect(page.locator('[style*="grid-area: summary"] [data-external-id="flex-container-base"] > :nth-last-child(2)')).toContainText('Loans paid down');
});

test("Accounts' Loans group says what its loans cost in interest a month, and cards paid in full add none", async ({ page, open }) => {
	await open({ path: '/accounts', waitForRows: false });

	const notes = page.locator('[data-wingspan-account-group-note]');
	await expect(notes).toHaveCount(1);
	await expect(notes).toContainText(`${MONTHLY} a month in interest`);
});

test("a card charged interest lately adds what it costs at its APR to Accounts' Credit Cards group", async ({ page, household, open }) => {
	household.addCardInterest();
	await open({ path: '/accounts', waitForRows: false });

	const notes = page.locator('[data-wingspan-account-group-note]');
	await expect(notes).toHaveCount(2);
	// The rewards card owes $412.80 at 22.9%.
	await expect(notes.filter({ hasText: '$8 a month in interest' })).toHaveCount(1);
	await expect(notes.filter({ hasText: `${MONTHLY} a month in interest` })).toHaveCount(1);
});
