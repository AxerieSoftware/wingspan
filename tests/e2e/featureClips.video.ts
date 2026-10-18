import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { DemoOverlay, installDemoOverlay } from './demoOverlay';
import { addRecurring, chooseMerchant, expect, itemRow, monarchRow, section, test, useTheme } from './fixtures';
import type { Household } from './household';
import { ScreencastRecorder } from './screencastRecorder';

/*
 * The site's feature pages' clips: about ten seconds each, light and dark, from the e2e tests' made-up household, each
 * feature outlined and captioned. `npm run videos` writes them to site/public/videos. They need ffmpeg.
 */

const VIDEOS_DIR = 'site/public/videos';
/** The pages show clips about half this wide, so 2x on a sharp screen. */
const CLIP_SIZE = { width: 1440, height: 900 };
/** Shown at half size, the caption needs to be bigger to read. */
const CAPTION_ZOOM = 1.5;
const READING_PAUSE_MS = 2800;
const LEAD_IN_MS = 600;
const THEMES = ['light', 'dark'] as const;
/** Sync status waits for a refresh, which a slow CI runner can take past Playwright's default 30 seconds to finish. */
const CLIP_TIMEOUT_MS = 2 * 60_000;

test.use({ viewport: CLIP_SIZE });

interface Clip {
	/** Matches the feature's page and its screenshot. */
	name: string;
	path?: string;
	setUp?(household: Household): void;
	/** What shows once the page is ready to record. */
	ready(page: Page): Locator;
	play(demo: DemoOverlay, page: Page): Promise<void>;
}

const pause = (page: Page) => page.waitForTimeout(READING_PAUSE_MS);

