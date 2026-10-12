import { effect, untracked } from '@preact/signals-core';
import type { MonarchDataService } from '../../data/services/monarchDataService';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import type { WingspanFeature } from '../wingspanFeature';
import { InterestCostCard } from './components/interestCostCard';
import type { InterestCostCalculator } from './services/interestCostCalculator';

const SUMMARY_CARD = 'interestCost';

/** What debt interest costs, in a page's row of totals after Loans paid down. Hidden while no debt shown costs interest. */
export class InterestCostSummaryFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private island: Island | null = null;

	public constructor(
		private readonly screen: SummaryScreen,
		private readonly monarchData: MonarchDataService,
		private readonly calculator: InterestCostCalculator,
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
		if (!look || !cost?.debts.length) {
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
