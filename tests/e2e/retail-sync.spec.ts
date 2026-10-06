import type { BrowserContext, Page } from '@playwright/test';
import { expect, settled, test } from './fixtures';

/** Walmart orders as the background script sends them: only the fields a receipt needs, every value invented. */
const walmartOrder = (id: string, name: string, total: number) => ({
	isInStore: false,
	order: {
		id,
		displayId: `${id.slice(0, 7)}-${id.slice(7)}`,
		orderDate: '2026-09-20T18:11:00-05:00',
		groups_2101: [{ items: [{ quantity: 1, productInfo: { name }, priceInfo: { linePrice: { value: total - 1 } } }] }],
		priceDetails: { subTotal: { value: total - 1 }, taxTotal: { value: 1 }, grandTotal: { value: total }, fees: [], discounts: [] },
		paymentMethods: [{ description: 'Card ending in 0000' }]
	}
});

async function extensionWorker(context: BrowserContext) {
	return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

/** Sends every tab the messages the background script sends while reading Walmart; only the Monarch tab listens. */
async function fromBackground(context: BrowserContext, messages: unknown[]) {
	const worker = await extensionWorker(context);
	await worker.evaluate(async updates => {
		const { tabs } = (globalThis as unknown as { chrome: { tabs: { query(filter: object): Promise<{ id?: number }[]>; sendMessage(tabId: number, message: unknown): Promise<unknown> } } }).chrome;
		const openTabs = await tabs.query({});
		for (const update of updates) for (const tab of openTabs) if (tab.id !== undefined) await tabs.sendMessage(tab.id, update).catch(() => undefined);
	}, messages);
}

/** Mocks the browser's permission prompt on Wingspan's permission page. */
async function answerPermission(accessPage: Page, isGranted: boolean) {
	await accessPage.evaluate(answer => {
		(globalThis as unknown as { chrome: { permissions: { request(): Promise<boolean> } } }).chrome.permissions.request = async () => answer;
	}, isGranted);
}

const syncMenu = (page: Page) => page.locator('[data-wingspan-retail-sync]').getByRole('button', { name: 'Sync retailer' });

async function chooseStore(page: Page, store: string) {
	await syncMenu(page).click();
	await page.getByRole('menuitem', { name: store }).click();
}

test("Receipts and Retail Sync get a Sync retailer menu of Walmart and Costco just before Monarch's Settings", async ({ page, open }) => {
	for (const path of ['/transactions/retail-sync', '/transactions/receipts']) {
		await open({ path, waitForRows: false });
		await expect(page.locator('[data-wingspan-retail-sync] + a[href$="/settings"]')).toHaveCount(1);
		await syncMenu(page).click();
		await expect(page.getByRole('menuitem')).toHaveText(['Walmart', 'Costco']);
		await page.keyboard.press('Escape');
	}
});

test("while one store syncs, the menu is disabled and shows which store it's reading", async ({ page, context, open }) => {
	await open({ path: '/transactions/retail-sync', waitForRows: false });
	await fromBackground(context, [{ type: 'retailSync:progress', retailer: 'costco', found: 3, fetched: 1 }]);

	await expect(page.locator('[data-wingspan-retail-sync] > [role=status]')).toHaveText('Read 1 of 3 Costco purchases · sent 0');
	await expect(syncMenu(page)).toBeDisabled();

	await fromBackground(context, [{ type: 'retailSync:failed', retailer: 'costco', reason: 'retailerTabClosed' }]);
	const stopped = page.getByRole('dialog', { name: 'Costco sync stopped' });
	await expect(stopped).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(stopped).toHaveCount(0);
	await expect(syncMenu(page)).toBeEnabled();
});

test("the first sync asks for walmart.com on Wingspan's own page before opening Walmart", async ({ page, context, open }) => {
	await open({ path: '/transactions/retail-sync', waitForRows: false });
	const accessPage = context.waitForEvent('page');
	await chooseStore(page, 'Walmart');

	const opened = await accessPage;
	await expect(opened).toHaveURL(/retail-access\.html\?retailer=walmart&monarchTab=\d+/);
	await expect(opened.getByRole('button', { name: 'Allow walmart.com' })).toBeVisible();
	await expect(opened.getByText(/never signs in for you/)).toBeVisible();
});

test('once walmart.com is allowed, the Monarch tab retries the Walmart sync automatically', async ({ page, context, open }) => {
	await open({ path: '/transactions/retail-sync', waitForRows: false });
	const worker = await extensionWorker(context);
	await worker.evaluate(() => {
		const background = globalThis as unknown as { starts: string[]; chrome: { runtime: { onMessage: { addListener(listener: (message: { type?: string; retailer?: string }) => void): void } } } };
		background.starts = [];
		background.chrome.runtime.onMessage.addListener(message => {
			if (message?.type === 'retailSync:start' && message.retailer) background.starts.push(message.retailer);
		});
	});
	const accessPage = context.waitForEvent('page');
	await chooseStore(page, 'Walmart');
	const opened = await accessPage;
	await expect(opened.getByRole('button', { name: 'Allow walmart.com' })).toBeVisible();
	// The menu isn't blocked while the permission page is open.
	await expect(syncMenu(page)).toBeEnabled();

	// A test can't answer the browser's own prompt, so the mock grants it.
	await answerPermission(opened, true);
	await opened.getByRole('button', { name: 'Allow walmart.com' }).click();

	await expect.poll(() => opened.isClosed()).toBe(true);
	await expect.poll(() => worker.evaluate(() => (globalThis as unknown as { starts: string[] }).starts)).toEqual(['walmart', 'walmart']);
});

test('denying walmart.com on the permission page shows a message in Monarch and re-enables the menu', async ({ page, context, open }) => {
	await open({ path: '/transactions/retail-sync', waitForRows: false });
	const accessPage = context.waitForEvent('page');
	await chooseStore(page, 'Walmart');
	const opened = await accessPage;

	await answerPermission(opened, false);
	await opened.getByRole('button', { name: 'Allow walmart.com' }).click();

	await expect(opened.getByText("Permission wasn't granted, so Wingspan can't read your Walmart purchase history. Nothing was changed.")).toBeVisible();
	const stopped = page.getByRole('dialog', { name: 'Walmart sync stopped' });
	await expect(stopped).toContainText("Wingspan needs permission to read Walmart's site to sync Walmart.");
	await page.keyboard.press('Escape');
	await expect(syncMenu(page)).toBeEnabled();
});

test('orders read from Walmart are uploaded to Monarch as PDF receipts, each only once', async ({ page, context, open, apiLog, household }) => {
	await open({ path: '/transactions/retail-sync', waitForRows: false });
	const orders = [walmartOrder('200015000000001', 'Bananas', 12.5), walmartOrder('200015000000002', 'Paper towels', 20)];

	await fromBackground(context, [
		{ type: 'retailSync:progress', retailer: 'walmart', found: 2, fetched: 0 },
		{ type: 'retailSync:orders', retailer: 'walmart', orders },
		{ type: 'retailSync:progress', retailer: 'walmart', found: 2, fetched: 2 },
		{ type: 'retailSync:done', retailer: 'walmart', found: 2 }
	]);

	const result = page.getByRole('dialog', { name: 'Walmart synced' });
	await expect(result).toContainText('Sent 2 receipts to Monarch.');
	await expect(page.locator('[data-wingspan-retail-sync] > [role=status]')).toHaveText('');
	expect(apiLog.uploads).toEqual([
		{ path: '/retail-sync/retail-sync-1/files', fileName: 'walmart-2026-09-20-2000150-00000001.pdf', isPdf: true },
		{ path: '/retail-sync/retail-sync-2/files', fileName: 'walmart-2026-09-20-2000150-00000002.pdf', isPdf: true }
	]);
	expect(apiLog.operations.filter(operation => operation === 'wingspan_StartReceiptSync')).toHaveLength(2);
	await settled(apiLog);
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('200015000000002');

	await result.getByRole('button', { name: 'View receipts' }).click();
	await expect(page).toHaveURL(/\/transactions\/receipts$/);

	// The same orders again, as from a sync that overlaps the last one: nothing new is uploaded.
	await fromBackground(context, [
		{ type: 'retailSync:orders', retailer: 'walmart', orders },
		{ type: 'retailSync:done', retailer: 'walmart', found: 2 }
	]);
	await expect(page.getByRole('dialog', { name: 'Walmart synced' })).toContainText('No new Walmart purchases since your last sync.');
	await expect(page.getByRole('dialog', { name: 'Walmart synced' }).getByRole('button', { name: 'View receipts' })).toHaveCount(0);
	expect(apiLog.uploads).toHaveLength(2);
});

test('a sync that Walmart interrupts tells the user what to do, and keeps the receipts already sent', async ({ page, context, open, apiLog }) => {
	await open({ path: '/transactions/receipts', waitForRows: false });

	await fromBackground(context, [
		{ type: 'retailSync:orders', retailer: 'walmart', orders: [walmartOrder('200015000000003', 'Milk', 5)] },
		{ type: 'retailSync:failed', retailer: 'walmart', reason: 'retailerChallenge' }
	]);

	const stopped = page.getByRole('dialog', { name: 'Walmart sync stopped' });
	await expect(stopped).toContainText(/Walmart asked to check you're not a robot\. Finish that in the Walmart tab/);
	await expect(stopped.getByRole('button', { name: 'Try again' })).toBeVisible();
	expect(apiLog.uploads).toHaveLength(1);
});

test('receipts Monarch rejected are reported even when the sync stops afterward', async ({ page, context, open }) => {
	await open({ path: '/transactions/receipts', waitForRows: false });
	await page.route('https://api.monarch.com/retail-sync/**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));

	await fromBackground(context, [
		{ type: 'retailSync:orders', retailer: 'walmart', orders: [walmartOrder('200015000000004', 'Eggs', 6)] },
		{ type: 'retailSync:failed', retailer: 'walmart', reason: 'retailerTabClosed' }
	]);

	const stopped = page.getByRole('dialog', { name: 'Walmart sync stopped' });
	await expect(stopped).toContainText('The Walmart tab closed before the sync finished.');
	await expect(stopped).toContainText("Couldn't send receipts to Monarch.");
});

test('when Monarch rejects one receipt in a batch, the ones it already accepted stay marked as sent', async ({ page, context, open, apiLog, household }) => {
	await open({ path: '/transactions/receipts', waitForRows: false });
	let filesPosted = 0;
	await page.route('https://api.monarch.com/retail-sync/**', route => (++filesPosted === 2 ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.fallback()));

	await fromBackground(context, [
		{ type: 'retailSync:orders', retailer: 'walmart', orders: [walmartOrder('200015000000005', 'Bread', 4), walmartOrder('200015000000006', 'Butter', 7)] },
		{ type: 'retailSync:done', retailer: 'walmart', found: 2 }
	]);

	await expect(page.getByRole('dialog', { name: 'Walmart sync stopped' })).toContainText("Couldn't send receipts to Monarch.");
	await settled(apiLog);
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('200015000000005');
	expect(household.wingspanAccounts[0]?.notes).not.toContain('200015000000006');
});

/** A Costco receipt as the background script sends it, every value invented. */
const costcoReceipt = (barcode: string, total: number) => ({
	isInStore: true,
	order: {
		transactionBarcode: barcode,
		transactionDateTime: '2026-09-05T14:22:00',
		transactionType: 'Sales',
		subTotal: total - 1,
		taxes: 1,
		total,
		itemArray: [{ itemDescription01: 'PAPER TOWELS', unit: 1, amount: total - 1 }],
		tenderArray: [{ tenderDescription: 'VISA', amountTender: total }]
	}
});

test("Costco receipts are uploaded to Monarch the same way, tracked separately from Walmart's", async ({ page, context, open, apiLog, household }) => {
	await open({ path: '/transactions/receipts', waitForRows: false });

	await fromBackground(context, [
		{ type: 'retailSync:progress', retailer: 'costco', found: 1, fetched: 0 },
		{ type: 'retailSync:orders', retailer: 'costco', orders: [costcoReceipt('21134300800232509051234', 42.5)] },
		{ type: 'retailSync:done', retailer: 'costco', found: 1 }
	]);

	await expect(page.getByRole('dialog', { name: 'Costco synced' })).toContainText('Sent 1 receipt to Monarch.');
	expect(apiLog.uploads).toEqual([{ path: '/retail-sync/retail-sync-1/files', fileName: 'costco-2026-09-05-21134300800232509051234.pdf', isPdf: true }]);
	await settled(apiLog);
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('21134300800232509051234');
	await expect(page.getByRole('dialog', { name: 'Walmart synced' })).toHaveCount(0);
});

test("a purchase Monarch already has a receipt for (same store, amount and day) isn't sent again", async ({ page, context, open, apiLog, household }) => {
	household.existingReceipts.push({ merchantName: 'COSTCO WHOLESALE', grandTotal: 42.5, date: '2026-09-05' });
	await open({ path: '/transactions/receipts', waitForRows: false });
	// The click first reads Monarch's existing receipts, then requests access to costco.com.
	const accessPage = context.waitForEvent('page');
	await chooseStore(page, 'Costco');
	await (await accessPage).close();

	await fromBackground(context, [
		{ type: 'retailSync:orders', retailer: 'costco', orders: [costcoReceipt('21134300800232509051234', 42.5), costcoReceipt('21134300800232509059999', 18)] },
		{ type: 'retailSync:done', retailer: 'costco', found: 2 }
	]);

	const result = page.getByRole('dialog', { name: 'Costco synced' });
	await expect(result).toContainText('Sent 1 receipt to Monarch.');
	await expect(result).toContainText("1 purchase was already in Monarch, with the same amount that day, so it wasn't sent again.");
	expect(apiLog.uploads.map(upload => upload.fileName)).toEqual(['costco-2026-09-05-21134300800232509059999.pdf']);
	await settled(apiLog);
	// Both are remembered, so neither is read again.
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('21134300800232509051234');
	expect(household.wingspanAccounts[0]?.notes).toContain('21134300800232509059999');
});
