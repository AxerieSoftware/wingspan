import { effect } from '@preact/signals-core';
import type { Calendar } from '../../common/calendar';
import type { QueryResult, SyncedQueries } from '../../common/syncedQueries';
import type { SyncScheduler } from '../../common/syncScheduler';
import type { MonarchDataService } from '../../data/services/monarchDataService';
import type { Account } from '../../monarch/api/models/account';
import type { RecurrenceGroupAccount } from '../../monarch/api/models/recurrenceGroupAccount';
import { EMPTY_SUMMARY, type RecurringSummary, type RecurringSummaryLine, subtractSummary } from '../../monarch/api/models/recurringSummary';
import type { MonarchRecurringClient } from '../../monarch/api/monarchRecurringClient';
import type { AccountsPage } from '../../monarch/pages/accounts/accountsPage';
import type { CashFlowPage } from '../../monarch/pages/cashFlow/cashFlowPage';
import type { PageHeader } from '../../monarch/pages/header/pageHeader';
import type { RecurringView } from '../../monarch/pages/recurringV2/models/recurringView';
import type { RecurringV2Summary, RecurringV2SummaryLine } from '../../monarch/pages/recurringV2/recurringV2EntityFilter';
import type { RecurringV2Page } from '../../monarch/pages/recurringV2/recurringV2Page';
import type { SettingsPage } from '../../monarch/pages/settings/settingsPage';
import type { SidebarPage, SidebarStyles } from '../../monarch/pages/sidebar/sidebarPage';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import type { WingspanFeature } from '../wingspanFeature';
import { UnfilteredPageNote } from './components/unfilteredPageNote';
import { WorkspaceSwitcher } from './components/workspaceSwitcher';
import type { BusinessFilter } from './models/businessFilter';
import { type EntityScope, HOUSEHOLD_ENTITY_ID } from './models/entityScope';
import { isUnfilteredPage } from './models/unfilteredPages';
import type { ScopedMembership } from './services/entityMembership';
import { MonarchRowScope } from './services/monarchRowScope';
import type { WorkspaceNavigation } from './services/workspaceNavigation';

const GROUP_ACCOUNTS_QUERY = 'recurrenceGroupAccounts';
const SUMMARY_QUERY = 'recurringSummary';
/** The All view lists every item, including yearly ones, so rows are matched against a full year of occurrences. */
const ALL_VIEW_MONTHS = 12;
const LOADING_LINE: RecurringV2SummaryLine = { texts: ['', '', ''], completed: 0, total: 0, completedText: '' };
const FAILED_LINE: RecurringV2SummaryLine = { ...LOADING_LINE, texts: ["Couldn't load; reload to try again", '', ''] };
const BUSINESSES_SETTINGS_SLUG = 'businesses';

/**
 * Keeps Monarch in one workspace, Household or a business, chosen from a switcher in Monarch's sidebar. Pages with
 * Monarch's own business filter open filtered to it. Recurring has none, so Wingspan hides Monarch's rows for other
 * entities and replaces the month summary totals with the workspace's.
 */
export class WorkspaceFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private switcherStyles: SidebarStyles | null = null;
	/** Household is picked once per visit to Accounts; after that, Monarch's filter there is the household's to change. */
	private hasPickedHousehold = false;

	public constructor(
		private readonly sidebar: SidebarPage,
		private readonly accountsPage: AccountsPage,
		private readonly pageHeader: PageHeader,
		private readonly settingsPage: SettingsPage,
		private readonly navigation: WorkspaceNavigation,
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
				void [this.filter.view.scope.value, this.filter.view.workspace.value, this.filter.view.businesses.value, this.monarchData.state.value];
				this.syncScheduler.request();
			})
		);
		this.subscriptions.use(this.navigation);
	}

	/** Shows the switcher and opens pages filtered to the workspace. On Recurring, filters Monarch's rows and summary to it. */
	public sync(): void {
		const view = this.filter.view;
		view.load();
		view.follow(this.cashFlowPage.isActive ? this.cashFlowPage.businessEntityFilter : null);
		const workspace = view.workspace.value;
		// Saved once businesses load, so the next page load is filtered before Monarch's app starts.
		if (workspace && view.businesses.value) view.choose(workspace);
		this.navigation.follow(workspace);
		this.pickHouseholdOnAccounts(workspace);
		const isSwitching = workspace !== null && !!view.businesses.value?.length;
		this.showSwitcher(isSwitching);
		this.showUnfilteredNote(isSwitching);

		const recurringView = this.recurringPage.view;
		if (!recurringView) {
			this.recurringPage.removeEntityFilter();
			return;
		}

		const scope = view.scope.value;
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

	/** Restores Monarch's rows, counts and month summary, and removes the switcher since it can't work now. */
	public suspend(): void {
		this.clear();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.clear();
	}

	private clear(): void {
		this.navigation.follow(null);
		this.accountsPage.cancel();
		this.recurringPage.removeEntityFilter();
		this.sidebar.removeRow();
		this.pageHeader.removeNote();
	}

	/** Accounts can't be opened on Household by a link, so Household is picked in Monarch's own filter as the page opens. */
	private pickHouseholdOnAccounts(workspace: string | null): void {
		if (!this.accountsPage.isActive) {
			this.hasPickedHousehold = false;
			this.accountsPage.cancel();
			return;
		}
		if (this.hasPickedHousehold || workspace !== HOUSEHOLD_ENTITY_ID || this.accountsPage.hasChosenBusinesses) return;
		this.hasPickedHousehold = this.accountsPage.pickHousehold() === 'done';
	}

	/** On pages Monarch can't filter by business, says so in the header. */
	private showUnfilteredNote(isSwitching: boolean): void {
		if (!isSwitching || !isUnfilteredPage(this.pageHeader.path)) {
			this.pageHeader.removeNote();
			return;
		}
		this.pageHeader.showNote({
			render: hostEl => {
				const island = new Island(hostEl);
				island.render(<UnfilteredPageNote />);
				return () => island.unmount();
			}
		});
	}

	private showSwitcher(isSwitching: boolean): void {
		const styles = isSwitching ? this.sidebar.styles : null;
		if (!styles) {
			this.sidebar.removeRow();
			return;
		}
		// Monarch's classes change with its theme, so the switcher is rendered again when they do.
		if (this.switcherStyles && !isSameStyles(this.switcherStyles, styles)) this.sidebar.removeRow();
		this.switcherStyles = styles;
		this.sidebar.showRow({ render: hostEl => this.renderSwitcher(hostEl, styles) });
	}

	private renderSwitcher(hostEl: HTMLElement, styles: SidebarStyles): () => void {
		const island = new Island(hostEl);
		island.render(
			<WorkspaceSwitcher
				businesses={this.filter.view.businesses}
				workspace={this.filter.view.workspace}
				styles={styles}
				menuContainer={this.sidebar.menuContainer ?? undefined}
				onChoose={entityId => {
					this.filter.view.choose(entityId);
					this.navigation.reloadInto();
				}}
				onManage={() => this.settingsPage.open(BUSINESSES_SETTINGS_SLUG)}
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

function isSameStyles(styles: SidebarStyles, other: SidebarStyles): boolean {
	return styles.linkClassName === other.linkClassName && styles.iconClassName === other.iconClassName;
}
