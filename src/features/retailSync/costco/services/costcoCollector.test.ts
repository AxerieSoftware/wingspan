import { describe, expect, it } from 'vitest';
import { NO_OVERLAY } from '../../shared/services/retailSyncOverlay';
import { CostcoCollector } from './costcoCollector';

const listed = (barcode: string, transactionDateTime: string, total = 10, transactionType = 'Sales') => ({ transactionBarcode: barcode, transactionDateTime, transactionType, total, itemArray: [] });

/** A minimal fake of costco.com's Orders & Purchases page: its tabs, and its API called over XHR like the app does. */
function fakeCostco(pathname = '/myaccount/') {
	const sent: { headers: Record<string, string>; body: { query: string; variables: Record<string, unknown> } }[] = [];
	const receipts = [listed('b-old', '2026-08-01T10:00:00'), listed('b-new', '2026-09-20T10:00:00'), listed('b-known', '2026-09-10T10:00:00'), listed('b-return', '2026-09-15T10:00:00', -5, 'Refund')];
	class FakeXhr {
		public status = 0;
		public responseText = '';
		public onload: (() => void) | null = null;
		public onerror: (() => void) | null = null;
		private readonly headers: Record<string, string> = {};
		public open(_method: string, _url: string) {}
		public setRequestHeader(name: string, value: string) {
			this.headers[name] = value;
		}
		public send(body: string) {
			const parsed = JSON.parse(body);
			sent.push({ headers: this.headers, body: parsed });
			this.status = 200;
			this.responseText = JSON.stringify({ data: { receiptsWithCounts: { receipts } } });
			queueMicrotask(() => this.onload?.());
		}
	}
	const appRequest = () => {
		const xhr = new fakeWindow.XMLHttpRequest();
		xhr.open('POST', 'https://ecom-api.costco.com/orders/graphql');
		for (const [name, value] of Object.entries({ 'costco-x-authorization': 'Bearer token', 'costco.service': 'restOrders', 'x-kpsdk-ct': 'bot-check' })) xhr.setRequestHeader(name, value);
		xhr.send(JSON.stringify({ query: 'query receiptsWithCounts { inWarehouse }', variables: {} }));
	};
	const tabs = [
		{ textContent: 'Online', click: () => undefined },
		{ textContent: 'Warehouse', click: appRequest }
	];
	const fakeWindow = {
		XMLHttpRequest: FakeXhr,
		location: { hostname: 'www.costco.com', pathname },
		document: { querySelectorAll: () => tabs }
	};
	return { window: fakeWindow as unknown as Window & typeof globalThis, sent };
}

describe('reading Costco receipts from the Costco page', () => {
	it('lists unsent purchases since the date, newest first, skipping returns', async () => {
		const costco = fakeCostco();
		const collector = new CostcoCollector(costco.window, NO_OVERLAY);

		const prepared = await collector.prepare('2026-09-01', ['b-known']);

		expect(prepared).toEqual({ status: 'ok', orders: [{ id: 'b-new', isInStore: true }] });
		const ours = costco.sent.at(-1);
		expect(ours?.body.variables).toMatchObject({ startDate: '2026-09-01', documentType: 'all', documentSubType: 'all' });
		expect(ours?.body.query).toContain('itemArray { itemDescription01 itemDescription02 unit amount }');
		// The app's auth header is reused on Wingspan's request, but the bot check's single-use headers aren't.
		expect(ours?.headers).toEqual({ 'costco-x-authorization': 'Bearer token', 'costco.service': 'restOrders' });
	});

	it('returns each receipt it already read without making more requests to Costco', async () => {
		const costco = fakeCostco();
		const collector = new CostcoCollector(costco.window, NO_OVERLAY);
		await collector.prepare('2026-09-01', []);
		const requests = costco.sent.length;

		const orders = await collector.fetchOrders([{ id: 'b-new', isInStore: true }]);

		expect(orders).toEqual([{ order: expect.objectContaining({ transactionBarcode: 'b-new' }), isInStore: true }]);
		expect(costco.sent).toHaveLength(requests);
	});

	it('stops when Costco asks the shopper to sign in', async () => {
		expect(await new CostcoCollector(fakeCostco('/LogonForm').window, NO_OVERLAY).prepare('2026-09-01', [])).toEqual({ status: 'failed', reason: 'retailerSignedOut' });
	});
});
