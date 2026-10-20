import { countOf } from '../../../../common/countOf';
import { Button } from '../../../../monarch/ui/components/button';
import { Dialog } from '../../../../monarch/ui/components/dialog';
import { WingspanMark } from '../../../wingspanMark';
import { FIRST_SYNC_DAYS } from '../models/retailSyncData';

/** Monarch matches a receipt by its total, so an order charged in pieces has no single transaction to match. */
const PARTLY_CHARGED_NOTE = 'An order charged in more than one payment, like one shipped in parts, may not match.';

export type RetailSyncResult = { outcome: 'done'; sent: number; alreadyInMonarch: number; unreadable: number; isFirstSync: boolean } | { outcome: 'failed'; message: string; sent: number };

export interface RetailSyncResultDialogProps {
	store: string;
	result: RetailSyncResult;
	/** Absent when the Receipts page is already showing. */
	onViewReceipts?(): void;
	onTryAgain(): void;
	onClose(): void;
}

/** Shows the sync result in Monarch's tab after the store's tab closes. */
export function RetailSyncResultDialog({ store, result, onViewReceipts, onTryAgain, onClose }: RetailSyncResultDialogProps) {
	if (result.outcome === 'failed') {
		return (
			<Dialog
				title={`${store} sync stopped`}
				titleAdornment={<WingspanMark />}
				size="sm"
				onClose={onClose}
				actions={
					<>
						<Button onClick={onClose}>Close</Button>
						<Button variant="primary" onClick={onTryAgain}>
							Try again
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-sm text-base text-content-primary">
					<p className="m-0">{result.message}</p>
					{result.sent ? (
						<p className="m-0 text-content-secondary">{`Sent ${countOf(result.sent, 'receipt')} before it stopped. Trying again won't send ${result.sent === 1 ? 'it' : 'them'} twice.`}</p>
					) : null}
				</div>
			</Dialog>
		);
	}

	const { sent, alreadyInMonarch, unreadable, isFirstSync } = result;
	return (
		<Dialog
			title={`${store} synced`}
			titleAdornment={<WingspanMark />}
			size="sm"
			onClose={onClose}
			actions={
				<>
					<Button variant={sent && onViewReceipts ? 'default' : 'primary'} onClick={onClose}>
						Done
					</Button>
					{sent && onViewReceipts ? (
						<Button variant="primary" onClick={onViewReceipts}>
							View receipts
						</Button>
					) : null}
				</>
			}
		>
			<div className="flex flex-col gap-sm text-base text-content-primary">
				<p className="m-0 font-medium">{headline(store, sent, alreadyInMonarch, isFirstSync)}</p>
				{sent ? (
					<p className="m-0 text-content-secondary">
						{`${
							sent === 1
								? `Monarch matches it to a ${store} transaction with the same total and itemizes it. It shows up under Receipts once Monarch is done processing it.`
								: `Monarch matches each one to a ${store} transaction with the same total and itemizes it. They show up under Receipts as Monarch finishes processing them.`
						} ${PARTLY_CHARGED_NOTE}`}
					</p>
				) : null}
				{alreadyInMonarch ? (
					<p className="m-0 text-content-secondary">{`${countOf(alreadyInMonarch, 'purchase was', 'purchases were')} already in Monarch, with the same amount that day, so ${alreadyInMonarch === 1 ? "it wasn't" : "they weren't"} sent again.`}</p>
				) : null}
				{unreadable ? <p className="m-0 text-content-warning">{`${countOf(unreadable, 'purchase')} couldn't be read, so ${unreadable === 1 ? "it wasn't" : "they weren't"} sent.`}</p> : null}
			</div>
		</Dialog>
	);
}

function headline(store: string, sent: number, alreadyInMonarch: number, isFirstSync: boolean): string {
	if (sent) return `Sent ${countOf(sent, 'receipt')} to Monarch.`;
	if (alreadyInMonarch) return 'Nothing new to send.';
	return isFirstSync ? `No new ${store} purchases in the last ${FIRST_SYNC_DAYS} days.` : `No new ${store} purchases since your last sync.`;
}
