import type { HistoryChipLook } from '../../../../monarch/pages/budget/budgetPage';
import { SkeletonText } from '../../../../monarch/ui/components/skeleton';
import type { Formatter } from '../../../../monarch/ui/formatter';
import type { CategoryAverages } from '../models/categoryAverages';

export interface CategoryAveragesRowsProps {
	look: HistoryChipLook;
	/** Null while loading. */
	averages: CategoryAverages | null;
	/** An income category says "Earned" where an expense category says "Spent", as Monarch's chips do. */
	isIncome: boolean;
	formatter: Formatter;
	/** Enters an average, rounded to the dollar as shown, as the budget amount. */
	onPick(amount: number): void;
}

interface AverageChip {
	label: string;
	/** Undefined while loading. */
	amount: number | undefined;
	/** A monthly average can be used as the budget amount; the year's total can't. */
	isPickable: boolean;
}

/**
 * More history under Monarch's "Spent last month" and six-month "Monthly average", in two more rows of two like
 * Monarch's, built from the classes of Monarch's chips.
 */
export function CategoryAveragesRows({ look, averages, isIncome, formatter, onPick }: CategoryAveragesRowsProps) {
	const rows: AverageChip[][] = [
		[
			{ label: '3-month average', amount: averages?.threeMonths, isPickable: true },
			{ label: '12-month average', amount: averages?.twelveMonths, isPickable: true }
		],
		[
			// January has no full month yet this year.
			...(averages?.yearToDate === null ? [] : [{ label: 'Year-to-date average', amount: averages?.yearToDate, isPickable: true }]),
			{ label: isIncome ? 'Earned this year' : 'Spent this year', amount: averages?.thisYear, isPickable: false }
		]
	];

	return rows.map(chips => (
		<div key={chips[0]?.label} className={look.rowClassName}>
			{chips.map(chip => (
				<AverageChipView key={chip.label} chip={chip} look={look} formatter={formatter} onPick={onPick} />
			))}
		</div>
	));
}

function AverageChipView({ chip, look, formatter, onPick }: { chip: AverageChip; look: HistoryChipLook; formatter: Formatter; onPick(amount: number): void }) {
	const { label, amount, isPickable } = chip;
	const content = (
		<>
			{amount === undefined ? <SkeletonText style={{ width: '50%' }} /> : <span className={look.valueClassName}>{formatter.wholeMoney(amount)}</span>}
			<span className={look.labelClassName}>{label}</span>
		</>
	);
	if (!isPickable) {
		return (
			<div className={look.chipClassName} style={{ flex: '1 1 0%', cursor: 'default' }}>
				{content}
			</div>
		);
	}

	const pick = () => {
		if (amount === undefined) return;
		onPick(Math.round(amount));
	};
	return (
		// Like Monarch's chips, these are clicked rather than tabbed to: moving focus off the budget amount closes the popover.
		<div
			role="button"
			tabIndex={-1}
			className={look.chipClassName}
			style={{ flex: '1 1 0%' }}
			aria-disabled={amount === undefined}
			aria-label={amount === undefined ? label : `${label}, ${formatter.wholeMoney(amount)}. Use as budget`}
			onClick={pick}
			onKeyDown={event => {
				if (event.key === 'Enter') pick();
			}}
		>
			{content}
		</div>
	);
}
