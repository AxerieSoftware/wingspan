import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Field as BaseField } from '@base-ui/react/field';
import { checkboxStyles } from '../styles';
import { CheckIcon } from './icons';

/** `label` is the box's accessible name; the box shows no text. */
export interface CheckboxProps {
	checked: boolean;
	label: string;
	disabled?: boolean;
	size?: 'sm' | 'md';
	onChange(checked: boolean): void;
}

export function Checkbox({ checked, label, disabled, size, onChange }: CheckboxProps) {
	const checkboxSlots = checkboxStyles({ size });

	return (
		<BaseCheckbox.Root data-mds="checkbox" className={checkboxSlots.box()} checked={checked} disabled={disabled} onCheckedChange={isChecked => onChange(isChecked)} aria-label={label}>
			<BaseCheckbox.Indicator data-mds="checkbox-indicator" keepMounted className={checkboxSlots.indicator()}>
				<CheckIcon size={size === 'sm' ? 10 : 12} />
			</BaseCheckbox.Indicator>
		</BaseCheckbox.Root>
	);
}

/** A small checkbox with its label shown beside it. */
export interface CheckboxLabelProps extends Omit<CheckboxProps, 'size'> {}

/** Wrapped in its own Base UI field so a surrounding field doesn't treat it as its control and change its label. */
export function CheckboxLabel({ label, ...checkboxProps }: CheckboxLabelProps) {
	return (
		<BaseField.Root render={<span />} className="inline-flex items-center gap-xs" disabled={checkboxProps.disabled}>
			<Checkbox {...checkboxProps} label={label} size="sm" />
			<BaseField.Label className={`text-sm font-book ${checkboxProps.disabled ? 'text-content-secondary' : 'cursor-pointer text-content-primary'}`}>{label}</BaseField.Label>
		</BaseField.Root>
	);
}
