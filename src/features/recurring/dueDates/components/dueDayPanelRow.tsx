import { DayPicker } from '../../../../monarch/ui/components/dayPicker';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { WingspanPanelRow } from '../../shared/components/wingspanPanelRow';

interface DueDayPanelRowProps {
	itemId: string;
	customDueDay: number | undefined;
	expectedDueDate: string | null;
}

/** The Due day row in a Monarch item's panel. Automatic means the date Monarch expects. */
export class DueDayPanelRow extends WingspanPanelRow<DueDayPanelRowProps> {
	public constructor(
		private readonly formatter: Formatter,
		private readonly onChange: (itemId: string, customDueDay: number | undefined) => void
	) {
		super('Due day');
	}

	protected keyOf({ itemId, customDueDay, expectedDueDate }: DueDayPanelRowProps): string {
		return `${itemId}|${customDueDay ?? ''}|${expectedDueDate ?? ''}`;
	}

	protected control({ itemId, customDueDay, expectedDueDate }: DueDayPanelRowProps) {
		return (
			<DayPicker
				inline
				label="Due day"
				automatic={expectedDueDate ? `Automatic (${this.formatter.shortDate(expectedDueDate)})` : 'Automatic'}
				value={customDueDay}
				formatter={this.formatter}
				onChange={dueDay => this.onChange(itemId, dueDay)}
			/>
		);
	}
}
