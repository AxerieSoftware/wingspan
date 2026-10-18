import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { DemoOverlay, installDemoOverlay } from './demoOverlay';
import { expect, itemRow, monarchRow, section, test } from './fixtures';
import { ScreencastRecorder } from './screencastRecorder';

/*
 * The stores' demo video, for shoppers and for reviewers without a Monarch account: about a minute through the
 * listing's sections in the e2e tests' made-up household, each feature outlined and captioned with the page it's on.
 * `npm run videos` writes it to site/public/videos, at 1080p, with the feature pages' clips. It needs ffmpeg.
 */

const VIDEO_PATH = 'site/public/videos/wingspan-demo.mp4';
const POSTER_PATH = 'site/public/videos/wingspan-demo.jpg';
/** Partway into the title card, once it's fully drawn. */
const POSTER_AT_SECONDS = 1;
/** Long enough to read a caption and see what it points at. */
const READING_PAUSE_MS = 3200;
const TITLE_CARD_MS = 2800;
/** The walk visits every feature with a pause at each, well past Playwright's default 30 seconds. */
const WALK_TIMEOUT_MS = 4 * 60_000;

// Chrome's screencast captures at the viewport's size, whatever the scale, so 1080p needs a 1080p viewport.
test.use({ viewport: { width: 1920, height: 1080 } });

const pause = (page: Page, milliseconds = READING_PAUSE_MS) => page.waitForTimeout(milliseconds);

test('a walk through Wingspan for the stores', async ({ page, household, open }, testInfo) => {
	test.setTimeout(WALK_TIMEOUT_MS);
	household.addBusiness();
	household.addLoanPayment();
	household.linkLoanPayment();
	household.addHsaExpenses();
	household.stallAccountSync('acct-flex', 6);
	await page.addInitScript(installDemoOverlay, { zoom: 1, hasTitleCard: true });
	const demo = new DemoOverlay(page);
	const recorder = new ScreencastRecorder(join(testInfo.outputDir, 'frames'), { width: 1920, height: 1080 });

	// Recording starts once the page has loaded behind the title card, so Monarch's loading logo never shows.
	await open({ waitForRows: false });
	await expect(page.getByText(/now saves to your Monarch account/)).toBeVisible();
	await page.reload();
	await expect(page.locator('[data-wingspan-row]').first()).toBeVisible();
	await recorder.start(page);
	await pause(page, TITLE_CARD_MS);
	await demo.hideTitleCard();

	await demo.explain('Recurring', 'Every bill and subscription gets a due date, sorted by date', section(page, 'Expenses'));
	await pause(page);

	const statements = page.locator('[data-wingspan-statements]');
	await demo.clear();
	await statements.scrollIntoViewIfNeeded();
	await demo.explain('Recurring', "Each card's statement, and whether checking can cover it", statements);
	await pause(page);

	await demo.click(itemRow(page, 'Piano Lessons'));
	const billDetails = page.getByRole('region', { name: 'Piano Lessons details' });
	await expect(billDetails).toContainText('Transactions');
	await demo.explain('Recurring', 'Bills without a fixed date stay owed until the payment clears', billDetails);
	await pause(page);
	await page.keyboard.press('Escape');

	await demo.click(monarchRow(page, 'Auto Loan'));
	const paysToward = page.getByRole('combobox', { name: 'Pays toward' });
	await expect(paysToward).toHaveText('Auto Loan');
	await demo.explain('Recurring', "Link a loan's payment to the loan it pays down", paysToward);
	await pause(page);
	await page.keyboard.press('Escape');

	await demo.click(page.getByRole('link', { name: 'Cash Flow' }));
	const projectedBalances = page.getByRole('group', { name: 'Projected balances' });
	await expect(projectedBalances.getByRole('img', { name: /^Checking from / })).toBeVisible();
	await projectedBalances.scrollIntoViewIfNeeded();
	await demo.explain('Cash Flow', 'See checking day by day, and how much is free to spend today', projectedBalances);
	await pause(page);
	await demo.click(projectedBalances.getByRole('button', { name: 'Edit cash and cards', exact: true }));
	const cashAndCards = page.getByRole('dialog', { name: 'Cash and cards' });
	await expect(cashAndCards).toBeVisible();
	await demo.explain('Cash Flow', 'Choose your checking, your reserves and which cards to lean on', cashAndCards);
	await pause(page);
	await demo.click(cashAndCards.getByRole('button', { name: 'Cancel' }));

	await demo.goTo('/accounts/details/acct-loan');
	const interest = page.getByRole('group', { name: 'Interest', exact: true });
	await expect(interest.getByRole('button', { name: 'Update balance' })).toBeVisible();
	await interest.scrollIntoViewIfNeeded();
	await demo.explain('Loans', 'See what a loan costs in interest each day, month and year', interest);
	await pause(page);
	await demo.click(interest.getByRole('button', { name: 'Update balance' }));
	const updateBalance = page.getByRole('dialog', { name: 'Update balance' });
	await expect(updateBalance).toBeVisible();
	await demo.explain('Loans', 'After a payment posts, update the balance from an estimate', updateBalance);
	await pause(page);
	await demo.click(updateBalance.getByRole('button', { name: 'Cancel' }));

	await demo.goTo('/accounts/details/acct-hsa');
	const hsaReimbursements = page.getByRole('group', { name: 'HSA reimbursements' });
	await expect(hsaReimbursements).toBeVisible();
	await hsaReimbursements.scrollIntoViewIfNeeded();
	await demo.explain('Accounts', 'Find medical expenses you can still pay back from your HSA', hsaReimbursements);
	await pause(page);

	await demo.click(page.getByRole('link', { name: 'Transactions' }));
	await demo.click(page.locator('[data-wingspan-header-note]').getByRole('button', { name: /last account sync/ }));
	const accountSyncs = page.getByRole('dialog', { name: 'Account syncs' });
	await expect(accountSyncs).toBeVisible();
	await demo.explain('Transactions', 'See how current your transactions are, and refresh every account', accountSyncs);
	await pause(page);
	await page.keyboard.press('Escape');

	await demo.click(page.getByRole('tab', { name: /Receipts/ }));
	const syncRetailer = page.locator('[data-wingspan-retail-sync]').getByRole('button', { name: 'Sync retailer' });
	await expect(syncRetailer).toBeVisible();
	await demo.click(syncRetailer);
	await demo.explain('Transactions', 'Send Walmart and Costco orders to Monarch as itemized receipts', syncRetailer);
	await pause(page);
	await page.keyboard.press('Escape');

	const workspaceSwitcher = page.locator('[data-wingspan-workspace-switcher]');
	await demo.click(workspaceSwitcher.getByRole('button'));
	await expect(page.getByRole('menuitem', { name: 'Contoso Pottery' })).toBeVisible();
	await demo.explain('Sidebar', 'Switch between your household and your business, each with only its own money', workspaceSwitcher);
	await pause(page);
	await page.keyboard.press('Escape');

	await demo.showClosingCard();
	await pause(page, TITLE_CARD_MS + 1000);
	await recorder.save(VIDEO_PATH);
	recorder.savePoster(VIDEO_PATH, POSTER_PATH, POSTER_AT_SECONDS);
});
