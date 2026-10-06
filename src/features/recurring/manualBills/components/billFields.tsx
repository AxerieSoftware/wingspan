import { useState } from 'react';
import { LAST_DAY_OF_MONTH } from '../../../../common/calendar';
import type { Account } from '../../../../monarch/api/models/account';
import { CheckboxLabel } from '../../../../monarch/ui/components/checkbox';
import { DayPicker } from '../../../../monarch/ui/components/dayPicker';
import { Field, FormGrid } from '../../../../monarch/ui/components/field';
import { MoneyInput, TextInput } from '../../../../monarch/ui/components/input';
import { Select } from '../../../../monarch/ui/components/select';
import type { MerchantContainsMatchRule } from '../../recurringItems/models/recurringItem';
import type { EditedField, RecurringItemDraft } from '../../recurringItems/models/recurringItemDraft';
import { CUSTOM_PRESET_KEY, SCHEDULE_PRESETS, type Schedule, type ScheduleUnit } from '../../recurringItems/models/schedule';
import type { RecurringItemServices } from '../../recurringItems/services/recurringItemServices';
import type { ManualBillItem } from '../models/manualBillItem';

const ANY_ACCOUNT = '';
const TWICE_MONTHLY_GAP_DAYS = 15;
const UNIT_OPTIONS = [
	['week', 'weeks'],
	['month', 'months'],
	['year', 'years']
] as const;

/** `onChange` reports which field changed, so picking payments later doesn't overwrite it. */
export interface BillFieldsProps {
	item: ManualBillItem;
	draft: RecurringItemDraft;
	accounts: Account[];
	services: RecurringItemServices;
	onChange(draft: RecurringItemDraft, editedField: EditedField): void;
}

interface ScheduleFieldsProps {
	schedule: Schedule;
	services: RecurringItemServices;
	onChange(schedule: Schedule): void;
}

export function BillFields({ item, draft, accounts, services, onChange }: BillFieldsProps) {
	const { formatter } = services;
	const matchRule = item.matchRule;
	const currentPayer = accounts.find(account => account.id === matchRule?.accountId);
	const payerAccounts = accounts.filter(account => (account.isAsset && !account.isHidden) || account === currentPayer);
	const payerOptions = [[ANY_ACCOUNT, 'Any account'] as const, ...payerAccounts.map(account => [account.id, account.displayName] as const)];
	if (matchRule?.accountId && !currentPayer) payerOptions.push([matchRule.accountId, accounts.length ? 'Closed account' : "Couldn't load accounts from Monarch"]);

	const changeItem = (editedField: EditedField, patch: Partial<ManualBillItem>) => onChange({ ...draft, item: { ...item, ...patch } }, editedField);
	const changeMatchRule = (patch: Partial<MerchantContainsMatchRule>) => matchRule && changeItem('matchRule', { matchRule: { ...matchRule, ...patch } });
	const changeSchedule = (schedule: Schedule) => onChange({ ...draft, schedule }, 'schedule');

	return (
		<div className="mt-lg">
			<FormGrid>
				<Field
					label="Amount"
					labelAside={<CheckboxLabel label="Any amount" checked={!!matchRule?.anyAmount} disabled={!matchRule} onChange={isAnyAmount => changeMatchRule({ anyAmount: isAnyAmount || undefined })} />}
				>
					<MoneyInput value={item.amount || null} formatter={formatter} onChange={amount => changeItem('amount', { amount: amount ?? 0 })} />
				</Field>
				<ScheduleFields schedule={draft.schedule} services={services} onChange={changeSchedule} />
				<Field label="Transaction contains">
					<TextInput
						value={matchRule?.matchText ?? ''}
						placeholder="e.g. Green Lawn Co"
						onChange={matchText => changeItem('matchRule', { matchRule: matchText.trim() ? { ...matchRule, matchText } : undefined })}
					/>
				</Field>
				<Field label="Paid from">
					<Select options={payerOptions} value={matchRule?.accountId ?? ANY_ACCOUNT} disabled={!matchRule} onChange={accountId => changeMatchRule({ accountId: accountId || undefined })} />
				</Field>
			</FormGrid>
		</div>
	);
}

