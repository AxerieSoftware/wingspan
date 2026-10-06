import { Select as BaseSelect } from '@base-ui/react/select';
import type { ReactNode } from 'react';
import { usePortalPlacement } from '../portalContainer';
import { checkboxStyles, menuStyles, selectStyles } from '../styles';
import { CheckIcon, ChevronIcon } from './icons';

const EMPTY_OPTION_VALUE = '\u0000';

/** A 36px (`sm`) or 40px (`md`) trigger. */
export type SelectSize = 'sm' | 'md';
/** A value, its label, and an optional icon or tag shown with it. */
export type SelectOption<TValue extends string> = readonly [value: TValue, label: string, adornment?: ReactNode];

/** An option's value may be an empty string, as for a "None" choice. */
export interface SelectProps<TValue extends string> {
	options: readonly SelectOption<TValue>[];
	value: NoInfer<TValue>;
	label?: string;
	disabled?: boolean;
	onChange(value: TValue): void;
}

/** With no values selected, the trigger shows "All". */
export interface MultiSelectProps {
	options: readonly SelectOption<string>[];
	values: readonly string[];
	label: string;
	size?: SelectSize;
	disabled?: boolean;
	onChange(values: string[]): void;
}

interface SelectPopupProps {
	className?: string;
	children: ReactNode;
}

export function Select<TValue extends string>({ options, value, label, disabled, onChange }: SelectProps<TValue>) {
	const selectSlots = selectStyles();
	const menuSlots = menuStyles();
	const items = options.map(([optionValue, optionLabel, adornment]) => ({ value: toItemValue(optionValue), label: optionLabel, adornment }));

	return (
		<BaseSelect.Root
			items={items}
			value={toItemValue(value)}
			disabled={disabled}
			onValueChange={itemValue => {
				const chosen = options.find(([optionValue]) => toItemValue(optionValue) === itemValue);
				if (chosen) onChange(chosen[0]);
			}}
		>
			<BaseSelect.Trigger data-mds="select-trigger" className={selectSlots.trigger()} aria-label={label}>
				<BaseSelect.Value data-mds="select-value" className={selectSlots.value()}>
					{(selectedValue: string) => {
						const selectedItem = items.find(item => item.value === selectedValue);
						return (
							<>
								<span className={selectSlots.valueLabel({ className: 'flex-none' })}>{selectedItem?.label}</span>
								{selectedItem?.adornment}
							</>
						);
					}}
				</BaseSelect.Value>
				<SelectChevron />
			</BaseSelect.Trigger>
			<SelectPopup>
				{items.map(item => (
					<BaseSelect.Item key={item.value} value={item.value} data-mds="select-option" className={menuSlots.item()}>
						<BaseSelect.ItemText className={menuSlots.itemLabel({ className: 'flex-none' })}>{item.label}</BaseSelect.ItemText>
						{item.adornment}
					</BaseSelect.Item>
				))}
			</SelectPopup>
		</BaseSelect.Root>
	);
}

/** Monarch's select with a checkbox on each option, for choosing several. It's disabled with no options. */
export function MultiSelect({ options, values, label, size, disabled, onChange }: MultiSelectProps) {
	const selectSlots = selectStyles({ size, multiple: true });
	const menuSlots = menuStyles();
	const checkboxSlots = checkboxStyles({ size: 'sm' });

	return (
		<BaseSelect.Root multiple value={[...values]} disabled={disabled || options.length === 0} onValueChange={selectedValues => onChange(selectedValues)}>
			<BaseSelect.Trigger data-mds="select-trigger" className={selectSlots.trigger({ className: 'min-w-30' })} aria-label={label}>
				<BaseSelect.Value data-mds="select-value" className={selectSlots.value()}>
					<span className={selectSlots.valueLabel()}>{values.length ? `${values.length} selected` : 'All'}</span>
				</BaseSelect.Value>
				<SelectChevron />
			</BaseSelect.Trigger>
			<SelectPopup className="min-w-56">
				{options.map(([optionValue, optionLabel, leading]) => (
					<BaseSelect.Item key={optionValue} value={optionValue} data-mds="select-option" className={menuSlots.item({ className: 'data-selected:bg-transparent data-selected:text-content-primary' })}>
						<span className="inline-flex items-center gap-xs">
							<span aria-hidden="true" className={checkboxSlots.box({ className: 'pointer-events-none' })} data-checked={values.includes(optionValue) ? '' : undefined}>
								{values.includes(optionValue) ? <CheckIcon size={10} /> : null}
							</span>
							{leading}
						</span>
						<BaseSelect.ItemText className={menuSlots.itemLabel()}>{optionLabel}</BaseSelect.ItemText>
					</BaseSelect.Item>
				))}
			</SelectPopup>
		</BaseSelect.Root>
	);
}

function SelectChevron() {
	return (
		<span aria-hidden="true" className={selectStyles().icon()}>
			<ChevronIcon />
		</span>
	);
}

function SelectPopup({ className, children }: SelectPopupProps) {
	const portalPlacement = usePortalPlacement();
	const selectSlots = selectStyles();
	const menuSlots = menuStyles();

	return (
		<BaseSelect.Portal container={portalPlacement.container}>
			<BaseSelect.Positioner positionMethod={portalPlacement.positionMethod} sideOffset={8} align="start" alignItemWithTrigger={false} className={selectSlots.positioner()}>
				<BaseSelect.Popup data-mds="select-popup" className={selectSlots.popup({ className })}>
					<BaseSelect.List className={menuSlots.list()}>
						<div data-mds="select-scroller" className={menuSlots.scroller()}>
							{children}
						</div>
					</BaseSelect.List>
				</BaseSelect.Popup>
			</BaseSelect.Positioner>
		</BaseSelect.Portal>
	);
}

function toItemValue(optionValue: string): string {
	return optionValue === '' ? EMPTY_OPTION_VALUE : optionValue;
}
