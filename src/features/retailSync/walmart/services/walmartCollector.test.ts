import { describe, expect, it } from 'vitest';
import { NO_OVERLAY } from '../../shared/services/retailSyncOverlay';
import { WalmartCollector } from './walmartCollector';

const HASH = 'a'.repeat(64);
const order = (id: string, orderDate: string, isActive = false) => ({ id, orderDate, isInStore: false, groups: [{ isActive }] });

/** A minimal fake of walmart.com's order history page: its embedded first page, its buttons, and its API. */
function fakeWalmart() {
	const requests: { operation: string; headers: Record<string, string>; variables: Record<string, unknown> }[] = [];
	const pages: Record<string, unknown> = {
		c2: { orders: [order('o4', '2026-08-20T10:00:00-05:00'), order('o5', '2026-05-01T10:00:00-05:00')], pageInfo: { nextPageCursor: 'c3' } }
	};
	const fullOrder = (id: string) => ({
		id,
		displayId: `D-${id}`,
		orderDate: '2026-09-01',
		customer: { firstName: 'Shopper', email: 'shopper@example.com' },
		groups_2101: [{ items: [], address: '1 Main St' }],
		priceDetails: { grandTotal: { value: 10 } },
		paymentMethods: [{ description: 'Card', billingAddress: '1 Main St' }]
	});
	const elements: Record<string, string> = {
		__NEXT_DATA__: JSON.stringify({
			props: {
				pageProps: {
					phRedesignInitialData: {
						data: {
							purchaseHistory: {
								orders: [order('o1', '2026-09-30T10:00:00-05:00'), order('o2', '2026-09-25T10:00:00-05:00', true), order('o3', '2026-09-20T10:00:00-05:00')],
								pageInfo: { nextPageCursor: 'c2' }
							}
						}
					}
				}
			}
		}),
		'release-metadata': JSON.stringify({ appVersion: 'web-2026.10.1' })
	};
	const appRequest = (operation: string, variables: Record<string, unknown>) =>
		fakeWindow.fetch(`https://www.walmart.com/orchestra/x/graphql/${operation}/${HASH}?variables=${encodeURIComponent(JSON.stringify(variables))}`, {
			headers: { 'x-apollo-operation-name': operation, 'x-o-correlation-id': 'app' }
		});
	const buttons = [
		{ getAttribute: () => 'Next page', click: () => void appRequest('PurchaseHistoryV3', { input: { cursor: 'c2', limit: 5 }, platform: 'WEB' }) },
		{ getAttribute: () => 'View details of Curbside pickup', click: () => void appRequest('getOrder', { orderId: 'o1', orderIsInStore: false, clickThroughGroupId: 'g1' }) }
	];
	const fakeWindow = {
		location: { pathname: '/orders', href: 'https://www.walmart.com/orders' },
		history: { back: () => undefined },
		document: { getElementById: (id: string) => (elements[id] ? { textContent: elements[id] } : null), querySelector: () => null, querySelectorAll: () => buttons },
		fetch: async (input: string, init: { headers?: Record<string, string> } = {}) => {
			const url = new URL(input);
			const operation = url.pathname.split('/')[4] as string;
			const variables = JSON.parse(url.searchParams.get('variables') ?? '{}');
			requests.push({ operation, headers: init.headers ?? {}, variables });
			const data = operation === 'getOrder' ? { order: fullOrder(variables.orderId) } : { purchaseHistory: pages[(variables.input as { cursor: string }).cursor] };
			return { ok: true, json: async () => ({ data }) };
		}
	};
	return { window: fakeWindow as unknown as Window, requests };
}

describe('reading Walmart orders from the Walmart page', () => {
	it('lists unsent orders since the date, newest first, skipping ones still in progress', async () => {
		const walmart = fakeWalmart();
		const collector = new WalmartCollector(walmart.window, 0, NO_OVERLAY);

		const prepared = await collector.prepare('2026-06-01', ['o3']);

		// o2 is still being picked, o3 was already sent, and o5 is before the date, so paging stops there.
		expect(prepared).toEqual({
			status: 'ok',
			orders: [
				{ id: 'o1', isInStore: false },
				{ id: 'o4', isInStore: false }
			]
		});
		const page = walmart.requests.filter(request => request.operation === 'PurchaseHistoryV3').at(-1);
		expect(page?.variables).toEqual({ input: { cursor: 'c2', limit: 5 }, platform: 'WEB' });
		expect(page?.headers).toEqual({
			accept: 'application/json',
			'content-type': 'application/json',
			'x-apollo-operation-name': 'PurchaseHistoryV3',
			'x-o-platform': 'rweb',
			'x-o-segment': 'oaoh',
			'x-o-platform-version': 'web-2026.10.1'
		});
	});

	it("fetches each order with Walmart's own query and drops the user's name, email and address", async () => {
		const walmart = fakeWalmart();
		const collector = new WalmartCollector(walmart.window, 0, NO_OVERLAY);
		await collector.prepare('2026-06-01', []);

		const orders = await collector.fetchOrders([{ id: 'o4', isInStore: true }]);

		expect(walmart.requests.at(-1)?.variables).toEqual({ orderId: 'o4', orderIsInStore: true });
		expect(orders?.[0]?.isInStore).toBe(true);
		const kept = JSON.stringify(orders);
		expect(kept).toContain('D-o4');
		for (const personal of ['Shopper', 'shopper@example.com', '1 Main St']) expect(kept).not.toContain(personal);
	});

	it('stops when Walmart asks the shopper to sign in', async () => {
		const walmart = fakeWalmart();
		(walmart.window.location as { pathname: string }).pathname = '/account/login';

		expect(await new WalmartCollector(walmart.window, 0, NO_OVERLAY).prepare('2026-06-01', [])).toEqual({ status: 'failed', reason: 'retailerSignedOut' });
	});
});
