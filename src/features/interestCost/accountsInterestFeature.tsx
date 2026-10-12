import { effect, untracked } from '@preact/signals-core';
import type { MonarchDataService } from '../../data/services/monarchDataService';
import type { AccountsPage } from '../../monarch/pages/accounts/accountsPage';
import type { SlotContent } from '../../monarch/pages/mountedSlot';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { BusinessEntityView } from '../businessEntities/services/businessEntityView';
import type { WingspanFeature } from '../wingspanFeature';
import { GroupInterestNote } from './components/groupInterestNote';
import type { InterestCost } from './models/interestCost';
import type { InterestCostCalculator } from './services/interestCostCalculator';

/** What each group of debts on Accounts, like Loans, costs in interest, in the group's header. */
export class AccountsInterestFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly islandsByGroupName = new Map<string, Island>();

	public constructor(
		private readonly page: AccountsPage,
		private readonly monarchData: MonarchDataService,
		private readonly businessView: BusinessEntityView,
		private readonly calculator: InterestCostCalculator,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.monarchData.snapshot.value, this.businessView.scope.value];
				untracked(() => this.sync());
			})
		);
	}

	public sync(): void {
		if (!this.page.isActive) {
			this.page.removeGroupNotes();
			return;
		}

		void this.monarchData.load();
		const snapshot = this.monarchData.snapshot.peek();
		if (!snapshot) {
			this.page.removeGroupNotes();
			return;
		}

		const cost = this.calculator.calculate(snapshot, this.businessView.scope.peek());
		const contentByGroupName = new Map<string, SlotContent>();
		for (const debt of cost.debts) contentByGroupName.set(debt.groupName, { render: hostElement => this.mountNote(debt.groupName, hostElement) });
		this.page.showGroupNotes(contentByGroupName);
		for (const groupName of contentByGroupName.keys()) this.renderNote(groupName, cost.inGroup(groupName));
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeGroupNotes();
	}

	private mountNote(groupName: string, hostElement: HTMLElement): () => void {
		this.islandsByGroupName.set(groupName, new Island(hostElement));
		return () => {
			this.islandsByGroupName.get(groupName)?.unmount();
			this.islandsByGroupName.delete(groupName);
		};
	}

	private renderNote(groupName: string, cost: InterestCost): void {
		this.islandsByGroupName.get(groupName)?.render(<GroupInterestNote cost={cost} formatter={this.formatter} />);
	}
}
