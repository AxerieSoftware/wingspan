import type { CategorySummaryPage, SummaryRowLook } from '../../../monarch/pages/categories/categorySummaryPage';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import { WingspanMark } from '../../wingspanMark';
import type { MonthlyAverageCalculator } from './services/monthlyAverageCalculator';

/** "Average per month" in the Summary of a category's page, under Monarch's "Average transaction". */
export class MonthlyAverageFeature implements WingspanFeature {
	private island: Island | null = null;
	/** What the row last rendered, as JSON, so a sync that changes nothing doesn't render again. */
	private renderedPropsJson: string | null = null;

	public constructor(
		private readonly page: CategorySummaryPage,
		private readonly calculator: MonthlyAverageCalculator,
		private readonly formatter: Formatter
	) {}

	/** Nothing to subscribe to: everything comes from Monarch's Summary, and every change to it syncs. */
	public start(): void {}

	public sync(): void {
		const summary = this.page.isActive ? this.page.summary : null;
		const average = summary ? this.calculator.average(summary.total, this.page.period, summary.firstTransactionDate) : null;
		if (!summary || average === null) {
			this.page.removeRow();
			return;
		}

		this.page.showRow({ render: hostElement => this.mount(hostElement) });
		const value = this.formatter.money(average);
		const propsJson = JSON.stringify([summary.look, value]);
		if (!this.island || propsJson === this.renderedPropsJson) return;
		this.renderedPropsJson = propsJson;
		this.island.render(<AverageRow look={summary.look} value={value} />);
	}

	public [Symbol.dispose](): void {
		this.page.removeRow();
	}

	private mount(hostElement: HTMLElement): () => void {
		this.island = new Island(hostElement);
		this.renderedPropsJson = null;
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}
}

function AverageRow({ look, value }: { look: SummaryRowLook; value: string }) {
	return (
		<div className={look.rowClassName}>
			<dt className={`${look.labelClassName} inline-flex items-center gap-2xs`}>
				Average per month
				<WingspanMark />
			</dt>
			<dd className={look.valueClassName}>
				<span className={look.valueTextClassName}>{value}</span>
			</dd>
		</div>
	);
}
