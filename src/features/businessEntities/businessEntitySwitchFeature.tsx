import { effect } from '@preact/signals-core';
import type { Calendar } from '../../common/calendar';
import type { QueryResult, SyncedQueries } from '../../common/syncedQueries';
import type { SyncScheduler } from '../../common/syncScheduler';
import type { MonarchDataService } from '../../data/services/monarchDataService';
import type { Account } from '../../monarch/api/models/account';
import type { RecurrenceGroupAccount } from '../../monarch/api/models/recurrenceGroupAccount';
import { EMPTY_SUMMARY, type RecurringSummary, type RecurringSummaryLine, subtractSummary } from '../../monarch/api/models/recurringSummary';
import type { MonarchRecurringClient } from '../../monarch/api/monarchRecurringClient';
import type { CashFlowPage } from '../../monarch/pages/cashFlow/cashFlowPage';
import type { RecurringView } from '../../monarch/pages/recurringV2/models/recurringView';
import type { RecurringV2Summary, RecurringV2SummaryLine } from '../../monarch/pages/recurringV2/recurringV2EntityFilter';
import type { RecurringV2Page } from '../../monarch/pages/recurringV2/recurringV2Page';
import { WingspanAttribute } from '../../monarch/pages/wingspanAttributes';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { WingspanFeature } from '../wingspanFeature';
import { BusinessEntitySwitch } from './components/businessEntitySwitch';
import type { BusinessFilter } from './models/businessFilter';
import { type EntityScope, HOUSEHOLD_ENTITY_ID } from './models/entityScope';
import type { ScopedMembership } from './services/entityMembership';
import { MonarchRowScope } from './services/monarchRowScope';

const GROUP_ACCOUNTS_QUERY = 'recurrenceGroupAccounts';
const SUMMARY_QUERY = 'recurringSummary';
/** The All view lists every item, including yearly ones, so rows are matched against a full year of occurrences. */
const ALL_VIEW_MONTHS = 12;
const LOADING_LINE: RecurringV2SummaryLine = { texts: ['', '', ''], completed: 0, total: 0, completedText: '' };
const FAILED_LINE: RecurringV2SummaryLine = { ...LOADING_LINE, texts: ["Couldn't load; reload to try again", '', ''] };

/**
 * Applies the business filter to what Wingspan shows. Cash Flow uses Monarch's own filter. Recurring has none, so
 * Wingspan adds a matching switch that also hides Monarch's rows for unselected entities and replaces the month
 * summary totals with totals for the selected ones.
 */
