import type { RecurringV2DetailRow } from '../../../../monarch/pages/recurringV2/models/recurringV2DetailRow';
import { DayPicker } from '../../../../monarch/ui/components/dayPicker';
import { Island } from '../../../../monarch/ui/components/island';
import { MetaRowContent } from '../../../../monarch/ui/components/metaRow';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { WingspanMark } from '../../../wingspanMark';

interface DueDayPanelRowProps {
	itemId: string;
	customDueDay: number | undefined;
	expectedDueDate: string | null;
}

/** The Due day row in a Monarch item's panel. Automatic means the date Monarch expects. */
export class DueDayPanelRow implements RecurringV2DetailRow {
	private rowIsland: Island | null = null;
	private props: DueDayPanelRowProps | null = null;
	private renderedKey = '';

	public constructor(
		private readonly formatter: Formatter,
		private readonly onChange: (itemId: string, customDueDay: number | undefined) => void
	) {}

	/** Rerenders only when the item, its day or the expected date changed. */
	public update(props: DueDayPanelRowProps): void {
		this.props = props;
		this.renderContent();
	}

	public render(detailRowEl: HTMLElement): () => void {
		this.rowIsland = new Island(detailRowEl);
		this.renderedKey = '';
		this.renderContent();
		return () => {
			this.rowIsland?.unmount();
			this.rowIsland = null;
		};
	}

	private renderContent(): void {
		if (!this.rowIsland || !this.props) return;

		const { itemId, customDueDay, expectedDueDate } = this.props;
		const renderKey = `${itemId}|${customDueDay ?? ''}|${expectedDueDate ?? ''}`;
		if (this.renderedKey === renderKey) return;

		this.renderedKey = renderKey;
		this.rowIsland.render(
			<MetaRowContent label="Due day">
				<div className="flex min-w-0 items-center gap-xs">
					<DayPicker
						inline
						label="Due day"
						automatic={expectedDueDate ? `Automatic (${this.formatter.shortDate(expectedDueDate)})` : 'Automatic'}
						value={customDueDay}
						formatter={this.formatter}
						onChange={dueDay => this.onChange(itemId, dueDay)}
					/>
					<WingspanMark />
				</div>
			</MetaRowContent>
		);
	}
}
