import type { WingspanBuilder } from '../../wingspanBuilder';
import { costcoStore } from './costco/costcoStore';
import { RetailSyncFeature } from './shared/retailSyncFeature';
import { RetailSyncSession } from './shared/retailSyncSession';
import { ReceiptPdf } from './shared/services/receiptPdf';
import { BrowserRetailSyncChannel } from './shared/services/retailSyncChannel';
import { walmartStore } from './walmart/walmartStore';

/** Retail receipt sync: uploads store purchases to Monarch as receipts, from a menu on Transactions → Receipts and Retail Sync. */
export function addRetailSync(app: WingspanBuilder): void {
	const { window, pages, dataService, calendar } = app;
	const channel = new BrowserRetailSyncChannel();
	const receiptPdf = new ReceiptPdf(app.formatter);
	const sessions = [walmartStore, costcoStore].map(store => new RetailSyncSession(store, window.document, pages.receipts, channel, dataService, app.monarchApi.receipts, receiptPdf, calendar));
	app.addFeature(new RetailSyncFeature(sessions, pages.receipts));
}
