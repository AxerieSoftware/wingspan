import { Field as BaseField } from '@base-ui/react/field';
import type { ReactNode } from 'react';
import { fieldStyles } from '../styles';

export interface FieldProps {
	label: string;
	/** Sits at the end of the label's line. */
	labelAside?: ReactNode;
	children: ReactNode;
}

export interface FormGridProps {
	children: ReactNode;
}

/** Monarch's form field, with the label above the control. */
export function Field({ label, labelAside, children }: FieldProps) {
	const fieldSlots = fieldStyles();
	const fieldLabel = (
		<BaseField.Label data-mds="field-label" className={fieldSlots.label()}>
			<span>{label}</span>
		</BaseField.Label>
	);

	return (
		<BaseField.Root data-mds="field" className={fieldSlots.root()}>
			{labelAside ? (
				<div className="flex items-center justify-between gap-sm">
					{fieldLabel}
					{labelAside}
				</div>
			) : (
				fieldLabel
			)}
			{children}
		</BaseField.Root>
	);
}

/** Lays out fields two to a row. */
export function FormGrid({ children }: FormGridProps) {
	return <div className="grid grid-cols-2 items-start gap-md">{children}</div>;
}
