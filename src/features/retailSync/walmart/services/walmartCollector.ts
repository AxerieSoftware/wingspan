import type { RetailSyncFailure } from '../../shared/models/retailSyncMessages';
import type { ListedOrder, PrepareResult, RetailCollector } from '../../shared/services/retailCollector';
import { RetailSyncOverlay, type SyncOverlay } from '../../shared/services/retailSyncOverlay';

interface CapturedRequest {
	url: URL;
}

interface PurchaseHistoryPage {
	orders?: { id?: string; isInStore?: boolean; orderDate?: string; groups?: { isActive?: boolean }[] }[];
	pageInfo?: { nextPageCursor?: string | null };
}

const CAPTURE_WAIT_MS = 8000;
const REQUEST_GAP_MS = 800;
const MAX_PAGES = 20;
/** Headers Walmart's app sends with every order request. The rest aren't needed. */
const PLATFORM = 'rweb';
const SEGMENT = 'oaoh';

/**
 * Reads Walmart orders from Walmart's page using Walmart's API. Its persisted queries are identified by hashes that
 * change with each Walmart release, so each sync first triggers one of each request from Walmart's app (by paging the
 * order list and opening an order) and uses those as templates.
 */
export class WalmartCollector implements RetailCollector {
	private readonly captured = new Map<string, CapturedRequest>();

	public constructor(
		private readonly window: Window,
		/** Delay between Wingspan's requests, so a sync doesn't hammer Walmart. */
		private readonly requestGapMs = REQUEST_GAP_MS,
		private readonly overlay: SyncOverlay = new RetailSyncOverlay(window.document, 'Sending your Walmart purchases to Monarch')
	) {
		this.watchRequests();
	}

	/**
	 * The orders on or after `since` that aren't in `knownOrderIds`, newest first. Orders still being picked or delivered
	 * don't have a final total yet, so they're skipped and picked up by a later sync.
	 */
	public async prepare(since: string, knownOrderIds: string[]): Promise<PrepareResult> {
		const document = this.window.document;
		if (/\/account\/login|\/signin/.test(this.window.location.pathname)) return { status: 'failed', reason: 'retailerSignedOut' };
		if (document.querySelector("#px-captcha, [id^='px-captcha']") || /\/blocked/.test(this.window.location.pathname)) return { status: 'failed', reason: 'retailerChallenge' };

		this.overlay.show('Finding new orders…');
		const firstPage = this.firstPage();
		if (!firstPage) return this.failed('retailerFormatChanged');
		const known = new Set(knownOrderIds);
		const orders: ListedOrder[] = [];
		let page: PurchaseHistoryPage | null = firstPage;
		for (let pageNumber = 1; page && pageNumber <= MAX_PAGES; pageNumber++) {
			let reachedSince = false;
			for (const order of page.orders ?? []) {
				if (!order.id || !order.orderDate) continue;
				if (order.orderDate.slice(0, 10) < since) {
					reachedSince = true;
					continue;
				}
				if (known.has(order.id)) continue;
				if (!order.groups?.some(group => group.isActive)) orders.push({ id: order.id, isInStore: !!order.isInStore });
			}
			const cursor = page.pageInfo?.nextPageCursor;
			if (reachedSince || !cursor) break;
			page = await this.nextPage(cursor);
			if (!page) return this.failed('retailerFormatChanged');
		}

		if (orders.length && !(await this.ensureOrderTemplate())) return this.failed('retailerFormatChanged');
		return { status: 'ok', orders };
	}

	/**
	 * Each order as returned by Walmart's `getOrder`, minus the user's name, email and address. `alreadyRead` and `total`
	 * are counts across the whole sync, for the overlay.
	 */
	public async fetchOrders(orders: ListedOrder[], alreadyRead = 0, total = orders.length): Promise<{ order: unknown; isInStore: boolean }[] | null> {
		const results: { order: unknown; isInStore: boolean }[] = [];
		for (const listed of orders) {
			this.overlay.show(`Reading order ${alreadyRead + results.length + 1} of ${total}…`);
			const body = await this.call('getOrder', variables => {
				variables.orderId = listed.id;
				variables.orderIsInStore = listed.isInStore;
				delete variables.clickThroughGroupId;
			});
			const order = (body as { data?: { order?: Record<string, unknown> } } | null)?.data?.order;
			if (!order) {
				this.overlay.hide();
				return null;
			}
			results.push({ order: this.forReceipt(order), isInStore: listed.isInStore });
			await this.pause();
		}
		return results;
	}