export class BusinessEntitySwitchFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();

	public constructor(
		private readonly recurringPage: RecurringV2Page,
		private readonly cashFlowPage: CashFlowPage,
		private readonly filter: BusinessFilter,
		private readonly monarchData: MonarchDataService,
		private readonly recurringClient: MonarchRecurringClient,
		private readonly queries: SyncedQueries,
		private readonly syncScheduler: SyncScheduler,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.filter.view.scope.value, this.filter.view.businesses.value, this.monarchData.state.value];
				this.syncScheduler.request();
			})
		);
	}

	/** Follows Monarch's filter on Cash Flow. On Recurring, shows the switch and filters Monarch's rows and summary to the scope. */
	public sync(): void {
		this.filter.view.follow(this.cashFlowPage.businessEntityFilter, this.cashFlowPage.isActive);
		const recurringView = this.recurringPage.view;
		if (recurringView || this.cashFlowPage.isActive) this.filter.view.load();
		if (!recurringView) {
			this.clear();
			return;
		}

		// The switch needs the business names. Until they load, a previously saved choice still filters rows, same as for Wingspan's rows.
		if (this.filter.view.businesses.value?.length) this.recurringPage.showControl({ render: hostEl => this.renderSwitch(hostEl) }, WingspanAttribute.entitySwitch);
		else this.recurringPage.removeControl();
		const scope = this.filter.view.scope.value;
		void this.monarchData.load();
		const accounts = this.monarchData.snapshot.value?.accounts;
		const month = this.recurringPage.monthInView(this.calendar.currentMonth());
		// Do nothing until the page shows which month it's on, e.g. while Monarch re-renders it.
		if (!month) return;
		// Monarch's accounts failed to load, so rows can't be matched to an entity. Show them all.
		if (scope.isEverything || this.monarchData.state.value.status === 'failed') {
			this.recurringPage.removeEntityFilter();
			return;
		}

		// While Monarch's accounts load, hold off on rows and totals too, since they could belong to any entity.
		const within = this.filter.membership.within(scope, accounts ?? []);
		const rowScope = new MonarchRowScope(accounts ? this.groupAccounts(recurringView, month) : null, within);
		this.recurringPage.filterMonarchItems(
			item => rowScope.isShown(item),
			kind => rowScope.hiddenInactiveCount(kind)
		);

		// Monarch only shows the month summary in the month view. Its totals stay hidden until ours load, since they'd include other entities.
		if (recurringView === 'all') {
			this.recurringPage.removeOwnSummary();
			return;
		}
		const summary: QueryResult<RecurringSummary> = accounts ? this.summary(month, scope, accounts, within) : { status: 'loading' };
		this.recurringPage.showOwnSummary(
			summary.status === 'ready' ? this.summaryText(summary.data) : summary.status === 'failed' ? { expense: FAILED_LINE, income: FAILED_LINE } : { expense: LOADING_LINE, income: LOADING_LINE }
		);
	}

	/** Restores Monarch's rows, counts and month summary, and removes the switch since it can't work now. */
	public suspend(): void {
		this.clear();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.clear();
	}

	private clear(): void {
		this.recurringPage.removeEntityFilter();
		this.recurringPage.removeControl();
	}

	private renderSwitch(hostEl: HTMLElement): () => void {
		const island = new Island(hostEl);
		island.render(
			<BusinessEntitySwitch
				businesses={this.filter.view.businesses}
				filter={this.filter.view.filter}
				buttonClassName={this.recurringPage.filtersButtonClassName}
				onChange={filter => this.filter.view.choose(filter)}
			/>
		);
		return () => island.unmount();
	}

	private summaryText(summary: RecurringSummary): RecurringV2Summary {
		const amount = (value: number) => this.formatter.wholeMoney(Math.abs(value));
		const line = (summaryLine: RecurringSummaryLine, texts: string[]): RecurringV2SummaryLine => ({
			texts,
			completed: summaryLine.completed,
			total: summaryLine.total,
			completedText: this.formatter.percent(summaryLine.total ? Math.abs(summaryLine.completed / summaryLine.total) : 0)
		});
		const { expense, income } = summary;
		return {
			expense: line(expense, [`${amount(expense.total)} due`, `${amount(expense.completed)} paid`, `${amount(expense.remaining)} left`]),
			income: line(income, [`${income.total > 0 ? '+' : ''}${amount(income.total)} expected`, `${amount(income.completed)} received`, `${amount(income.remaining)} left`])
		};
	}

	/** Null while loading. Empty when they failed to load, so every row shows instead of none. */
	private groupAccounts(view: RecurringView, month: string): RecurrenceGroupAccount[] | null {
		const lastMonth = view === 'all' ? this.calendar.addMonths(month, ALL_VIEW_MONTHS - 1) : month;
		const groups = this.queries.read([GROUP_ACCOUNTS_QUERY, month, lastMonth], () => this.recurringClient.getRecurrenceGroupAccounts(`${month}-01`, this.calendar.lastOfMonth(lastMonth)));
		return groups.status === 'ready' ? groups.data : groups.status === 'failed' ? [] : null;
	}

	/**
	 * Monarch's summary filters only by account, and items with no account belong to the household. So when Household is
	 * selected, it's the full total minus the unselected entities' accounts. Otherwise it's just the selected accounts.
	 */
	private summary(month: string, scope: EntityScope, accounts: Account[], within: ScopedMembership): QueryResult<RecurringSummary> {
		const idsWhere = (isShown: boolean) => accounts.filter(account => within.includesAccount(account.id) === isShown).map(account => account.id);
		if (!scope.includes(HOUSEHOLD_ENTITY_ID)) return this.accountsSummary(month, idsWhere(true));
		const everything = this.accountsSummary(month, null);
		const others = this.accountsSummary(month, idsWhere(false));
		if (everything.status === 'failed' || others.status === 'failed') return { status: 'failed' };
		if (everything.status === 'loading' || others.status === 'loading') return { status: 'loading' };
		return { status: 'ready', data: subtractSummary(everything.data, others.data) };
	}

	/** Null means all accounts. An empty list returns an empty summary without a request, since Monarch treats an empty filter as no filter. */
	private accountsSummary(month: string, accountIds: string[] | null): QueryResult<RecurringSummary> {
		if (accountIds?.length === 0) return { status: 'ready', data: EMPTY_SUMMARY };
		const sortedIds = accountIds?.toSorted();
		return this.queries.read([SUMMARY_QUERY, month, sortedIds?.join(',') ?? 'all'], () => this.recurringClient.getRecurringSummary(`${month}-01`, this.calendar.lastOfMonth(month), sortedIds));
	}
}
