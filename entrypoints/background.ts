import { browser } from 'wxt/browser';
import { RETAILERS, type Retailer, type RetailSyncFailure, type RetailSyncRequest, type RetailSyncUpdate } from '@/src/features/retailSync/shared/models/retailSyncMessages';
import type { CollectorWindow, ListedOrder, PrepareResult } from '@/src/features/retailSync/shared/services/retailCollector';

const ORDERS_PER_BATCH = 5;
const PAGE_LOAD_TIMEOUT_MS = 30_000;

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message: RetailSyncRequest, sender, sendResponse: (response: unknown) => void) => {
		if (message.type?.startsWith('retailSync:') !== true) return undefined;

		if (message.type === 'retailSync:start' && sender.tab?.id !== undefined) {
			const monarchTabId = sender.tab.id;
			const { origin } = RETAILERS[message.retailer];
			void browser.permissions.contains({ origins: [origin] }).then(async isAllowed => {
				if (isAllowed) return syncRetailer(monarchTabId, message);

				// Ask for access to the store's site, so Wingspan can read the user's purchases there.
				await browser.tabs.create({ url: `${browser.runtime.getURL('/retail-access.html')}?retailer=${message.retailer}&monarchTab=${monarchTabId}` });
				const awaiting: RetailSyncUpdate = { type: 'retailSync:awaitingPermission', retailer: message.retailer };
				await browser.tabs.sendMessage(monarchTabId, awaiting).catch(() => undefined);
			});
		}

		sendResponse({ accepted: true });
		return undefined;
	});

	async function syncRetailer(monarchTabId: number, request: RetailSyncRequest): Promise<void> {
		const store = RETAILERS[request.retailer];
		const notifyMonarchTab = (update: RetailSyncUpdate) => browser.tabs.sendMessage(monarchTabId, update).catch(() => undefined);
		const fail = (reason: RetailSyncFailure) => notifyMonarchTab({ type: 'retailSync:failed', retailer: request.retailer, reason });

		if (!(await browser.permissions.contains({ origins: [store.origin] }))) return void fail('retailerPermission');

		const storeTab = await browser.tabs.create({ url: store.startUrl, active: true });
		const storeTabId = storeTab.id;
		if (storeTabId === undefined) return void fail('retailerTabClosed');

		// Once the collector is injected, its overlay covers the page, so any stop after that hides the overlay first.
		let isCollectorInPage = false;
		const stop = async (reason: RetailSyncFailure) => {
			if (isCollectorInPage) await hideOverlay(storeTabId, request.retailer);
			await fail(reason);
		};
		// Unexpected errors are reported as a closed tab only if the tab is actually gone.
		const unexpectedStop = async () => stop((await isTabOpen(storeTabId)) ? 'retailerError' : 'retailerTabClosed');

		try {
			const pageLoad = await waitForPageLoad(storeTabId);
			if (pageLoad !== 'loaded') return void (await fail(pageLoad === 'timedOut' ? 'retailerTimedOut' : 'retailerTabClosed'));
			// Costco redirects signed-out users to a separate sign-in site that Wingspan can't access. Walmart's collector detects sign-out itself.
			if (!(await isOnSite(storeTabId, store.startUrl))) return void (await fail('retailerSignedOut'));

			await browser.scripting.executeScript({ target: { tabId: storeTabId }, files: [store.collectorFile], world: 'MAIN' });
			isCollectorInPage = true;
			const prepared = await executeScriptInPage<PrepareResult>(
				storeTabId,
				(name: string, sinceDate: string, knownOrderIds: string[]) => (window as CollectorWindow).__wingspanRetail?.[name]?.prepare(sinceDate, knownOrderIds),
				[request.retailer, request.since, request.knownOrderIds]
			);

			if (!prepared) return void (await unexpectedStop());
			if (prepared.status === 'failed') return void (await fail(prepared.reason));

			let fetched = 0;
			await notifyMonarchTab({ type: 'retailSync:progress', retailer: request.retailer, found: prepared.orders.length, fetched });

			for (let start = 0; start < prepared.orders.length; start += ORDERS_PER_BATCH) {
				const batch = prepared.orders.slice(start, start + ORDERS_PER_BATCH);
				const orders = await executeScriptInPage<{ order: unknown; isInStore: boolean }[] | null>(
					storeTabId,
					(name: string, listedOrders: ListedOrder[], alreadyRead: number, total: number) =>
						(window as CollectorWindow).__wingspanRetail?.[name]?.fetchOrders(listedOrders, alreadyRead, total) ?? null,
					[request.retailer, batch, start, prepared.orders.length]
				);

				if (!orders) return void (await stop('retailerFormatChanged'));

				fetched += orders.length;
				await notifyMonarchTab({ type: 'retailSync:orders', retailer: request.retailer, orders });
				await notifyMonarchTab({ type: 'retailSync:progress', retailer: request.retailer, found: prepared.orders.length, fetched });
			}

			await notifyMonarchTab({ type: 'retailSync:done', retailer: request.retailer, found: prepared.orders.length });
			await browser.tabs.remove(storeTabId).catch(() => undefined);
			await browser.tabs.update(monarchTabId, { active: true }).catch(() => undefined);
		} catch {
			await unexpectedStop();
		}
	}

	async function hideOverlay(tabId: number, retailer: Retailer): Promise<void> {
		await executeScriptInPage<void>(tabId, (name: string) => (window as CollectorWindow).__wingspanRetail?.[name]?.hideOverlay(), [retailer]).catch(() => undefined);
	}

	/** Also false when the tab is on a site Wingspan has no access to, since the browser hides its URL. */
	async function isOnSite(tabId: number, siteUrl: string): Promise<boolean> {
		const tab = await browser.tabs.get(tabId);
		return tab.url !== undefined && new URL(tab.url).host === new URL(siteUrl).host;
	}

	async function isTabOpen(tabId: number): Promise<boolean> {
		return browser.tabs.get(tabId).then(
			() => true,
			() => false
		);
	}

	async function executeScriptInPage<TResult>(tabId: number, pageFunction: (...args: never[]) => unknown, pageArguments: unknown[]): Promise<TResult | null> {
		// The function is serialized into the page: it may use only its arguments and the page's own globals.
		const injection = { target: { tabId }, world: 'MAIN', func: pageFunction, args: pageArguments } as unknown as Parameters<typeof browser.scripting.executeScript>[0];
		const [result] = await browser.scripting.executeScript(injection);
		return (result?.result as TResult | undefined) ?? null;
	}

	function waitForPageLoad(tabId: number): Promise<'loaded' | 'closed' | 'timedOut'> {
		return new Promise(resolve => {
			const timeout = setTimeout(() => finish('timedOut'), PAGE_LOAD_TIMEOUT_MS);
			const onUpdated = (updatedTabId: number, change: { status?: string }) => {
				if (updatedTabId === tabId && change.status === 'complete') finish('loaded');
			};
			const onRemoved = (removedTabId: number) => {
				if (removedTabId === tabId) finish('closed');
			};
			function finish(outcome: 'loaded' | 'closed' | 'timedOut') {
				clearTimeout(timeout);
				browser.tabs.onUpdated.removeListener(onUpdated);
				browser.tabs.onRemoved.removeListener(onRemoved);
				resolve(outcome);
			}
			browser.tabs.onUpdated.addListener(onUpdated);
			browser.tabs.onRemoved.addListener(onRemoved);
		});
	}
});
