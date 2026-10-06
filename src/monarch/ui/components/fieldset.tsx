import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset';
import type { ReactNode } from 'react';
import { fieldsetStyles } from '../styles';

/** `wide` makes the group span every column of a `FormGrid`. */
export interface FieldsetProps {
	legend: string;
	wide?: boolean;
	children: ReactNode;
}

/** A titled group of fields, as in Monarch's settings. */
export function Fieldset({ legend, wide, children }: FieldsetProps) {
	const fieldsetSlots = fieldsetStyles();

	return (
		<BaseFieldset.Root data-mds="fieldset" className={fieldsetSlots.root()} style={wide ? { gridColumn: '1 / -1' } : undefined}>
			<BaseFieldset.Legend data-mds="fieldset-legend" className={fieldsetSlots.legend()}>
				{legend}
			</BaseFieldset.Legend>
			<div data-mds="fieldset-items" className={fieldsetSlots.items()}>
				{children}
			</div>
		</BaseFieldset.Root>
	);
}
