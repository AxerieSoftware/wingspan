import { useState } from 'react';
import type { MonarchDataService } from '../../../../data/services/monarchDataService';
import type { Account } from '../../../../monarch/api/models/account';
import { ConfirmDialog } from '../../../../monarch/ui/components/confirmDialog';
import { Dialog } from '../../../../monarch/ui/components/dialog';
import { WingspanMark } from '../../../wingspanMark';
import type { RecurringItem } from '../models/recurringItem';
import type { RecurringItemRepository } from '../services/recurringItemRepository';
import type { RecurringItemServices } from '../services/recurringItemServices';
import { ItemEditorActions, ItemEditorFields, useItemEditor } from './itemEditorForm';

/** `item` is the saved item being edited. */
export interface ItemEditorProps {
	item: RecurringItem;
	accounts: Account[];
	services: RecurringItemServices;
	monarchData: MonarchDataService;
	itemRepository: RecurringItemRepository;
	onClose(): void;
}

/** The Edit dialog for a saved item, with Remove behind a confirmation. */
export function ItemEditor({ item, accounts, services, monarchData, itemRepository, onClose }: ItemEditorProps) {
	const editor = useItemEditor({ startItem: item, kind: item.kind, services, itemRepository, onDone: onClose });
	const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

	const answerRemove = (isConfirmed: boolean) => {
		if (!isConfirmed) return setIsConfirmingRemove(false);
		void editor.remove();
	};

	return (
		<Dialog
			title={`Edit ${item.name}`}
			titleAdornment={<WingspanMark />}
			className="max-w-[800px]"
			onClose={onClose}
			footer={<ItemEditorActions editor={editor} saveLabel="Save" onCancel={onClose} onRemove={() => setIsConfirmingRemove(true)} />}
		>
			<ItemEditorFields editor={editor} accounts={accounts} monarchData={monarchData} services={services} />
			<ConfirmDialog confirmation={services.factory.removalConfirmation(item)} open={isConfirmingRemove} busy={editor.busyAction === 'remove'} onAnswer={answerRemove} />
		</Dialog>
	);
}
