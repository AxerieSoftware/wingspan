import { computed, effect, type ReadonlySignal } from '@preact/signals-core';
import type { Calendar } from '../../../common/calendar';
import type { SyncedQueries } from '../../../common/syncedQueries';
import type { SyncScheduler } from '../../../common/syncScheduler';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { RecurrenceGroupPeriod } from '../../../monarch/api/models/recurrenceGroupPeriod';
import type { MonarchRecurringClient } from '../../../monarch/api/monarchRecurringClient';
import type { RecurringV2DueDate, RecurringV2Item } from '../../../monarch/pages/recurringV2/models/recurringV2Item';
import type { RecurringView } from '../../../monarch/pages/recurringV2/models/recurringView';
import { RecurringV2Page } from '../../../monarch/pages/recurringV2/recurringV2Page';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import type { DueLabelFormatter } from '../shared/dueLabelFormatter';
import { DueDayPanelRow } from './components/dueDayPanelRow';
import type { MonarchItemMonth } from './models/monarchItemMonth';
import type { DueDateCalculator } from './services/dueDateCalculator';

const RECURRENCE_GROUPS_QUERY = 'recurrenceGroups';

/** Shows due dates on Monarch's recurring rows, and adds a Due day row to an item's panel for setting a custom due day. */
export class DueDatesFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly panelRow: DueDayPanelRow;
	private readonly customDueDays: ReadonlySignal<Record<string, number>>;

	public constructor(
		private readonly page: RecurringV2Page,
		private readonly recurringClient: MonarchRecurringClient,
		private readonly queries: SyncedQueries,
		private readonly dataService: WingspanDataService,
		private readonly calculator: DueDateCalculator,
		private readonly dueLabels: DueLabelFormatter,
		private readonly syncScheduler: SyncScheduler,
		private readonly calendar: Calendar,
		formatter: Formatter
	) {
		this.panelRow = new DueDayPanelRow(formatter, (itemId, customDueDay) => void this.setCustomDueDay(itemId, customDueDay));
		this.customDueDays = computed(() => this.dataService.data.value.recurringDueDates.dueDatesByRecurrenceId);
	}

	/** Syncs again whenever a custom due day changes. */
	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void this.customDueDays.value;
				this.syncScheduler.request();
			})
		);
	}

	/** Labels each row with its due date in the month in view, and shows the Due day row for the open item. */
	public sync(): void {
		const view = this.page.view;
		if (!view) {
			this.clear();
			return;
		}

		const month = this.page.monthInView(this.calendar.currentMonth());
		// Do nothing until the page shows which month it's on, e.g. while Monarch is re-rendering.
		if (!month) return;
		const itemMonths = this.recurrenceGroups(month).map(group => this.calculator.itemMonth(group, month));
		const itemMonthsByItem = this.calculator.pair(this.page.monarchItems, itemMonths);
		this.page.showDueDates(monarchItem => this.dueDateFor(monarchItem, itemMonthsByItem.get(monarchItem), view, month));
		this.showPanelRow(month, itemMonths);
	}

	/** Restores Monarch's row order and removes the due labels, since nothing would keep them updated while suspended. */
	public suspend(): void {
		this.page.removeDueDates();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.clear();
	}

	private clear(): void {
		this.page.removeDueDates();
		this.page.removeDetailRow();
	}

	private dueDateFor(monarchItem: RecurringV2Item, itemMonth: MonarchItemMonth | undefined, view: RecurringView, month: string): RecurringV2DueDate | null {
		if (!itemMonth) {
			// Until Monarch's items load, sort by the day shown in the row's status.
			const statusDay = monarchItem.statusDay;
			if (!statusDay) return null;
			return { label: '', date: view === 'all' ? RecurringV2Page.allViewSortDate(statusDay) : this.calendar.dayInMonth(month, statusDay) };
		}

		const customDueDay = this.customDueDays.value[itemMonth.group.recurrenceGroup.id];
		const dueDate = this.calculator.dueDate(itemMonth, month, customDueDay);

		if (view === 'all') {
			const dueDay = customDueDay ?? (dueDate ? this.calendar.dayOf(dueDate) : null);
			const label = !itemMonth.repeatsInMonth && dueDay ? ` · ${this.dueLabels.dueOnDay(dueDay)}` : '';
			return { label, date: dueDay ? RecurringV2Page.allViewSortDate(dueDay) : null };
		}

		if (!dueDate) return { label: '', date: null };
		if (!itemMonth.repeatsInMonth) return { label: ` · ${this.dueLabels.due(dueDate)}`, date: dueDate };
		return { label: ` · ${itemMonth.isAllPaid ? this.dueLabels.allPaid : this.dueLabels.next(dueDate)}`, date: dueDate };
	}

	private showPanelRow(month: string, itemMonths: MonarchItemMonth[]): void {
		const itemId = this.page.openItemId;
		if (!itemId) {
			this.page.removeDetailRow();
			return;
		}

		const itemMonth = itemMonths.find(candidate => candidate.group.recurrenceGroup.id === itemId);
		if (itemMonth?.repeatsInMonth) {
			this.page.removeDetailRow();
			return;
		}

		const expectedDueDate = itemMonth ? this.calculator.dueDate(itemMonth, month, undefined) : null;
		this.panelRow.update({ itemId, customDueDay: this.customDueDays.value[itemId], expectedDueDate });
		this.page.showDetailRow(this.panelRow);
	}

	private setCustomDueDay(itemId: string, customDueDay: number | undefined): Promise<void> {
		return this.dataService.update(data => {
			const dueDatesByRecurrenceId = { ...data.recurringDueDates.dueDatesByRecurrenceId };
			if (customDueDay === undefined) delete dueDatesByRecurrenceId[itemId];
			else dueDatesByRecurrenceId[itemId] = customDueDay;
			return { ...data, recurringDueDates: { ...data.recurringDueDates, dueDatesByRecurrenceId } };
		});
	}

	private recurrenceGroups(month: string): RecurrenceGroupPeriod[] {
		// Monarch's rows get no due dates until its groups load, or if they fail to load.
		const groups = this.queries.read([RECURRENCE_GROUPS_QUERY, month], () => this.recurringClient.getRecurrenceGroups(`${month}-01`, this.calendar.lastOfMonth(month)));
		return groups.status === 'ready' ? groups.data : [];
	}
}
