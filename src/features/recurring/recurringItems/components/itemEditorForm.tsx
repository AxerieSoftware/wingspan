import { useState } from 'react';
import type { MonarchDataService } from '../../../../data/services/monarchDataService';
import type { Account } from '../../../../monarch/api/models/account';
import { Button } from '../../../../monarch/ui/components/button';
import { useSignalValue } from '../../../../monarch/ui/hooks/useSignalValue';
import { WingspanMark } from '../../../wingspanMark';
import type { RecurringItem } from '../models/recurringItem';
import type { EditedField, RecurringItemDraft } from '../models/recurringItemDraft';
import type { RecurringItemRepository } from '../services/recurringItemRepository';
import type { RecurringItemServices } from '../services/recurringItemServices';

type BusyAction = 'save' | 'remove';

/** An editor's draft and actions. `problems` stop saving; `startItem` is null for a new item. */
export interface ItemEditorState {
	startItem: RecurringItem | null;
	draft: RecurringItemDraft;
	editedFields: ReadonlySet<EditedField>;
	problems: string[];
	busyAction: BusyAction | null;
	changeDraft(draft: RecurringItemDraft, editedField?: EditedField): void;
	save(): Promise<void>;
	remove(): Promise<void>;
}

/** `kind` is the new item's when there's no `startItem`. `onDone` runs after a save or removal. */
export interface UseItemEditorOptions {
	startItem: RecurringItem | null;
	kind: string;
	services: RecurringItemServices;
	itemRepository: RecurringItemRepository;
	onDone(): void;
}

/** `monarchData` provides the transactions the fields can pick from. */
export interface ItemEditorFieldsProps {
	editor: ItemEditorState;
	accounts: Account[];
	monarchData: MonarchDataService;
	services: RecurringItemServices;
}

/** Without `onRemove` there's no Remove button, as for a new item. */
export interface ItemEditorActionsProps {
	editor: ItemEditorState;
	saveLabel: string;
	onCancel(): void;
	onRemove?(): void;
}

/** Draft state for the Add and Edit dialogs. When a due date moves, saving keeps anything that came due before it as owed. */
export function useItemEditor({ startItem, kind, services, itemRepository, onDone }: UseItemEditorOptions): ItemEditorState {
	const { factory, validator } = services;
	const [draft, setDraft] = useState<RecurringItemDraft>(() => (startItem ? factory.draftOf(startItem) : factory.blankDraft(kind)));
	const [editedFields, setEditedFields] = useState<ReadonlySet<EditedField>>(new Set());
	const [busyAction, setBusyAction] = useState<BusyAction | null>(null);

	const runBusy = async (action: BusyAction, work: () => Promise<void>) => {
		setBusyAction(action);
		try {
			await work();
			onDone();
		} finally {
			setBusyAction(null);
		}
	};

	return {
		startItem,
		draft,
		editedFields,
		problems: validator.problemsWith(draft.item, draft.schedule, itemRepository.data.value.recurringItems),
		busyAction,
		changeDraft: (changedDraft, editedField) => {
			if (editedField) setEditedFields(fields => new Set(fields).add(editedField));
			setDraft(changedDraft);
		},
		save: () => runBusy('save', () => itemRepository.save(factory.itemFrom(draft, startItem ?? undefined))),
		remove: () =>
			runBusy('remove', async () => {
				if (startItem) await itemRepository.remove(startItem.id);
			})
	};
}

/** The kind's fields, followed by any validation problems once something has been edited. */
export function ItemEditorFields({ editor, accounts, monarchData, services }: ItemEditorFieldsProps) {
	const monarch = useSignalValue(monarchData.state);
	const itemKind = services.kinds.of(editor.draft.item);

	return (
		<>
			<itemKind.EditorFields
				startItem={editor.startItem}
				draft={editor.draft}
				editedFields={editor.editedFields}
				accounts={accounts}
				transactions={monarch.status === 'ready' ? monarch.snapshot.transactions : []}
				transactionsStatus={monarch.status}
				services={services}
				onChange={editor.changeDraft}
			/>
			<p className="my-0 mt-md text-xs text-content-danger" role="status">
				{editor.editedFields.size ? editor.problems.join(' ') : ''}
			</p>
		</>
	);
}

/** Remove on the left; Cancel and Save on the right, Save off while there are problems. */
export function ItemEditorActions({ editor, saveLabel, onCancel, onRemove }: ItemEditorActionsProps) {
	return (
		<>
			<div className="flex min-w-0 items-center gap-xs">
				{onRemove ? (
					<Button variant="danger" onClick={onRemove}>
						Remove
					</Button>
				) : null}
			</div>
			<div className="flex items-center gap-xs">
				<Button onClick={onCancel}>Cancel</Button>
				<Button
					variant="primary"
					leading={<WingspanMark label="Saves to Wingspan" tone="onButton" />}
					disabled={editor.problems.length > 0}
					loading={editor.busyAction === 'save'}
					onClick={() => void editor.save()}
				>
					{saveLabel}
				</Button>
			</div>
		</>
	);
}
