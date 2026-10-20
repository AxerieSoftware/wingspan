import { computed, effect, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import type { Calendar } from '../../common/calendar';
import { logError } from '../../common/log';
import type { MonarchDataService, MonarchSnapshot } from '../../data/services/monarchDataService';
import type { IncomeRequest } from '../../monarch/api/models/incomeRequest';
import type { LoanBalances } from '../../monarch/api/models/loanBalances';
import type { MonarchCashFlowClient } from '../../monarch/api/monarchCashFlowClient';
import type { MonarchLoansClient } from '../../monarch/api/monarchLoansClient';
import type { SummaryCardLook } from '../../monarch/pages/summaryRow';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { EntityScope } from '../businessEntities/models/entityScope';
import type { ManualLoanUpdates } from '../interestCost/services/manualLoanUpdates';
import type { SummaryDates, SummaryScreen, SummaryView } from '../summaryScreens/models/summaryScreen';
import type { WingspanFeature } from '../wingspanFeature';
import { LoansPaidDownCard, type LoansPaidDownState } from './components/loansPaidDownCard';
import type { LoansPaidDownCalculator, ManualLoanPayments } from './services/loansPaidDownCalculator';

const SUMMARY_CARD = 'loansPaidDown';
const LOAN_BALANCES_QUERY = 'monarchLoanBalances';
const INCOME_QUERY = 'monarchIncome';
/** After loans fail to load, how long to wait before a page change retries. */
const LOAD_RETRY_MS = 60_000;
/** Balances are read at the end of a day, so a period's starting balance is the day before's. */
const PREVIOUS_DAY = -1;

/** Monarch's loan balances and income for the dates shown. */
type LoadedTotals = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; loans: LoanBalances[]; income: number };

/** The dates and entities the card is for, and what's loaded for them. */
interface ShownPaydown {
	key: string;
	dates: SummaryDates;
	scope: EntityScope;
	balanceStartDate: string;
	balancesThrough: string;
	totals: LoadedTotals;
}

/** Loans paid down, in a page's row of totals after Monarch's Savings rate. */
export class LoansPaidDownFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly shown = signal<ShownPaydown | null>(null);
	/** Worked out again only when what's shown, Monarch's transactions or the linked payments change, not on every sync. */
	private readonly paydown = computed(() => {
		const shown = this.shown.value;
		return shown ? this.paydownState(shown) : null;
	});
	private look: SummaryCardLook | null = null;
	private island: Island | null = null;
	private retryAt = 0;

	public constructor(
		private readonly screen: SummaryScreen,
		private readonly monarchData: MonarchDataService,
		private readonly manualLoans: ManualLoanUpdates,
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
				void this.paydown.value;
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
		const balanceStartDate = this.calendar.addDays(view.dates.startDate, PREVIOUS_DAY);
		const key = JSON.stringify({ dates: view.dates, entityIds: view.scope.entityIds, income: view.income, balancesThrough });
		const current = this.shown.peek();
		const hasFailed = current?.key === key && current.totals.status === 'failed';
		if (current?.key !== key || (hasFailed && Date.now() >= this.retryAt)) {
			this.shown.value = { key, dates: view.dates, scope: view.scope, balanceStartDate, balancesThrough, totals: { status: 'loading' } };
			void this.load(key, view, balanceStartDate, balancesThrough);
		}
		if (this.manualLoans.hasAnyLinkedPayment() && !this.monarchData.snapshot.peek()) void this.monarchData.load();
		this.placeCard();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.screen.page.removeSummaryCard(SUMMARY_CARD);
	}

	/** Shows the card while there are loans to count and Monarch's row of totals is there to copy, otherwise removes it. */
	private placeCard(): void {
		const shown = this.shown.peek();
		const state = this.paydown.peek();
		if (!shown || !state || !this.look) {
			this.screen.page.removeSummaryCard(SUMMARY_CARD);
			return;
		}

		this.screen.page.showSummaryCard(SUMMARY_CARD, { render: hostElement => this.mountCard(hostElement) });
		this.island?.render(<LoansPaidDownCard look={this.look} state={state} dates={shown.dates} balancesThrough={shown.balancesThrough} formatter={this.formatter} />);
	}

	/** Null when there are no loans to count. Linked manual loans count their payments, so the paydown waits for Monarch's transactions. */
	private paydownState({ totals, scope, balanceStartDate, balancesThrough }: ShownPaydown): LoansPaidDownState | null {
		if (totals.status !== 'ready') return totals;
		// Read so linking a payment or entering a balance works it out again.
		void this.manualLoans.changes.value;
		const monarch = this.monarchData.state.value;
		const linkedLoanIds = this.manualLoans.linkedLoanAccountIds();
		if (linkedLoanIds.length && monarch.status === 'loading') return { status: 'loading' };
		const snapshot = monarch.status === 'ready' ? monarch.snapshot : null;
		const paydown = this.calculator.calculate(totals.loans, totals.income, scope, this.manualLoanPayments(linkedLoanIds, snapshot, balanceStartDate, balancesThrough));
		return paydown ? { status: 'ready', paydown } : null;
	}

	private mountCard(hostElement: HTMLElement): () => void {
		this.island = new Island(hostElement);
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}

	private async load(key: string, view: SummaryView, balanceStartDate: string, balancesThrough: string): Promise<void> {
		let totals: LoadedTotals;
		try {
			const [loans, income] = await Promise.all([
				this.queryClient.query({ queryKey: [LOAN_BALANCES_QUERY, balanceStartDate, balancesThrough], queryFn: () => this.loansClient.getLoanBalances(balanceStartDate, balancesThrough) }),
				view.income ?? this.loadIncome({ ...view.dates, businessEntitySet: view.scope.toBusinessEntitySet() })
			]);
			totals = { status: 'ready', loans, income };
		} catch (error) {
			logError(error);
			this.retryAt = Date.now() + LOAD_RETRY_MS;
			totals = { status: 'failed' };
		}

		const current = this.shown.peek();
		if (current?.key === key) this.shown.value = { ...current, totals };
	}

	/** Null when Monarch's transactions don't reach back to the period's start, so a manual loan's payments can't all be counted. */
	private manualLoanPayments(linkedLoanIds: string[], snapshot: MonarchSnapshot | null, balanceStartDate: string, throughDate: string): ManualLoanPayments | null {
		if (!snapshot || snapshot.transactionsFrom > balanceStartDate) return null;
		const paymentsByLoanId = new Map(linkedLoanIds.map(loanAccountId => [loanAccountId, this.manualLoans.postedPaymentsToward(loanAccountId, snapshot.transactions)]));
		return { balanceStartDate, throughDate, paymentsByLoanId };
	}

	private loadIncome(request: IncomeRequest): Promise<number> {
		return this.queryClient.query({ queryKey: [INCOME_QUERY, request], queryFn: () => this.cashFlowClient.getIncome(request) });
	}
}
