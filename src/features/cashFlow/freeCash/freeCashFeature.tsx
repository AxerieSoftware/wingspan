import { effect } from '@preact/signals-core';
import type { Calendar } from '../../../common/calendar';
import type { CashFlowPage } from '../../../monarch/pages/cashFlow/cashFlowPage';
import type { RecurringV2Page } from '../../../monarch/pages/recurringV2/recurringV2Page';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import { StatementsSummaryLine } from '../../recurring/statements/components/statementsSummaryLine';
import type { StatementsMonthTotals, StatementsTotals } from '../../recurring/statements/services/statementsTotals';
import type { WingspanFeature } from '../../wingspanFeature';
import type { CashSettingsLauncher } from '../cashSettings/services/cashSettingsLauncher';
import type { ProjectedBalancesService, ProjectionState } from '../projectedBalances/services/projectedBalancesService';
import { FreeCashSummary, FreeCashSummaryLoading } from './components/freeCashSummary';

/** Free cash today on Recurring's month summary, under this month's statements. */
export class FreeCashFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private summaryIsland: Island | null = null;

	public constructor(
		private readonly page: RecurringV2Page,
		private readonly cashFlowPage: CashFlowPage,
		private readonly projectedBalances: ProjectedBalancesService,
		private readonly statementsTotals: StatementsTotals,
		private readonly cashSettingsLauncher: CashSettingsLauncher,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(effect(() => this.renderSummary(this.projectedBalances.state.value, this.statementsTotals.totals.value)));
	}

	/** Shows the summary while Recurring shows this month; otherwise removes it. */
	public sync(): void {
		if (!this.page.isShowingMonth(this.calendar.currentMonth())) {
			this.page.removeSummaryStatements();
			return;
		}

		this.page.showSummaryStatements({ render: summaryEl => this.mountSummary(summaryEl) });
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeSummaryStatements();
	}

	private mountSummary(summaryEl: HTMLElement): () => void {
		this.summaryIsland = new Island(summaryEl);
		this.renderSummary(this.projectedBalances.state.peek(), this.statementsTotals.totals.peek());
		return () => {
			this.summaryIsland?.unmount();
			this.summaryIsland = null;
		};
	}

	/** Fills in the Statements line Monarch shows as "Coming soon": this month's statements, then the free cash left after paying them. */
	private renderSummary(state: ProjectionState, totals: StatementsMonthTotals | null): void {
		if (!this.summaryIsland) return;
		const statementsLine = totals ? <StatementsSummaryLine totals={totals} formatter={this.formatter} /> : null;
		if (state.status === 'unavailable') {
			const what = state.missing === 'monarch' ? 'from Monarch' : "Wingspan's saved items and settings";
			this.summaryIsland.render(
				<>
					{statementsLine}
					<span className="text-sm font-book text-content-secondary">{`Couldn't load ${what}. Try again from Cash Flow.`}</span>
				</>
			);
			return;
		}
		if (state.status === 'loading') {
			this.summaryIsland.render(<FreeCashSummaryLoading />);
			return;
		}

		this.summaryIsland.render(
			<>
				{statementsLine}
				<div className={`flex w-full flex-col gap-2xs${statementsLine ? ' mt-xs' : ''}`}>
					<FreeCashSummary projection={state.projection} formatter={this.formatter} onEdit={() => this.cashSettingsLauncher.open(state.accounts)} onOpenProjection={() => this.cashFlowPage.open()} />
				</div>
				{state.staleAsOf !== null ? (
					<span className="text-xs font-book text-content-warning" role="status">{`Couldn't refresh from Monarch: as of ${this.formatter.asOf(state.staleAsOf)}`}</span>
				) : null}
			</>
		);
	}
}
