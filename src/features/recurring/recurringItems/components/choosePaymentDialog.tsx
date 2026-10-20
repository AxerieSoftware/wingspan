import { useState } from 'react';
import type { Account } from '../../../../monarch/api/models/account';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import { Button } from '../../../../monarch/ui/components/button';
import { Dialog } from '../../../../monarch/ui/components/dialog';
import { TransactionPicker } from '../../manualBills/components/transactionPicker';
import type { RecurringItemServices } from '../services/recurringItemServices';

export interface ChoosePaymentDialogProps {
	itemName: string;
	dueDate: string;
	/** The transactions that could be the payment: the right direction, near the due date, and not already matched. */
	transactions: Transaction[];
	accounts: Account[];
	services: RecurringItemServices;
	onChoose(transactionId: string): Promise<void>;
	onClose(): void;
}

/** Picks the one transaction that paid a due date, for a payment Wingspan didn't match, like a check with a different description. */
export function ChoosePaymentDialog({ itemName, dueDate, transactions, accounts, services, onChoose, onClose }: ChoosePaymentDialogProps) {
	const [pickedId, setPickedId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The picker allows several; choosing another replaces the one picked.
	const pick = (pickedIds: ReadonlySet<string>) => setPickedId([...pickedIds].find(transactionId => transactionId !== pickedId) ?? null);
	const choose = async () => {
		if (!pickedId) return;
		setIsSaving(true);
		setError(null);
		try {
			await onChoose(pickedId);
			onClose();
		} catch {
			setError("Couldn't save. Try again.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog
			title="Choose payment"
			size="lg"
			onClose={onClose}
			actions={
				<>
					<Button onClick={onClose}>Cancel</Button>
					<Button variant="primary" disabled={!pickedId} loading={isSaving} onClick={() => void choose()}>
						Choose payment
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-default">
				<p className="m-0 text-sm font-book text-content-secondary">{`Pick the transaction that paid ${itemName} due ${services.formatter.longDate(dueDate)}. It's counted as that payment from now on.`}</p>
				<TransactionPicker
					transactions={transactions}
					status="ready"
					accounts={accounts}
					pickedIds={new Set(pickedId ? [pickedId] : [])}
					merchantName={null}
					showsAllTransactions
					services={services}
					matchCard={null}
					onChange={pick}
				/>
				{error ? <p className="m-0 text-sm font-book text-content-danger">{error}</p> : null}
			</div>
		</Dialog>
	);
}
