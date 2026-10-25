import { effect, untracked } from '@preact/signals-core';
import type { Calendar } from '../../../common/calendar';
import { CENT_TOLERANCE } from '../../../common/money';
import type { SyncedQueries } from '../../../common/syncedQueries';
import type { MonarchDataService } from '../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { MonarchBudgetClient } from '../../../monarch/api/monarchBudgetClient';
import type { MonarchTransactionsClient } from '../../../monarch/api/monarchTransactionsClient';
import type { BudgetPage } from '../../../monarch/pages/budget/budgetPage';
import type { SlotContent } from '../../../monarch/pages/mountedSlot';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import { isHsaAccount } from '../../accounts/hsaReimbursements/models/hsaAccount';
import { resolveHsaReimbursementTags, TRANSACTION_TAGS_QUERY } from '../../accounts/hsaReimbursements/models/hsaReimbursementTags';
import type { WingspanFeature } from '../../wingspanFeature';
import { HsaSpendingNote } from './components/hsaSpendingNote';
import { HsaSpending } from './models/hsaSpending';

const HSA_SPENDING_QUERY = 'monarchHsaSpending';

/**
 * Under each Budget row, how much of the month's spending was paid from an HSA: spending on the household's HSA
 * accounts, plus expenses tagged to be reimbursed from one. It counts toward Monarch's budget like any other spending.
 */
export class HsaSpendingFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	/** Each note's React root and the amount it shows, by its row's key. */
	private readonly notes = new Map<string, { island: Island; amount: number | null }>();

	public constructor(
		private readonly page: BudgetPage,
		private readonly monarchData: MonarchDataService,
		private readonly dataService: WingspanDataService,
		private readonly transactionsClient: MonarchTransactionsClient,
		private readonly budgetClient: MonarchBudgetClient,
		private readonly syncedQueries: SyncedQueries,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				// The HSA accounts come with Monarch's snapshot, and the chosen tags with Wingspan's data.
				void [this.monarchData.snapshot.value, this.dataService.data.value];
				untracked(() => this.sync());
			})
		);
	}

	public sync(): void {
		const month = this.page.isActive ? this.page.month : null;
		const spending = month ? this.readSpending(month) : null;
		if (!spending) {
			this.page.removeRowNotes();
			return;
		}

		const notedRows = this.page.rows.flatMap(row => {
			const amount = spending.amountFor(row.categoryIds);
			return amount > CENT_TOLERANCE ? [{ row, amount, content: this.noteContent(row.key) }] : [];
		});
		this.page.showRowNotes(notedRows);
		for (const { row, amount } of notedRows) {
			const note = this.notes.get(row.key);
			if (!note || note.amount === amount) continue;
			note.amount = amount;
			note.island.render(<HsaSpendingNote amount={amount} formatter={this.formatter} />);
		}
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeRowNotes();
	}

	/** Null while loading, when loading failed, or when the household has no HSA account or tags to go by. */
	private readSpending(month: string): HsaSpending | null {
		void this.monarchData.load();
		const accounts = this.monarchData.snapshot.peek()?.accounts;
		const tagsResult = this.syncedQueries.read([TRANSACTION_TAGS_QUERY], () => this.transactionsClient.getTransactionTags());
		if (!accounts || tagsResult.status !== 'ready') return null;

		const hsaAccountIds = accounts.filter(isHsaAccount).map(account => account.id);
		const tags = resolveHsaReimbursementTags(this.dataService.data.peek().hsaReimbursementTags, tagsResult.data);
		const tagIds = [tags.toReimburseTagId, tags.reimbursedTagId].filter(tagId => tagId !== '');
		if (!hsaAccountIds.length && !tagIds.length) return null;

		const dates = { startDate: `${month}-01`, endDate: this.calendar.lastOfMonth(month) };
		const result = this.syncedQueries.read([HSA_SPENDING_QUERY, month, hsaAccountIds, tagIds], async () => {
			// Expenses tagged for reimbursement were paid some other way, so leaving out the HSA accounts keeps any one from counting twice.
			const [onAccounts, tagged] = await Promise.all([
				hsaAccountIds.length ? this.budgetClient.getCategorySpending({ ...dates, accountIds: hsaAccountIds }) : new Map<string, number>(),
				tagIds.length ? this.budgetClient.getCategorySpending({ ...dates, tagIds, excludeAccountIds: hsaAccountIds }) : new Map<string, number>()
			]);
			return new HsaSpending(onAccounts, tagged);
		});
		return result.status === 'ready' ? result.data : null;
	}

	private noteContent(key: string): SlotContent {
		return {
			render: hostElement => {
				this.notes.set(key, { island: new Island(hostElement), amount: null });
				return () => {
					this.notes.get(key)?.island.unmount();
					this.notes.delete(key);
				};
			}
		};
	}
}
