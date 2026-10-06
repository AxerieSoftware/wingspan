import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import type { RecurringView } from '../../../../monarch/pages/recurringV2/models/recurringView';
import { RecurringV2Page } from '../../../../monarch/pages/recurringV2/recurringV2Page';
import type { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { Occurrence } from '../models/occurrence';
import type { PaymentLedger } from '../models/paymentLedger';
import type { RecurringData } from '../models/recurringData';
import type { RecurringItem } from '../models/recurringItem';
import type { RecurringLine } from '../models/recurringLine';
import type { RecurrenceCalculator } from './recurrenceCalculator';
import type { RecurringPaymentCalculator } from './recurringPaymentCalculator';

/** Turns the ledger's due dates into Wingspan's rows on Recurring, for a month or All. */
export class RecurringLineBuilder {
	public constructor(
		private readonly recurrence: RecurrenceCalculator,
		private readonly payments: RecurringPaymentCalculator,
		private readonly kinds: RecurringItemKindRegistry
	) {}

	/** `includesCarried`: whether to show debts carried over from earlier months, which needs Monarch's transactions to confirm they're still owed. */
	public linesFor(view: RecurringView, month: string, recurringData: RecurringData, ledger: PaymentLedger, owedByAccountId: BalancesByAccountId, includesCarried: boolean): RecurringLine[] {
		return view === 'all' ? this.allViewLines(recurringData, ledger, owedByAccountId) : this.monthLines(month, recurringData, ledger, owedByAccountId, includesCarried);
	}

	/**
	 * An item's occurrences share one row, including carried-over debts. Each card statement gets its own row, since each
	 * has a different amount and is paid separately.
	 */
	private monthLines(month: string, recurringData: RecurringData, ledger: PaymentLedger, owedByAccountId: BalancesByAccountId, includesCarried: boolean): RecurringLine[] {
		const lines: RecurringLine[] = [];
		const lineByItemId = new Map<string, RecurringLine>();

		for (const occurrence of this.payments.occurrencesFor(recurringData, month, ledger, owedByAccountId)) {
			if (occurrence.carried && !includesCarried) continue;
			const hasOwnRow = occurrence.carried && this.kinds.of(occurrence.item).showsInStatements;
			const itemLine = hasOwnRow ? undefined : lineByItemId.get(occurrence.item.id);
			if (itemLine) {
				Object.assign(itemLine, this.lineOf(occurrence.item, [...itemLine.occurrences, occurrence]));
				continue;
			}

			const line = this.lineOf(occurrence.item, [occurrence]);
			lines.push(line);
			if (!hasOwnRow) lineByItemId.set(occurrence.item.id, line);
		}

		return lines;
	}

	private allViewLines(recurringData: RecurringData, ledger: PaymentLedger, owedByAccountId: BalancesByAccountId): RecurringLine[] {
		const unpaidByItemId = new Map<string, Occurrence>();
		for (const occurrence of ledger.outstandingOccurrences) if (!occurrence.paid && !unpaidByItemId.has(occurrence.item.id)) unpaidByItemId.set(occurrence.item.id, occurrence);

		const occurrencesByMonth = new Map<string, Occurrence[]>();
		// The first due date ahead not already paid early.
		const upcomingDueDate = (item: RecurringItem): string | null => {
			let dueDate = this.recurrence.nextDueAfterToday(item.recurrence);
			while (dueDate && ledger.settledByKey.get(this.payments.occurrenceKey(item.id, dueDate))?.paid) dueDate = this.recurrence.nextDue(item.recurrence, dueDate);
			return dueDate;
		};
		const upcomingOccurrence = (item: RecurringItem): Occurrence | undefined => {
			const upcomingDate = upcomingDueDate(item);
			const upcomingMonth = upcomingDate?.slice(0, 7);
			if (!upcomingMonth) return undefined;
			let monthOccurrences = occurrencesByMonth.get(upcomingMonth);
			if (!monthOccurrences) {
				monthOccurrences = this.payments.occurrencesFor(recurringData, upcomingMonth, ledger, owedByAccountId);
				occurrencesByMonth.set(upcomingMonth, monthOccurrences);
			}
			return monthOccurrences.find(occurrence => occurrence.item.id === item.id && occurrence.dueDate === upcomingDate);
		};

		return recurringData.recurringItems
			.filter(item => item.active)
			.map(item => {
				const nextOccurrence = unpaidByItemId.get(item.id) ?? upcomingOccurrence(item);
				// The latest payment made, whichever due date it settled: one paid late can come after one paid early.
				const lastPaidDate = (ledger.historiesByItemId.get(item.id) ?? []).reduce<string | null>(
					(latest, point) => (point.paidDate && (!latest || point.paidDate > latest) ? point.paidDate : latest),
					null
				);
				const occurrences = nextOccurrence ? [nextOccurrence] : ledger.settledOccurrences.filter(occurrence => occurrence.item.id === item.id).slice(-1);
				const line = this.lineOf(item, occurrences, { lastPaidDate, nextDueDate: nextOccurrence?.dueDate ?? null });
				const dayOfMonth = Number((nextOccurrence?.dueDate ?? line.dueDate).slice(8, 10)) || 1;
				return { ...line, dueDate: RecurringV2Page.allViewSortDate(dayOfMonth) };
			});
	}

	private lineOf(item: RecurringItem, occurrences: Occurrence[], overrides: Partial<RecurringLine> = {}): RecurringLine {
		const unpaidOccurrences = occurrences.filter(occurrence => !occurrence.paid);
		return {
			item,
			key: occurrences[0]?.key ?? item.id,
			occurrences,
			dueDate: (unpaidOccurrences[0] ?? occurrences.at(-1))?.dueDate ?? '',
			paid: unpaidOccurrences.length === 0,
			overdue: unpaidOccurrences.some(occurrence => occurrence.overdue),
			carried: occurrences.every(occurrence => occurrence.carried),
			amount: occurrences.reduce((total, occurrence) => total + occurrence.amount, 0),
			lastPaidDate: null,
			nextDueDate: null,
			...overrides
		};
	}
}