function ScheduleFields({ schedule, services, onChange }: ScheduleFieldsProps) {
	const { calendar, formatter, recurrence } = services;
	// Keep Custom selected even when its fields match a preset, e.g. every 1 month before the unit is changed.
	const [isCustomChosen, setIsCustomChosen] = useState(() => recurrence.presetOf(schedule) === CUSTOM_PRESET_KEY);
	const presetKey = isCustomChosen ? CUSTOM_PRESET_KEY : recurrence.presetOf(schedule);
	const today = calendar.today();
	const nextDueDate = schedule.start >= today ? schedule.start : (recurrence.upcomingDue(recurrence.toRecurrence(schedule), today) ?? today);
	const twiceMonthlyDays = schedule.twiceMonthlyDays;

	const choosePreset = (chosenKey: string) => {
		const preset = SCHEDULE_PRESETS.find(candidate => candidate.key === chosenKey);
		const monthDay = schedule.monthDay ?? calendar.dayOf(nextDueDate);
		setIsCustomChosen(!preset);
		if (!preset) return onChange({ ...schedule, every: twiceMonthlyDays ? 1 : schedule.every, twiceMonthlyDays: undefined, monthDay });
		if (preset.twiceMonthly) {
			const firstDay = Math.min(monthDay, TWICE_MONTHLY_GAP_DAYS);
			return onChange({ ...schedule, every: 1, unit: 'month', monthDay: undefined, twiceMonthlyDays: [firstDay, Math.min(firstDay + TWICE_MONTHLY_GAP_DAYS, LAST_DAY_OF_MONTH)] });
		}
		onChange({ ...schedule, every: preset.every, unit: preset.unit, twiceMonthlyDays: undefined, monthDay: preset.unit === 'month' ? monthDay : undefined, start: nextDueDate });
	};

	const chooseNextDue = (start: string) => {
		if (start) onChange({ ...schedule, start, monthDay: schedule.unit === 'month' ? calendar.dayOf(start) : undefined });
	};

	const chooseUnit = (unit: ScheduleUnit) => onChange({ ...schedule, unit, monthDay: unit === 'month' ? calendar.dayOf(nextDueDate) : undefined });

	return (
		<>
			<Field label="Frequency">
				<Select options={[...SCHEDULE_PRESETS.map(preset => [preset.key, preset.label] as const), [CUSTOM_PRESET_KEY, 'Custom…']]} value={presetKey} onChange={choosePreset} />
			</Field>
			{twiceMonthlyDays ? (
				<Field label="Days">
					<div className="grid grid-cols-2 gap-xs">
						<DayPicker label="First day" value={twiceMonthlyDays[0]} formatter={formatter} onChange={day => day && onChange({ ...schedule, twiceMonthlyDays: [day, twiceMonthlyDays[1]] })} />
						<DayPicker label="Second day" value={twiceMonthlyDays[1]} formatter={formatter} onChange={day => day && onChange({ ...schedule, twiceMonthlyDays: [twiceMonthlyDays[0], day] })} />
					</div>
				</Field>
			) : (
				<Field label={schedule.unit === 'week' ? 'Next due (sets the weekday)' : 'Next due'}>
					<TextInput type="date" value={nextDueDate} onChange={chooseNextDue} />
				</Field>
			)}
			{presetKey === CUSTOM_PRESET_KEY && !twiceMonthlyDays ? (
				<>
					<Field label="Repeats every">
						<div className="grid grid-cols-2 gap-xs">
							<TextInput
								type="number"
								min="1"
								step="1"
								inputMode="numeric"
								aria-label="Every"
								value={String(schedule.every)}
								onChange={every => onChange({ ...schedule, every: Math.max(1, Math.floor(Number(every) || 1)) })}
							/>
							<Select options={UNIT_OPTIONS} value={schedule.unit} label="Unit" onChange={chooseUnit} />
						</div>
					</Field>
					<div />
				</>
			) : null}
		</>
	);
}
