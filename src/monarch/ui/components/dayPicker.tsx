import { Popover as BasePopover } from '@base-ui/react/popover';
import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { useState } from 'react';
import { LAST_DAY_OF_MONTH } from '../../../common/calendar';
import type { Formatter } from '../formatter';
import { usePortalPlacement } from '../portalContainer';
import { INLINE_SELECT_TRIGGER_CLASS_NAME, menuStyles, popoverStyles, selectStyles } from '../styles';
import { ChevronIcon } from './icons';

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, dayIndex) => dayIndex + 1);
const AUTOMATIC_VALUE = 'auto';
const DAY_CELL_CLASS_NAME =
	'inline-flex size-8 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-sm font-book text-content-primary outline-none ' +
	'hover:bg-background-secondary-hover focus-visible:bg-background-secondary-hover data-checked:bg-background-info data-checked:font-medium data-checked:text-content-info';

/** `automatic` is the label for the no-set-day option; omit it to require a day. `inline` shows the trigger as plain text. */
export interface DayPickerProps {
	value: number | undefined;
	label: string;
	automatic?: string;
	inline?: boolean;
	formatter: Formatter;
	onChange(day: number | undefined): void;
}

/** Picks a day of the month from a calendar-style grid in a popover. */
export function DayPicker({ value, label, automatic, inline, formatter, onChange }: DayPickerProps) {
	const portalPlacement = usePortalPlacement();
	const [isOpen, setIsOpen] = useState(false);
	const selectSlots = selectStyles();
	const popoverSlots = popoverStyles();
	const shownLabel = value ? formatter.dayOfMonth(value) : (automatic ?? 'Choose a day');

	const chooseDay = (chosenValue: unknown) => {
		onChange(chosenValue === AUTOMATIC_VALUE ? undefined : Number(chosenValue));
		setIsOpen(false);
	};

	return (
		<BasePopover.Root open={isOpen} onOpenChange={setIsOpen}>
			<BasePopover.Trigger className={inline ? INLINE_SELECT_TRIGGER_CLASS_NAME : selectSlots.trigger()} aria-label={`${label}: ${shownLabel}`}>
				{inline ? (
					<span className={selectSlots.valueLabel()}>{shownLabel}</span>
				) : (
					<>
						<span className={selectSlots.value()}>
							<span className={selectSlots.valueLabel()}>{shownLabel}</span>
						</span>
						<span aria-hidden="true" className={selectSlots.icon()}>
							<ChevronIcon />
						</span>
					</>
				)}
			</BasePopover.Trigger>
			<BasePopover.Portal container={portalPlacement.container}>
				<BasePopover.Positioner positionMethod={portalPlacement.positionMethod} side="bottom" align="start" sideOffset={8} className={popoverSlots.positioner()}>
					<BasePopover.Popup data-mds="popover-content" className={popoverSlots.content({ className: 'w-auto p-sm' })}>
						<BaseRadioGroup value={value ? String(value) : AUTOMATIC_VALUE} onValueChange={chooseDay} aria-label={label} className="flex flex-col gap-xs">
							{automatic !== undefined ? (
								<BaseRadio.Root value={AUTOMATIC_VALUE} className={`${menuStyles().item()} mx-0`}>
									{automatic}
								</BaseRadio.Root>
							) : null}
							<div className="grid grid-cols-7 gap-2xs">
								{DAYS_OF_MONTH.map(day => (
									<BaseRadio.Root
										key={day}
										value={String(day)}
										className={DAY_CELL_CLASS_NAME}
										aria-label={formatter.dayOfMonth(day)}
										title={day === LAST_DAY_OF_MONTH ? formatter.dayOfMonth(day) : undefined}
									>
										{day}
									</BaseRadio.Root>
								))}
							</div>
							<span className="px-2xs text-xs text-content-secondary">29–31 fall on the last day in shorter months.</span>
						</BaseRadioGroup>
					</BasePopover.Popup>
				</BasePopover.Positioner>
			</BasePopover.Portal>
		</BasePopover.Root>
	);
}
