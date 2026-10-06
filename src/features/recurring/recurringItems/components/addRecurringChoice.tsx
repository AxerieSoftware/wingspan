import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MonarchDataService } from '../../../../data/services/monarchDataService';
import type { RecurringV2AddDialogSlots } from '../../../../monarch/pages/recurringV2/models/recurringV2AddDialogExtension';
import { Field, FormGrid } from '../../../../monarch/ui/components/field';
import { Select } from '../../../../monarch/ui/components/select';
import { useSignalValue } from '../../../../monarch/ui/hooks/useSignalValue';
import { WingspanMark } from '../../../wingspanMark';
import type { RecurringItemRepository } from '../services/recurringItemRepository';
import type { RecurringItemServices } from '../services/recurringItemServices';
import { ItemEditorActions, ItemEditorFields, useItemEditor } from './itemEditorForm';

const MONARCH_KIND = '';
const MONARCH_KIND_LABEL = 'Recurring merchant';

/** `slots` are the places in the Add recurring dialog where Wingspan's fields render. */
export interface AddRecurringChoiceProps {
	slots: RecurringV2AddDialogSlots;
	services: RecurringItemServices;
	monarchData: MonarchDataService;
	itemRepository: RecurringItemRepository;
}

interface WingspanItemFieldsProps extends AddRecurringChoiceProps {
	kind: string;
}

/** Monarch's "Add recurring" adds a merchant; this Type field adds Wingspan's kinds of item in the same dialog. */
export function AddRecurringChoice(props: AddRecurringChoiceProps) {
	const { slots, services } = props;
	const [kind, setKind] = useState(MONARCH_KIND);
	const kindOptions = [[MONARCH_KIND, MONARCH_KIND_LABEL] as const, ...services.kinds.all.map(itemKind => [itemKind.kind, itemKind.label, <WingspanMark key="mark" />] as const)];

	const chooseKind = (chosenKind: string) => {
		setKind(chosenKind);
		slots.showWingspanFields(chosenKind !== MONARCH_KIND);
	};

	return (
		<>
			<FormGrid>
				<Field label="Type">
					<Select options={kindOptions} value={kind} onChange={chooseKind} />
				</Field>
			</FormGrid>
			{kind === MONARCH_KIND ? null : <WingspanItemFields key={kind} kind={kind} {...props} />}
		</>
	);
}

function WingspanItemFields({ kind, slots, services, monarchData, itemRepository }: WingspanItemFieldsProps) {
	const snapshot = useSignalValue(monarchData.snapshot);
	const editor = useItemEditor({ startItem: null, kind, services, itemRepository, onDone: slots.close });

	return (
		<>
			{createPortal(<ItemEditorFields editor={editor} accounts={snapshot?.accounts ?? []} monarchData={monarchData} services={services} />, slots.fieldsEl)}
			{createPortal(<ItemEditorActions editor={editor} saveLabel="Add recurring" onCancel={slots.close} />, slots.footerEl)}
		</>
	);
}
