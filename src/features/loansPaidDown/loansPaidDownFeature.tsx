import { effect, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import type { Calendar } from '../../common/calendar';
import { logError } from '../../common/log';
import type { BusinessEntitySetInput, IncomeRequest } from '../../monarch/api/models/incomeRequest';
import type { MonarchCashFlowClient } from '../../monarch/api/monarchCashFlowClient';
import type { MonarchLoansClient } from '../../monarch/api/monarchLoansClient';
import type { SummaryCardLook } from '../../monarch/pages/summaryRow';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import { type EntityScope, HOUSEHOLD_ENTITY_ID } from '../businessEntities/models/entityScope';
import type { SummaryDates, SummaryScreen, SummaryView } from '../summaryScreens/models/summaryScreen';
import type { WingspanFeature } from '../wingspanFeature';
import { LoansPaidDownCard, type LoansPaidDownState } from './components/loansPaidDownCard';
import type { LoansPaidDownCalculator } from './services/loansPaidDownCalculator';

const SUMMARY_CARD = 'loansPaidDown';
const LOAN_BALANCES_QUERY = 'monarchLoanBalances';
const INCOME_QUERY = 'monarchIncome';
/** After loans fail to load, how long to wait before a page change retries. */
const LOAD_RETRY_MS = 60_000;
/** Balances are read at the end of a day, so a period's starting balance is the day before's. */
const PREVIOUS_DAY = -1;

/** What the card shows, and for which dates and entities. */
interface ShownPaydown {
	key: string;
	dates: SummaryDates;
	balancesThrough: string;
	state: LoansPaidDownState | null;
}

/** Loans paid down, in a page's row of totals after Monarch's Savings rate. */
export class LoansPaidDownFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly shown = signal<ShownPaydown | null>(null);
	private look: SummaryCardLook | null = null;
	private island: Island | null = null;
	private retryAt = 0;

	public constructor(
		private readonly screen: SummaryScreen,
		private readonly loansClient: MonarchLoansClient,
		private readonly cashFlowClient: MonarchCashFlowClient,
		private readonly calculator: LoansPaidDownCalculator,
		private readonly queryClient: QueryClient,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void this.shown.value;
				this.placeCard();
			})
		);
	}

	/** On its page, loads the loans when the dates or entities shown change. Elsewhere, or with no dates to cover, removes the card. */
	public sync(): void {
		const view = this.screen.page.isActive ? this.screen.currentView() : null;
		if (!view) {
			this.shown.value = null;
			this.screen.page.removeSummaryCard(SUMMARY_CARD);
			return;
		}

		this.look = this.screen.page.summaryCardLook;
		const today = this.calendar.today();
		const balancesThrough = view.dates.endDate < today ? view.dates.endDate : today;
		const key = JSON.stringify({ dates: view.dates, entityIds: view.scope.entityIds, income: view.income, balancesThrough });
		const current = this.shown.peek();
		const hasFailed = current?.key === key && current.state?.status === 'failed';
		if (current?.key !== key || (hasFailed && Date.now() >= this.retryAt)) {
			this.shown.value = { key, dates: view.dates, balancesThrough, state: { status: 'loading' } };
			void this.load(key, view, balancesThrough);
		}
		this.placeCard();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.screen.page.removeSummaryCard(SUMMARY_CARD);
	}

	/** Shows the card while there are loans to count and Monarch's row of totals is there to copy, otherwise removes it. */
	private placeCard(): void {
		const shown = this.shown.peek();
		if (!shown?.state || !this.look) {
			this.screen.page.removeSummaryCard(SUMMARY_CARD);
			return;
		}

		this.screen.page.showSummaryCard(SUMMARY_CARD, { render: hostElement => this.mountCard(hostElement) });
		this.island?.render(<LoansPaidDownCard look={this.look} state={shown.state} dates={shown.dates} balancesThrough={shown.balancesThrough} formatter={this.formatter} />);
	}

	private mountCard(hostElement: HTMLElement): () => void {
		this.island = new Island(hostElement);
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}

	private async load(key: string, view: SummaryView, balancesThrough: string): Promise<void> {
		const balanceStartDate = this.calendar.addDays(view.dates.startDate, PREVIOUS_DAY);
		let state: LoansPaidDownState | null;
		try {
			const [loans, income] = await Promise.all([
				this.queryClient.query({ queryKey: [LOAN_BALANCES_QUERY, balanceStartDate, balancesThrough], queryFn: () => this.loansClient.getLoanBalances(balanceStartDate, balancesThrough) }),
				view.income ?? this.loadIncome({ ...view.dates, businessEntitySet: this.businessEntitySetOf(view.scope) })
			]);
			const paydown = this.calculator.calculate(loans, income, view.scope);
			state = paydown ? { status: 'ready', paydown } : null;
		} catch (error) {
			logError(error);
			this.retryAt = Date.now() + LOAD_RETRY_MS;
			state = { status: 'failed' };
		}

		const current = this.shown.peek();
		if (current?.key === key) this.shown.value = { ...current, state };
	}

	private loadIncome(request: IncomeRequest): Promise<number> {
		return this.queryClient.query({ queryKey: [INCOME_QUERY, request], queryFn: () => this.cashFlowClient.getIncome(request) });
	}

	/** Monarch's own filter for its totals, so the share of income matches the Income card. Left out when every entity is shown. */
	private businessEntitySetOf(scope: EntityScope): BusinessEntitySetInput | undefined {
		if (scope.isEverything) return undefined;
		return { businessEntityIds: scope.entityIds.filter(entityId => entityId !== HOUSEHOLD_ENTITY_ID), includeUnassigned: scope.entityIds.includes(HOUSEHOLD_ENTITY_ID) };
	}
}
