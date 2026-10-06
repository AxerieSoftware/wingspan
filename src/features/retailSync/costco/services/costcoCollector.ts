import type { ListedOrder, PrepareResult, RetailCollector } from '../../shared/services/retailCollector';
import { RetailSyncOverlay, type SyncOverlay } from '../../shared/services/retailSyncOverlay';

interface CapturedRequest {
	url: string;
	headers: Record<string, string>;
}

interface ListedReceipt {
	transactionBarcode?: string;
	transactionDateTime?: string;
	transactionType?: string | null;
	total?: number;
	[field: string]: unknown;
}

const PAGE_WAIT_MS = 15_000;
const CAPTURE_WAIT_MS = 8000;
const POLL_MS = 200;
/** The query Costco's app sends for receipts, trimmed to the fields a receipt needs. */
const OPERATION = 'receiptsWithCounts';
const RECEIPTS_QUERY = `query receiptsWithCounts($startDate: String!, $endDate: String!, $documentType: String!, $documentSubType: String!) {
	receiptsWithCounts(startDate: $startDate, endDate: $endDate, documentType: $documentType, documentSubType: $documentSubType) {
		receipts {
			transactionBarcode transactionDateTime transactionType warehouseName subTotal taxes total
			itemArray { itemDescription01 itemDescription02 unit amount }
			tenderArray { tenderDescription amountTender }
		}
	}
}`;

/**
 * Reads Costco warehouse and gas station receipts from Costco's page using Costco's API. Requests need an auth token
 * that Costco's app adds, so the sync first opens the Warehouse tab to make the app send one receipts request, then
 * sends its own request with the same headers.
 */
export class CostcoCollector implements RetailCollector {
	private template: CapturedRequest | null = null;
	private readonly receipts = new Map<string, ListedReceipt>();

	public constructor(
		private readonly window: Window & typeof globalThis,
		private readonly overlay: SyncOverlay = new RetailSyncOverlay(window.document, 'Sending your Costco purchases to Monarch')
	) {
		this.watchRequests();
	}

	/** Every purchase since `since` that isn't in `knownOrderIds`, newest first. Returns are skipped. */
	public async prepare(since: string, knownOrderIds: string[]): Promise<PrepareResult> {
		const page = await this.waitForOrdersPage();
		if (page === 'signedOut') return { status: 'failed', reason: 'retailerSignedOut' };
		this.overlay.show('Finding new receipts…');
		if (page === 'missing' || !(await this.ensureTemplate())) return this.failed('retailerFormatChanged');

		const body = await this.request({
			query: RECEIPTS_QUERY,
			variables: { startDate: since, endDate: this.today(), documentType: 'all', documentSubType: 'all' }
		});
		const listed = (body as { data?: { receiptsWithCounts?: { receipts?: ListedReceipt[] } } } | null)?.data?.receiptsWithCounts?.receipts;
		if (!Array.isArray(listed)) return this.failed('retailerFormatChanged');

		const known = new Set(knownOrderIds);
		const orders: ListedOrder[] = [];
		const newestFirst = [...listed].sort((a, b) => String(b.transactionDateTime).localeCompare(String(a.transactionDateTime)));
		for (const receipt of newestFirst) {
			const barcode = receipt.transactionBarcode;
			const isPurchase = (receipt.total ?? 0) > 0 && (receipt.transactionType ?? 'Sales') === 'Sales';
			const isSince = String(receipt.transactionDateTime ?? '').slice(0, 10) >= since;
			if (!barcode || known.has(barcode) || !isPurchase || !isSince || this.receipts.has(barcode)) continue;
			this.receipts.set(barcode, receipt);
			orders.push({ id: barcode, isInStore: true });
		}
		return { status: 'ok', orders };
	}