	/** Removes the overlay so the user can deal with whatever stopped the sync. */
	public hideOverlay(): void {
		this.overlay.hide();
	}

	private failed(reason: RetailSyncFailure): PrepareResult {
		this.overlay.hide();
		return { status: 'failed', reason };
	}

	private forReceipt(order: Record<string, unknown>): Record<string, unknown> {
		const { id, displayId, orderDate, groups_2101, priceDetails, paymentMethods } = order;
		const groups = Array.isArray(groups_2101) ? groups_2101.map((group: { items?: unknown }) => ({ items: group.items })) : [];
		const payments = Array.isArray(paymentMethods)
			? paymentMethods.map((payment: { description?: unknown; paymentType?: unknown }) => ({ description: payment.description, paymentType: payment.paymentType }))
			: [];
		return { id, displayId, orderDate, groups_2101: groups, priceDetails, paymentMethods: payments };
	}

	private firstPage(): PurchaseHistoryPage | null {
		try {
			const nextData = JSON.parse(this.window.document.getElementById('__NEXT_DATA__')?.textContent ?? 'null');
			return nextData?.props?.pageProps?.phRedesignInitialData?.data?.purchaseHistory ?? null;
		} catch {
			return null;
		}
	}

	private async nextPage(cursor: string): Promise<PurchaseHistoryPage | null> {
		if (!(await this.ensureTemplate('PurchaseHistoryV3', () => this.click(element => /next page/i.test(element.getAttribute('aria-label') ?? ''))))) return null;
		await this.pause();
		const body = await this.call('PurchaseHistoryV3', variables => {
			const input = variables.input as Record<string, unknown> | undefined;
			if (input) input.cursor = cursor;
		});
		return (body as { data?: { purchaseHistory?: PurchaseHistoryPage } } | null)?.data?.purchaseHistory ?? null;
	}

	private ensureOrderTemplate(): Promise<boolean> {
		return this.ensureTemplate('getOrder', () => this.click(element => /^View details of /.test(element.getAttribute('aria-label') ?? '')));
	}

	/** Triggers the request once from Walmart's app, then restores the page. */
	private async ensureTemplate(operation: string, trigger: () => boolean): Promise<boolean> {
		if (this.captured.has(operation)) return true;
		const startUrl = this.window.location.href;
		if (!trigger()) return false;
		for (let waited = 0; waited < CAPTURE_WAIT_MS && !this.captured.has(operation); waited += 200) await new Promise(resolve => setTimeout(resolve, 200));
		if (this.window.location.href !== startUrl) this.window.history.back();
		return this.captured.has(operation);
	}

	private click(matches: (element: Element) => boolean): boolean {
		const element = [...this.window.document.querySelectorAll<HTMLElement>('button, a')].find(matches);
		if (!element) return false;
		element.click();
		return true;
	}

	private async call(operation: string, change: (variables: Record<string, unknown>) => void): Promise<unknown> {
		const template = this.captured.get(operation);
		if (!template) return null;
		const url = new URL(template.url);
		let variables: Record<string, unknown>;
		try {
			variables = JSON.parse(url.searchParams.get('variables') ?? '{}');
		} catch {
			return null;
		}
		change(variables);
		url.searchParams.set('variables', JSON.stringify(variables));
		const response = await this.window.fetch(url.href, { credentials: 'include', headers: this.headers(operation) });
		if (!response.ok) return null;
		return response.json().catch(() => null);
	}

	private headers(operation: string): Record<string, string> {
		let appVersion = '';
		try {
			appVersion = JSON.parse(this.window.document.getElementById('release-metadata')?.textContent ?? '{}').appVersion ?? '';
		} catch {}
		return {
			accept: 'application/json',
			'content-type': 'application/json',
			'x-apollo-operation-name': operation,
			'x-o-platform': PLATFORM,
			'x-o-segment': SEGMENT,
			'x-o-platform-version': appVersion
		};
	}

	/** Records the URL of each Walmart GraphQL request, to get its query hash and variables. */
	private watchRequests(): void {
		const pageFetch = this.window.fetch.bind(this.window);
		const captured = this.captured;
		this.window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
			try {
				const url = new URL(input instanceof Request ? input.url : String(input), this.window.location.href);
				const operation = /\/graphql\/([A-Za-z0-9]+)\/[0-9a-f]{40,}/.exec(url.pathname)?.[1];
				if (operation && !captured.has(operation)) captured.set(operation, { url });
			} catch {}
			return pageFetch(input, init);
		};
	}

	private pause(): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, this.requestGapMs));
	}
}
