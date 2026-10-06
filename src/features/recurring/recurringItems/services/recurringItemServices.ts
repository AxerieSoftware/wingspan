import type { Calendar } from '../../../../common/calendar';
import type { Formatter } from '../../../../monarch/ui/formatter';
import type { DueLabelFormatter } from '../../shared/dueLabelFormatter';
import type { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { RecurrenceCalculator } from './recurrenceCalculator';
import type { RecurringItemFactory } from './recurringItemFactory';
import type { RecurringItemValidator } from './recurringItemValidator';
import type { RecurringPaymentCalculator } from './recurringPaymentCalculator';
import type { TransactionMatcher } from './transactionMatcher';

/** Services shared by an item's rows, details panel and editor. */
export interface RecurringItemServices {
	calendar: Calendar;
	formatter: Formatter;
	dueLabels: DueLabelFormatter;
	recurrence: RecurrenceCalculator;
	payments: RecurringPaymentCalculator;
	matcher: TransactionMatcher;
	factory: RecurringItemFactory;
	validator: RecurringItemValidator;
	kinds: RecurringItemKindRegistry;
}
