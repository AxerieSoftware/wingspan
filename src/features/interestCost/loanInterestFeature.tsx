import { effect, signal, untracked } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import { logError } from '../../common/log';
import type { MonarchDataService, MonarchSnapshot } from '../../data/services/monarchDataService';
import type { Account } from '../../monarch/api/models/account';
import type { EnteredBalance } from '../../monarch/api/models/loanBalances';
import { MonarchAccountType } from '../../monarch/api/models/monarchValues';
import type { MonarchLoansClient } from '../../monarch/api/monarchLoansClient';
import type { AccountDetailsPage } from '../../monarch/pages/accounts/accountDetailsPage';
import { Island } from '../../monarch/ui/components/island';
import { Layer } from '../../monarch/ui/components/layer';
import type { Formatter } from '../../monarch/ui/formatter';
import type { Recurring } from '../recurring/createRecurring';
import type { WingspanFeature } from '../wingspanFeature';
import { LoanInterestCard } from './components/loanInterestCard';
import { UpdateBalanceDialog } from './components/updateBalanceDialog';
import type { LoanInterestView, ManualLoanView } from './models/loanInterestView';
import type { LoanBalanceEstimator } from './services/loanBalanceEstimator';

const CARD = 'loanInterest';
const ENTERED_BALANCE_QUERY = 'monarchEnteredBalance';

/** A loan's balance as last entered: loading, loaded (null when Monarch has none), or failed. */
type EnteredBalanceState = { status: 'loading' } | { status: 'ready'; entered: EnteredBalance | null } | { status: 'failed' };

/** On a loan's page: what its interest costs, and for a manual loan, an estimated balance to enter after a payment. */
export class LoanInterestFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly enteredBalances = signal<ReadonlyMap<string, EnteredBalanceState>>(new Map());
	private cardIsland: Island | null = null;
	private dialogLayer: Layer | null = null;

	public constructor(
		private readonly window: Window,
		private readonly page: AccountDetailsPage,
		private readonly monarchData: MonarchDataService,
		private readonly recurring: Pick<Recurring, 'itemRepository' | 'payments' | 'loanPayments'>,
		private readonly loansClient: MonarchLoansClient,
		private readonly queryClient: QueryClient,
		private readonly estimator: LoanBalanceEstimator,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.monarchData.snapshot.value, this.recurring.itemRepository.data.value, this.enteredBalances.value];
				untracked(() => this.sync());
			})
		);
	}

	public sync(): void {
		const accountId = this.page.accountId;
		if (!accountId) {
			this.page.removeCard(CARD);
			return;
		}

		void this.monarchData.load();
		const snapshot = this.monarchData.snapshot.peek();
		const account = snapshot?.accounts.find(candidate => candidate.id === accountId);
		if (!snapshot || account?.type.name !== MonarchAccountType.loan) {
			this.page.removeCard(CARD);
			return;
		}

		if (account.isManual && !this.enteredBalances.peek().has(accountId)) void this.loadEnteredBalance(accountId);
		this.page.showCard(CARD, { render: cardElement => this.mountCard(cardElement) });
		this.renderCard(accountId, this.viewOf(account, snapshot));
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.dialogLayer?.close();
		this.page.removeCard(CARD);
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

	private viewOf(account: Account, snapshot: MonarchSnapshot): LoanInterestView {
		const rate = account.interestRate && account.interestRate > 0 ? account.interestRate : null;
		return {
			accountName: account.displayName,
			owed: snapshot.owedByAccountId[account.id] ?? 0,
			rate,
			manual: account.isManual ? this.manualViewOf(account.id, rate, snapshot) : null
		};
	}

	private manualViewOf(accountId: string, rate: number | null, snapshot: MonarchSnapshot): ManualLoanView {
		const state = this.enteredBalances.peek().get(accountId);
		if (!state || state.status === 'loading') return { status: 'loading' };
		if (state.status === 'failed') return { status: 'failed' };
		if (!state.entered) return { status: 'none' };

		const { entered } = state;
		const loanPayments = this.recurring.itemRepository.data.peek().recurringItems.filter(item => this.recurring.loanPayments.owns(item) && item.loanAccountId === accountId);
		// Two Loan payment items on one loan can match the same payment, which is only paid once.
		const matchedTransactions = new Map(loanPayments.flatMap(item => this.recurring.payments.matchingTransactions(item, snapshot.transactions)).map(transaction => [transaction.id, transaction]));
		const paymentsSince = [...matchedTransactions.values()]
			.filter(transaction => !transaction.pending && transaction.date > entered.date)
			.map(transaction => ({ date: transaction.date, amount: Math.abs(transaction.amount) }));
		const hasLoanPayment = loanPayments.length > 0;
		const estimate = rate === null ? null : this.estimator.estimate({ owed: entered.owed, rate, balanceDate: entered.date, payments: paymentsSince.map(payment => payment.amount) });
		return { status: 'ready', entered, paymentsSince, estimate, hasLoanPayment };
	}

	private mountCard(cardElement: HTMLElement): () => void {
		this.cardIsland = new Island(cardElement);
		return () => {
			this.cardIsland?.unmount();
			this.cardIsland = null;
		};
	}

	private renderCard(accountId: string, view: LoanInterestView): void {
		const manual = view.manual;
		const onUpdateBalance = manual?.status === 'ready' ? () => this.openUpdateDialog(accountId, view.accountName, manual.estimate ?? manual.entered.owed) : null;
		this.cardIsland?.render(
			<LoanInterestCard
				view={view}
				formatter={this.formatter}
				onUpdateBalance={onUpdateBalance}
				onRetry={() => {
					this.queryClient.removeQueries({ queryKey: [ENTERED_BALANCE_QUERY, accountId] });
					void this.loadEnteredBalance(accountId);
				}}
			/>
		);
	}

	/** Starts at the estimate, or the balance as entered when the loan has no rate to estimate with. */
	private openUpdateDialog(accountId: string, accountName: string, estimate: number): void {
		this.dialogLayer?.close();
		this.dialogLayer = new Layer(this.window.document, close => (
			<UpdateBalanceDialog accountName={accountName} estimate={estimate} formatter={this.formatter} onSave={owed => this.saveBalance(accountId, owed)} onClose={close} />
		));
	}

	/** Monarch's page keeps showing the old balance until it reloads, so it's reloaded once saved. */
	private async saveBalance(accountId: string, owed: number): Promise<void> {
		await this.loansClient.updateBalance(accountId, owed);
		this.window.location.reload();
	}
}
