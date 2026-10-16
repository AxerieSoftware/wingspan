import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import { logError } from '../../../common/log';
import type { MonarchSnapshot } from '../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { Account } from '../../../monarch/api/models/account';
import type { EnteredBalance } from '../../../monarch/api/models/loanBalances';
import type { MonarchLoansClient } from '../../../monarch/api/monarchLoansClient';
import { Layer } from '../../../monarch/ui/components/layer';
import type { Formatter } from '../../../monarch/ui/formatter';
import { UpdateBalanceDialog } from '../components/updateBalanceDialog';
import { loanRateOf } from '../models/interestCost';
import type { ManualLoanView } from '../models/loanInterestView';
import type { LoanBalanceEstimator } from './loanBalanceEstimator';

const ENTERED_BALANCE_QUERY = 'monarchEnteredBalance';

/** A loan's balance as last entered: loading, loaded (null when Monarch has none), or failed. */
type EnteredBalanceState = { status: 'loading' } | { status: 'ready'; entered: EnteredBalance | null } | { status: 'failed' };

/**
 * The Monarch recurring expenses linked to each loan, manual loans' balances as last entered, today's estimate after
 * the linked payments, and the Update balance dialog. The loan's page, Recurring's Pays toward, a payment's transaction
 * details and Accounts all use it, so they agree.
 */
export class ManualLoanUpdates implements Disposable {
	private readonly enteredBalances = signal<ReadonlyMap<string, EnteredBalanceState>>(new Map());
	private readonly loanAccountIdByRecurrenceId: ReadonlySignal<Record<string, string>>;
	/** Changes whenever an entered balance loads or a payment is linked, for features to sync on. */
	public readonly changes: ReadonlySignal<unknown>;
	private dialogLayer: Layer | null = null;

	public constructor(
		private readonly window: Window,
		private readonly dataService: WingspanDataService,
		private readonly loansClient: MonarchLoansClient,
		private readonly queryClient: QueryClient,
		private readonly estimator: LoanBalanceEstimator,
		private readonly formatter: Formatter
	) {
		this.loanAccountIdByRecurrenceId = computed(() => this.dataService.data.value.loanPaymentLinks.loanAccountIdByRecurrenceId);
		this.changes = computed(() => [this.enteredBalances.value, this.loanAccountIdByRecurrenceId.value]);
	}

	/** The loan a Monarch recurring expense pays toward, if it's linked to one. */
	public loanAccountIdFor(recurrenceGroupId: string | undefined): string | undefined {
		return recurrenceGroupId ? this.loanAccountIdByRecurrenceId.peek()[recurrenceGroupId] : undefined;
	}

	/** Links a Monarch recurring expense to the loan it pays toward, or unlinks it with no loan. */
	public link(recurrenceGroupId: string, loanAccountId: string | undefined): Promise<void> {
		return this.dataService.update(data => {
			const loanAccountIdByRecurrenceId = { ...data.loanPaymentLinks.loanAccountIdByRecurrenceId };
			if (loanAccountId === undefined) delete loanAccountIdByRecurrenceId[recurrenceGroupId];
			else loanAccountIdByRecurrenceId[recurrenceGroupId] = loanAccountId;
			return { ...data, loanPaymentLinks: { ...data.loanPaymentLinks, loanAccountIdByRecurrenceId } };
		});
	}

	/** Whether any Monarch recurring expense is linked to a loan. */
	public hasAnyLinkedPayment(): boolean {
		return Object.keys(this.loanAccountIdByRecurrenceId.peek()).length > 0;
	}

	/** Whether a Monarch recurring expense is linked to the loan. */
	public hasLinkedPayment(loanAccountId: string): boolean {
		return this.linkedRecurrenceIdsFor(loanAccountId).size > 0;
	}

	/** The manual loan's balance as last entered and the estimate for today, loading the balance the first time it's asked for. */
	public view(account: Account, snapshot: MonarchSnapshot): ManualLoanView {
		const state = this.enteredBalances.peek().get(account.id);
		if (!state) void this.loadEnteredBalance(account.id);
		if (!state || state.status === 'loading') return { status: 'loading' };
		if (state.status === 'failed') return { status: 'failed' };
		if (!state.entered) return { status: 'none' };

		const { entered } = state;
		const rate = loanRateOf(account);
		const linkedRecurrenceIds = this.linkedRecurrenceIdsFor(account.id);
		const paymentsSince = snapshot.transactions
			.filter(transaction => linkedRecurrenceIds.has(transaction.recurrenceGroupId ?? '') && !transaction.pending && transaction.date > entered.date)
			.map(transaction => ({ date: transaction.date, amount: Math.abs(transaction.amount) }));
		const estimate = rate === null ? null : this.estimator.estimate({ owed: entered.owed, rate, balanceDate: entered.date, payments: paymentsSince.map(payment => payment.amount) });
		return { status: 'ready', entered, paymentsSince, estimate, hasLinkedPayment: linkedRecurrenceIds.size > 0 };
	}

	/** Loads the balance as last entered again, after it failed to load. */
	public retry(accountId: string): void {
		this.queryClient.removeQueries({ queryKey: [ENTERED_BALANCE_QUERY, accountId] });
		void this.loadEnteredBalance(accountId);
	}

	/** Starts at the estimate, or the balance as entered when the loan has no rate to estimate with. */
	public openUpdateDialog(accountId: string, accountName: string, estimate: number): void {
		this.dialogLayer?.close();
		this.dialogLayer = new Layer(this.window.document, close => (
			<UpdateBalanceDialog accountName={accountName} estimate={estimate} formatter={this.formatter} onSave={owed => this.saveBalance(accountId, owed)} onClose={close} />
		));
	}

	public [Symbol.dispose](): void {
		this.dialogLayer?.close();
	}

	private linkedRecurrenceIdsFor(loanAccountId: string): Set<string> {
		return new Set(Object.entries(this.loanAccountIdByRecurrenceId.peek()).flatMap(([recurrenceId, linkedLoanId]) => (linkedLoanId === loanAccountId ? [recurrenceId] : [])));
	}

	private async loadEnteredBalance(accountId: string): Promise<void> {
		this.setEnteredBalance(accountId, { status: 'loading' });
		try {
			const entered = await this.queryClient.query({ queryKey: [ENTERED_BALANCE_QUERY, accountId], queryFn: () => this.loansClient.tryGetEnteredBalance(accountId) });
			this.setEnteredBalance(accountId, { status: 'ready', entered });
		} catch (error) {
			logError(error);
			this.setEnteredBalance(accountId, { status: 'failed' });
		}
	}

	private setEnteredBalance(accountId: string, state: EnteredBalanceState): void {
		this.enteredBalances.value = new Map([...this.enteredBalances.peek(), [accountId, state]]);
	}

	/** Monarch's page keeps showing the old balance until it reloads, so it's reloaded once saved. */
	private async saveBalance(accountId: string, owed: number): Promise<void> {
		await this.loansClient.updateBalance(accountId, owed);
		this.window.location.reload();
	}
}
