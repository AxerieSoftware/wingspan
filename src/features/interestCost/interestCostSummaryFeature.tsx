import { effect, untracked } from '@preact/signals-core';
import type { Calendar } from '../../common/calendar';
import type { MonarchDataService } from '../../data/services/monarchDataService';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import type { WingspanFeature } from '../wingspanFeature';
import { InterestCostCard } from './components/interestCostCard';
import type { InterestCostCalculator } from './services/interestCostCalculator';

const SUMMARY_CARD = 'interestCost';

/** What debt interest costs at today's balances, in a page's row of totals after Loans paid down. Hidden while no debt shown costs interest, and for periods that ended, since it's about today. */
export class InterestCostSummaryFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private island: Island | null = null;

	public constructor(
		private readonly screen: SummaryScreen,
		private readonly monarchData: MonarchDataService,
		private readonly calculator: InterestCostCalculator,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void this.monarchData.snapshot.value;
				untracked(() => this.sync());
			})
		);
	}

	public sync(): void {
		const page = this.screen.page;
		if (!page.isActive) {
			page.removeSummaryCard(SUMMARY_CARD);
			return;
		}

		void this.monarchData.load();
		const snapshot = this.monarchData.snapshot.peek();
		const look = page.summaryCardLook;
		const cost = snapshot ? this.calculator.calculate(snapshot, this.screen.currentScope()) : null;
		const endDate = this.screen.currentView()?.dates.endDate;
		const hasPeriodEnded = endDate !== undefined && endDate < this.calendar.today();
		if (!look || !cost?.debts.length || hasPeriodEnded) {
			page.removeSummaryCard(SUMMARY_CARD);
			return;
		}

		page.showSummaryCard(SUMMARY_CARD, { render: hostElement => this.mountCard(hostElement) });
		this.island?.render(<InterestCostCard look={look} cost={cost} formatter={this.formatter} />);
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.screen.page.removeSummaryCard(SUMMARY_CARD);
	}

	private mountCard(hostElement: HTMLElement): () => void {
		this.island = new Island(hostElement);
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}
}
