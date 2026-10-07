import { Button } from '../../../../monarch/ui/components/button';
import { Dialog } from '../../../../monarch/ui/components/dialog';
import { WingspanMark } from '../../../wingspanMark';

export type RetailSyncResult = { outcome: 'done'; sent: number; alreadyInMonarch: number; unreadable: number } | { outcome: 'failed'; message: string };

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
				<p className="m-0 text-base text-content-primary">{result.message}</p>
			</Dialog>
		);
	}

	const { sent, alreadyInMonarch, unreadable } = result;
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
				<p className="m-0 font-medium">{headline(store, sent, alreadyInMonarch)}</p>
				{sent ? (
					<p className="m-0 text-content-secondary">
						{sent === 1
							? `Monarch matches it to your ${store} transaction and itemizes it. It shows up under Receipts once Monarch is done processing it.`
							: `Monarch matches each one to your ${store} transaction and itemizes it. They show up under Receipts as Monarch finishes processing them.`}
					</p>
				) : null}
				{alreadyInMonarch ? (
					<p className="m-0 text-content-secondary">{`${alreadyInMonarch} ${alreadyInMonarch === 1 ? 'purchase was' : 'purchases were'} already in Monarch, with the same amount that day, so ${alreadyInMonarch === 1 ? "it wasn't" : "they weren't"} sent again.`}</p>
				) : null}
				{unreadable ? (
					<p className="m-0 text-content-warning">{`${unreadable} ${unreadable === 1 ? 'purchase' : 'purchases'} couldn't be read, so ${unreadable === 1 ? "it wasn't" : "they weren't"} sent.`}</p>
				) : null}
			</div>
		</Dialog>
	);
}

function headline(store: string, sent: number, alreadyInMonarch: number): string {
	if (sent) return `Sent ${sent} ${sent === 1 ? 'receipt' : 'receipts'} to Monarch.`;
	if (alreadyInMonarch) return 'Nothing new to send.';
	return `No new ${store} purchases since your last sync.`;
}