	/** The receipts already read by `prepare`. Costco returns full receipts, so no more requests are needed. */
	public async fetchOrders(orders: ListedOrder[], alreadyRead = 0, total = orders.length): Promise<{ order: unknown; isInStore: boolean }[] | null> {
		const results: { order: unknown; isInStore: boolean }[] = [];
		for (const listed of orders) {
			this.overlay.show(`Reading receipt ${alreadyRead + results.length + 1} of ${total}…`);
			const receipt = this.receipts.get(listed.id);
			if (!receipt) {
				this.overlay.hide();
				return null;
			}
			results.push({ order: receipt, isInStore: true });
		}
		return results;
	}

	/** Removes the overlay so the user can deal with whatever stopped the sync. */
	public hideOverlay(): void {
		this.overlay.hide();
	}

	private failed(reason: 'retailerFormatChanged'): PrepareResult {
		this.overlay.hide();
		return { status: 'failed', reason };
	}

	/** Costco's order status link ends up on Orders & Purchases once loaded, or on the sign-in page. */
	private async waitForOrdersPage(): Promise<'ready' | 'signedOut' | 'missing'> {
		for (let waited = 0; waited < PAGE_WAIT_MS; waited += POLL_MS) {
			const { hostname, pathname } = this.window.location;
			if (hostname.startsWith('signin.') || /logon|signin|login/i.test(pathname)) return 'signedOut';
			if (this.warehouseTab()) return 'ready';
			await this.pause(POLL_MS);
		}
		return 'missing';
	}

	private warehouseTab(): HTMLElement | undefined {
		return [...this.window.document.querySelectorAll<HTMLElement>('button, a, [role=tab]')].find(element => element.textContent?.trim() === 'Warehouse');
	}

	/** Opening the Warehouse tab makes the app request receipts. If it's already open, switch to Online and back. */
	private async ensureTemplate(): Promise<boolean> {
		if (this.template) return true;
		const tab = (name: string) => [...this.window.document.querySelectorAll<HTMLElement>('button, a, [role=tab]')].find(element => element.textContent?.trim() === name);
		tab('Online')?.click();
		await this.pause(500);
		this.warehouseTab()?.click();
		for (let waited = 0; waited < CAPTURE_WAIT_MS && !this.template; waited += POLL_MS) await this.pause(POLL_MS);
		return !!this.template;
	}

	/** Uses the app's headers, minus the bot check's, which are unique per request. */
	private request(body: { query: string; variables: Record<string, unknown> }): Promise<unknown> {
		const template = this.template;
		if (!template) return Promise.resolve(null);
		return new Promise(resolve => {
			const xhr = new this.window.XMLHttpRequest();
			xhr.open('POST', template.url);
			for (const [name, value] of Object.entries(template.headers)) if (!name.startsWith('x-kpsdk')) xhr.setRequestHeader(name, value);
			xhr.onload = () => {
				try {
					resolve(xhr.status === 200 ? JSON.parse(xhr.responseText) : null);
				} catch {
					resolve(null);
				}
			};
			xhr.onerror = () => resolve(null);
			xhr.send(JSON.stringify(body));
		});
	}

	/** Records the URL and headers of the app's receipts request to use as a template for Wingspan's. */
	private watchRequests(): void {
		const prototype = this.window.XMLHttpRequest.prototype;
		const { open, setRequestHeader, send } = prototype;
		const requests = new WeakMap<XMLHttpRequest, CapturedRequest>();
		const collector = this;
		prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
			requests.set(this, { url: String(url), headers: {} });
			return (open as (...args: unknown[]) => void).call(this, method, url, ...rest);
		};
		prototype.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
			const request = requests.get(this);
			if (request) request.headers[name.toLowerCase()] = value;
			return setRequestHeader.call(this, name, value);
		};
		prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
			const request = requests.get(this);
			if (request && !collector.template && typeof body === 'string' && body.includes(OPERATION) && request.headers['costco-x-authorization']) collector.template = request;
			return send.call(this, body);
		};
	}

	/** Today in the user's time zone as "YYYY-MM-DD", which Costco accepts like its own "M/D/YYYY". */
	private today(): string {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	}

	private pause(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
