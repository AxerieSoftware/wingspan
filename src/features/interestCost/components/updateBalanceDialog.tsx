import { useState } from 'react';
import { Button } from '../../../monarch/ui/components/button';
import { Dialog } from '../../../monarch/ui/components/dialog';
import { Field } from '../../../monarch/ui/components/field';
import { MoneyInput } from '../../../monarch/ui/components/input';
import type { Formatter } from '../../../monarch/ui/formatter';

export interface UpdateBalanceDialogProps {
	accountName: string;
	/** Wingspan's estimate, which the field starts with. */
	estimate: number;
	formatter: Formatter;
	onSave(owed: number): Promise<void>;
	onClose(): void;
}

/** Enters a manual loan's balance in Monarch, starting from Wingspan's estimate. */
export function UpdateBalanceDialog({ accountName, estimate, formatter, onSave, onClose }: UpdateBalanceDialogProps) {
	const [owed, setOwed] = useState<number | null>(estimate);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const save = async () => {
		if (owed === null) return;
		setIsSaving(true);
		setError(null);
		try {
			await onSave(owed);
			onClose();
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Monarch couldn't save the balance.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog
			title="Update balance"
			size="sm"
			onClose={onClose}
			actions={
				<>
					<Button onClick={onClose}>Cancel</Button>
					<Button variant="primary" disabled={owed === null} loading={isSaving} onClick={() => void save()}>
						Save
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-default">
				<p className="m-0 text-sm font-book text-content-secondary">
					{`What ${accountName} owes now. It starts at Wingspan's estimate: the last balance, plus daily interest since, minus payments since. If your servicer shows a different amount, enter theirs.`}
				</p>
				<Field label="Balance">
					<MoneyInput value={owed} label="Balance" formatter={formatter} onChange={setOwed} />
				</Field>
				{error ? <p className="m-0 text-sm font-book text-content-danger">{error}</p> : null}
			</div>
		</Dialog>
	);
}
