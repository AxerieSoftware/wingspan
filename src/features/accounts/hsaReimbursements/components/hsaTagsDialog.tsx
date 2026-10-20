import { useState } from 'react';
import type { TransactionTag } from '../../../../monarch/api/models/taggedTransaction';
import { Button } from '../../../../monarch/ui/components/button';
import { Dialog } from '../../../../monarch/ui/components/dialog';
import { Field } from '../../../../monarch/ui/components/field';
import { Select, type SelectOption } from '../../../../monarch/ui/components/select';
import { LINK_BUTTON_CLASS_NAME } from '../../../../monarch/ui/styles';
import type { HsaReimbursementTags } from '../models/hsaReimbursementTags';

/** Monarch's settings page where tags are made. */
const TAG_SETTINGS_PATH = '/settings/tags';
const NO_TAG_LABEL = 'None';

export interface HsaTagsDialogProps {
	tags: TransactionTag[];
	initialTags: HsaReimbursementTags;
	onSave(tags: HsaReimbursementTags): Promise<void>;
	onClose(): void;
}

/** Chooses the Monarch tags for expenses to reimburse and for those already reimbursed. */
export function HsaTagsDialog({ tags, initialTags, onSave, onClose }: HsaTagsDialogProps) {
	const [chosenTags, setChosenTags] = useState(initialTags);
	const [isSaving, setIsSaving] = useState(false);
	const options: SelectOption<string>[] = [['', NO_TAG_LABEL], ...tags.map(tag => [tag.id, tag.name, <TagDot key="dot" color={tag.color} />] as const)];
	const isSameTag = chosenTags.toReimburseTagId !== '' && chosenTags.toReimburseTagId === chosenTags.reimbursedTagId;

	const save = async () => {
		setIsSaving(true);
		try {
			await onSave(chosenTags);
			onClose();
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog
			title="HSA tags"
			size="sm"
			onClose={onClose}
			actions={
				<>
					<Button onClick={onClose}>Cancel</Button>
					<Button variant="primary" disabled={chosenTags.toReimburseTagId === '' || isSameTag} loading={isSaving} onClick={() => void save()}>
						Save
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-default">
				<p className="m-0 text-sm font-book text-content-secondary">
					Tag an expense to reimburse when you pay it yourself. Once your HSA pays you back, swap that tag for the reimbursed one.{' '}
					<a className={LINK_BUTTON_CLASS_NAME} href={TAG_SETTINGS_PATH}>
						Make tags in Monarch's settings
					</a>
					.
				</p>
				<Field label="Expenses to reimburse">
					<Select options={options} value={chosenTags.toReimburseTagId} label="Expenses to reimburse" onChange={toReimburseTagId => setChosenTags(current => ({ ...current, toReimburseTagId }))} />
				</Field>
				<Field label="Reimbursed expenses">
					<Select options={options} value={chosenTags.reimbursedTagId} label="Reimbursed expenses" onChange={reimbursedTagId => setChosenTags(current => ({ ...current, reimbursedTagId }))} />
				</Field>
				{isSameTag ? <p className="m-0 text-sm font-book text-content-danger">Choose two different tags.</p> : null}
			</div>
		</Dialog>
	);
}

function TagDot({ color }: { color: string }) {
	return <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}
