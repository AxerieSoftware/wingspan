import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { type ReactNode, useId } from 'react';
import { switchStyles } from '../styles';

/** `adornment` sits between the label and the switch. */
export interface SwitchRowProps {
	checked: boolean;
	label: string;
	disabled?: boolean;
	adornment?: ReactNode;
	onChange(checked: boolean): void;
}

/** A label and Monarch's toggle switch on one line. */
export function SwitchRow({ label, checked, disabled, adornment, onChange }: SwitchRowProps) {
	const switchId = useId();
	const switchSlots = switchStyles();

	return (
		<span data-mds="switch-field" className="group/mds-switch flex w-full items-center justify-between gap-md select-none">
			<label
				htmlFor={switchId}
				data-mds="switch-label"
				className={`min-w-0 flex-1 truncate text-base font-book ${disabled ? 'cursor-not-allowed text-content-secondary' : 'cursor-pointer text-content-primary'}`}
			>
				{label}
			</label>
			{adornment}
			<BaseSwitch.Root id={switchId} data-mds="switch" className={switchSlots.root()} checked={checked} disabled={disabled} onCheckedChange={isChecked => onChange(isChecked)}>
				<BaseSwitch.Thumb data-mds="switch-thumb" className={switchSlots.thumb()} />
			</BaseSwitch.Root>
		</span>
	);
}