const CLIPS: Clip[] = [
	{
		name: 'due-dates',
		ready: page => section(page, 'Expenses').locator('[data-wingspan-row]').first(),
		async play(demo, page) {
			await demo.explain('Recurring', 'Every bill gets a due date, sorted by when it’s due', section(page, 'Expenses'));
			await pause(page);
			const income = section(page, 'Income');
			await demo.clear();
			await demo.scrollTo(income);
			await demo.explain('Recurring', 'Income too, so you can see what lands before each bill', income);
			await pause(page);
		}
	},
	{
		name: 'card-payments',
		ready: page => itemRow(page.locator('[data-wingspan-statements]'), 'Rewards Card'),
		async play(demo, page) {
			const statements = page.locator('[data-wingspan-statements]');
			await demo.scrollTo(statements);
			await demo.explain('Recurring', 'Each card’s statement, due date and whether checking can cover it', statements);
			await pause(page);
			await demo.click(itemRow(statements, 'Rewards Card'));
			const details = page.getByRole('region', { name: 'Rewards Card details' });
			await expect(details).toBeVisible();
			await demo.explain('Recurring', 'Its details show the statement balance and past payments', details);
			await pause(page);
		}
	},
	{
		name: 'manual-bills',
		ready: page => itemRow(page, 'Piano Lessons'),
		async play(demo, page) {
			await demo.explain('Recurring', 'A bill paid by check, like lessons, with no fixed payment date', itemRow(page, 'Piano Lessons'));
			await pause(page);
			await demo.click(itemRow(page, 'Piano Lessons'));
			const details = page.getByRole('region', { name: 'Piano Lessons details' });
			await expect(details).toContainText('Transactions');
			await demo.explain('Recurring', 'It stays owed until the payment clears', details);
			await pause(page);
		}
	},
	{
		name: 'expected-income',
		ready: page => section(page, 'Income'),
		async play(demo, page) {
			const dialog = await addRecurring(page, 'Income');
			await demo.explain('Recurring', 'Add pay that varies, like client payouts', dialog);
			await chooseMerchant(page, dialog, 'Fabrikam Payouts');
			const deposits = dialog.getByRole('checkbox', { name: /Fabrikam Payouts/ });
			for (const index of [0, 1, 2, 3]) await demo.click(deposits.nth(index));
			const expected = dialog.getByRole('textbox', { name: 'Expected amount' });
			await demo.click(expected);
			await expected.pressSequentially('430', { delay: 120 });
			await demo.click(dialog.getByRole('button', { name: 'Add recurring', exact: true }).last());
			await expect(dialog).toBeHidden();
			await demo.click(itemRow(section(page, 'Income'), 'Fabrikam Payouts'));
			const details = page.getByRole('region', { name: 'Fabrikam Payouts details' });
			await expect(details).toContainText('Transactions');
			await demo.explain('Recurring', 'It’s counted at what you usually take in, until it arrives', details);
			await pause(page);
		}
	},
	{
		name: 'projected-balances',
		path: '/cash-flow',
		ready: page => page.getByRole('group', { name: 'Projected balances' }).getByRole('img', { name: /^Checking from / }),
		async play(demo, page) {
			const card = page.getByRole('group', { name: 'Projected balances' });
			await demo.scrollTo(card);
			await demo.explain('Cash Flow', 'Checking day by day ahead, and how much is free to spend today', card);
			await pause(page);
			await demo.click(card.getByRole('button', { name: 'Edit cash and cards', exact: true }));
			const dialog = page.getByRole('dialog', { name: 'Cash and cards' });
			await expect(dialog).toBeVisible();
			await demo.explain('Cash Flow', 'Choose your checking, your reserves and which cards to lean on', dialog);
			await pause(page);
		}
	},
	{
		name: 'loans-paid-down',
		path: '/cash-flow',
		ready: page => page.getByTestId('loans-paid-down-card'),
		async play(demo, page) {
			const loansPaidDown = page.getByTestId('loans-paid-down-card');
			await demo.scrollTo(loansPaidDown);
			await demo.explain('Cash Flow', 'How much your loans went down, and its share of your income', loansPaidDown);
			await pause(page);
			await demo.explain('Cash Flow', 'What your debts cost in interest this month', page.getByTestId('interest-cost-card'));
			await pause(page);
		}
	},
	{
		name: 'interest-cost',
		path: '/accounts/details/acct-loan',
		setUp: household => {
			household.addLoanPayment();
			household.linkLoanPayment();
		},
		ready: page => page.getByRole('group', { name: 'Interest', exact: true }).getByRole('button', { name: 'Update balance' }),
		async play(demo, page) {
			const card = page.getByRole('group', { name: 'Interest', exact: true });
			await demo.scrollTo(card);
			await demo.explain('Accounts', 'What a loan costs in interest each day, month and year', card);
			await pause(page);
			await demo.click(card.getByRole('button', { name: 'Update balance' }));
			const dialog = page.getByRole('dialog', { name: 'Update balance' });
			await expect(dialog).toBeVisible();
			await demo.explain('Accounts', 'After a payment, update the balance from an estimate', dialog);
			await pause(page);
		}
	},
	{
		name: 'hsa-reimbursements',
		path: '/accounts/details/acct-hsa',
		setUp: household => household.addHsaExpenses(),
		ready: page => page.getByRole('group', { name: 'HSA reimbursements' }),
		async play(demo, page) {
			const card = page.getByRole('group', { name: 'HSA reimbursements' });
			await demo.scrollTo(card);
			await demo.explain('Accounts', 'Medical expenses you can still pay back from your HSA', card);
			await pause(page);
			await demo.click(card.getByRole('button', { name: /^Reimbursed/ }));
			await expect(card.getByText('Contoso Pharmacy')).toBeVisible();
			await demo.explain('Accounts', 'And the ones you’ve already paid back, from any year', card);
			await pause(page);
		}
	},
	{
		name: 'receipt-sync',
		path: '/transactions/receipts',
		ready: page => page.locator('[data-wingspan-retail-sync]').getByRole('button', { name: 'Sync retailer' }),
		async play(demo, page) {
			const sync = page.locator('[data-wingspan-retail-sync]').getByRole('button', { name: 'Sync retailer' });
			await demo.explain('Transactions', 'Sync your store orders from Receipts', sync);
			await pause(page);
			await demo.click(sync);
			const menu = page.getByRole('menu');
			await expect(menu.getByRole('menuitem')).toHaveText(['Walmart', 'Costco']);
			await demo.explain('Transactions', 'Walmart and Costco orders go to Monarch as itemized receipts', menu);
			await pause(page);
		}
	},
	{
		name: 'sync-status',
		path: '/transactions',
		setUp: household => household.stallAccountSync('acct-flex', 6),
		ready: page => page.locator('[data-wingspan-header-note]').getByRole('button', { name: /last account sync/ }),
		async play(demo, page) {
			await demo.click(page.locator('[data-wingspan-header-note]').getByRole('button', { name: /last account sync/ }));
			const popover = page.getByRole('dialog', { name: 'Account syncs' });
			await expect(popover).toBeVisible();
			await demo.explain('Transactions', 'When each account last synced, with any behind in orange', popover);
			await pause(page);
			await demo.click(popover.getByRole('button', { name: 'Refresh all' }));
			const toast = page.locator('[data-mds="toast"]').filter({ hasText: 'Accounts refreshed' });
			await expect(toast).toBeVisible();
			await demo.explain('Transactions', 'Refresh them all, then reload to see what came in', toast, { isAtTop: true });
			await pause(page);
		}
	},
	{
		name: 'workspaces',
		setUp: household => household.addBusiness(),
		ready: page => page.locator('[data-wingspan-workspace-switcher]').getByRole('button'),
		async play(demo, page) {
			const switcher = page.locator('[data-wingspan-workspace-switcher]');
			await demo.click(switcher.getByRole('button'));
			const business = page.getByRole('menuitem', { name: 'Contoso Pottery' });
			await expect(business).toBeVisible();
			await demo.explain('Sidebar', 'Switch between your household and your business', page.getByRole('menu'));
			await pause(page);
			await Promise.all([page.waitForEvent('load'), demo.click(business)]);
			const expenses = section(page, 'Expenses');
			await expect(monarchRow(expenses, 'Kiln Lease')).toBeVisible();
			await demo.explain('Recurring', 'Each page then shows only the business’s money', expenses);
			await pause(page);
		}
	},
	{
		name: 'sidebar-items',
		path: '/settings/wingspan',
		ready: page => page.getByRole('group', { name: 'Sidebar' }),
		async play(demo, page) {
			const group = page.getByRole('group', { name: 'Sidebar' });
			await demo.explain('Settings', 'Uncheck the pages you don’t use', group);
			await pause(page);
			await demo.click(group.getByRole('checkbox', { name: 'Investments' }));
			await demo.click(group.getByRole('checkbox', { name: 'Forecasting' }));
			await expect(page.getByRole('link', { name: 'Investments' })).toHaveCount(0);
			const sidebar = page.locator('[data-external-id="side-bar"]');
			await demo.explain('Settings', 'They leave Monarch’s sidebar right away', sidebar);
			await pause(page);
		}
	}
];

for (const clip of CLIPS) {
	for (const theme of THEMES) {
		test(`${clip.name}, ${theme}`, async ({ page, household, open }, testInfo) => {
			test.setTimeout(CLIP_TIMEOUT_MS);
			clip.setUp?.(household);
			await page.addInitScript(installDemoOverlay, { zoom: CAPTION_ZOOM, hasTitleCard: false });
			const demo = new DemoOverlay(page);
			const recorder = new ScreencastRecorder(join(testInfo.outputDir, 'frames'), CLIP_SIZE);

			// The first open shows Wingspan's first-run notice; choosing the theme reloads past it.
			await open({ path: clip.path, waitForRows: false });
			await expect(page.getByText(/now saves to your Monarch account/)).toBeVisible();
			await useTheme(page, theme);
			await expect(clip.ready(page)).toBeVisible();
			await recorder.start(page);
			await page.waitForTimeout(LEAD_IN_MS);
			await clip.play(demo, page);
			await recorder.save(join(VIDEOS_DIR, `${clip.name}-${theme}.mp4`));
		});
	}
}
