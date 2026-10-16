import type { Page } from '@playwright/test';
import { expect, monarchRow, type OpenOptions, test } from './fixtures';

const LOAN_PATH = '/accounts/details/acct-loan';
const PAYMENT_PATH = '/transactions/tx-auto-loan';
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

test("a manual loan's page shows when its balance was entered, and asks for its payment to be linked to take payments off the estimate", async ({ page, open }) => {
	const card = await openLoan(page, open);

	await expect(card).toContainText(/Balance entered \w{3} \d{1,2}, \d{4}: \$9,120\.00\./);
	// Five days of interest since then, and no payment tracked.
	await expect(card).toContainText('About $9,128.12 today, with interest since.');
	await expect(card).toContainText('choose this loan under Pays toward');
});

test("after a payment, Update balance starts at the balance plus interest since, minus the payment, and enters what's saved in Monarch", async ({ page, household, open }) => {
	household.addLoanPayment();
	household.linkLoanPayment();
	const card = await openLoan(page, open);
	await expect(card).toContainText('About $8,788.12 today, with interest since, minus $340.00 paid since.');
	await expect(card.locator('[data-mds="banner-description"]')).toHaveText('A $340.00 payment posted since this balance was entered. Update the balance once your servicer shows it.');

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

test("choosing a loan under Pays toward in a Monarch expense's panel takes its payments off the loan's estimate", async ({ page, household, open }) => {
	household.addLoanPayment();
	await open();

	await monarchRow(page, 'Auto Loan').click();
	const paysToward = page.getByRole('combobox', { name: 'Pays toward' });
	await expect(paysToward).toHaveText('None');
	await paysToward.click();
	await page.getByRole('option', { name: 'Auto Loan' }).click();
	await expect(paysToward).toHaveText('Auto Loan');

	const card = await openLoan(page, open);
	await expect(card).toContainText('minus $340.00 paid since.');
	await expect(card).not.toContainText('Pays toward');
});

test('Pays toward shows for an item Monarch added after Wingspan loaded its data, like one just merged', async ({ page, household, open }) => {
	await open();
	household.addLoanPayment();

	await page.evaluate(() => {
		history.pushState({}, '', '/recurring-v2/monthly/9001');
		dispatchEvent(new PopStateEvent('popstate'));
	});

	await expect(page.getByRole('combobox', { name: 'Pays toward' })).toHaveText('None');
});

test("Pays toward isn't offered for Monarch's income", async ({ page, open }) => {
	await open();
	await monarchRow(page, 'Paycheck').first().click();
	await expect(page.getByRole('button', { name: /^Due day/ })).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Pays toward' })).toHaveCount(0);
});

test("a linked payment's transaction details offer to update the loan's balance, until a newer balance is entered", async ({ page, household, open }) => {
	household.addLoanPayment();
	household.linkLoanPayment();
	await open({ path: PAYMENT_PATH, waitForRows: false });

	const banner = page.locator('[data-wingspan-transaction-banner]');
	await expect(banner).toContainText(/This payment goes toward Auto Loan, whose balance was last entered \w+ \d{1,2}, \d{4}\./);
	await expect(banner.locator('[data-wingspan-mark]')).toHaveCount(1);
	await banner.getByRole('button', { name: 'Update balance' }).click();
	const dialog = page.getByRole('dialog', { name: 'Update balance' });
	await expect(dialog.getByRole('textbox', { name: 'Balance' })).toHaveValue('$8,788.12');
	await dialog.getByRole('button', { name: 'Save' }).click();

	// The page reloads with the balance entered today, after the payment, so there's nothing left to update.
	await expect(page.getByRole('dialog', { name: 'Transaction details' })).toBeVisible();
	await expect(banner).toHaveCount(0);
});

test("an unlinked payment's transaction details don't offer a balance update", async ({ page, household, open }) => {
	household.addLoanPayment();
	await open({ path: PAYMENT_PATH, waitForRows: false });

	await expect(page.getByRole('dialog', { name: 'Transaction details' })).toBeVisible();
	await expect(page.locator('[data-wingspan-transaction-banner]')).toHaveCount(0);
});

test("a manual loan's row on Accounts says a linked payment posted since its balance was entered", async ({ page, household, open }) => {
	household.addLoanPayment();
	household.linkLoanPayment();
	await open({ path: '/accounts', waitForRows: false });

	const loanRow = page.locator('a[href$="/accounts/details/acct-loan"]');
	await expect(loanRow.locator('[data-wingspan-account-note]')).toHaveText('Payment posted, update balance');
});

test('Accounts in the sidebar counts the loans with a linked payment to update, on every page', async ({ page, household, open }) => {
	household.addLoanPayment();
	household.linkLoanPayment();
	await open({ path: '/cash-flow', waitForRows: false });

	await expect(page.locator('a[href="/accounts"] [data-wingspan-sidebar-badge]')).toContainText('1');
});

test("Accounts doesn't note a payment that isn't linked to the loan", async ({ page, household, open }) => {
	household.addLoanPayment();
	await open({ path: '/accounts', waitForRows: false });

	// The Loans group's interest note needs the same data from Monarch, so once it shows, a payment note would have too.
	await expect(page.locator('[data-wingspan-account-group-note]')).toContainText('a month in interest');
	await expect(page.locator('[data-wingspan-account-note]')).toHaveCount(0);
	await expect(page.locator('[data-wingspan-sidebar-badge]')).toHaveCount(0);
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
