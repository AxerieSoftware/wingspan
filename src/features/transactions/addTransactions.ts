import type { WingspanBuilder } from '../../wingspanBuilder';
import { OrderItemsFeature } from './orderItems/orderItemsFeature';

/** Adds Items in this order to the details of transactions split from a synced order. */
export function addTransactions(app: WingspanBuilder): void {
	const { window, pages, syncedQueries, formatter } = app;
	app.addFeature(new OrderItemsFeature(window, pages.transactionDrawer, app.monarchApi.splits, syncedQueries, formatter));
}
