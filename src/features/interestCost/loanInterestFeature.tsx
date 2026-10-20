import { effect, untracked } from '@preact/signals-core';
import type { MonarchDataService, MonarchSnapshot } from '../../data/services/monarchDataService';
import type { Account } from '../../monarch/api/models/account';
import { MonarchAccountType } from '../../monarch/api/models/monarchValues';
import type { AccountDetailsPage } from '../../monarch/pages/accounts/accountDetailsPage';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { WingspanFeature } from '../wingspanFeature';
import { LoanInterestCard } from './components/loanInterestCard';
import { loanRateOf } from './models/interestCost';
import type { LoanInterestView } from './models/loanInterestView';
import type { ManualLoanUpdates } from './services/manualLoanUpdates';

const CARD = 'loanInterest';

/** On a loan's page: what its interest costs, and for a manual loan, an estimated balance to enter after a payment. */
export class LoanInterestFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private cardIsland: Island | null = null;

	public constructor(
		private readonly page: AccountDetailsPage,
		private readonly monarchData: MonarchDataService,
		private readonly manualLoans: ManualLoanUpdates,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.monarchData.snapshot.value, this.manualLoans.changes.value];
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

		this.page.showCard(CARD, { render: cardElement => this.mountCard(cardElement) });
		this.renderCard(accountId, this.viewOf(account, snapshot));
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeCard(CARD);
	}

	private viewOf(account: Account, snapshot: MonarchSnapshot): LoanInterestView {
		return {
			accountName: account.displayName,
			owed: snapshot.owedByAccountId[account.id] ?? 0,
			rate: loanRateOf(account),
			manual: account.isManual ? this.manualLoans.view(account, snapshot) : null
		};
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
		const onUpdateBalance = manual?.status === 'ready' ? () => this.manualLoans.openUpdateDialog(accountId, view.accountName, manual.estimate) : null;
		this.cardIsland?.render(<LoanInterestCard view={view} formatter={this.formatter} onUpdateBalance={onUpdateBalance} onRetry={() => this.manualLoans.retry(accountId)} />);
	}
}
