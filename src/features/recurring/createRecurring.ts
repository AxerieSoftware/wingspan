import type { WingspanBuilder } from '../../wingspanBuilder';
import { ManualBillKind } from './manualBills/manualBillKind';
import { RecurringItemInferrer } from './manualBills/services/recurringItemInferrer';
import { RecurringItemKindRegistry } from './recurringItems/kinds/recurringItemKindRegistry';
import { RecurrenceCalculator } from './recurringItems/services/recurrenceCalculator';
import { RecurringItemFactory } from './recurringItems/services/recurringItemFactory';
import { RecurringItemRepository } from './recurringItems/services/recurringItemRepository';
import type { RecurringItemServices } from './recurringItems/services/recurringItemServices';
import { RecurringItemValidator } from './recurringItems/services/recurringItemValidator';
import { RecurringPaymentCalculator } from './recurringItems/services/recurringPaymentCalculator';
import { RecurringPaymentLedgerService } from './recurringItems/services/recurringPaymentLedgerService';
import { TransactionMatcher } from './recurringItems/services/transactionMatcher';
import { DueLabelFormatter } from './shared/dueLabelFormatter';
import { CardPaymentKind } from './statements/cardPaymentKind';
import { StatementsTotals } from './statements/services/statementsTotals';
/** Wingspan's recurring items. Cash Flow and the business filter also use them. */
export interface Recurring {
	kinds: RecurringItemKindRegistry;
	manualBills: ManualBillKind;
	cardPayments: CardPaymentKind;
	recurrence: RecurrenceCalculator;
	payments: RecurringPaymentCalculator;
	itemRepository: RecurringItemRepository;
	ledgerService: RecurringPaymentLedgerService;
	statementsTotals: StatementsTotals;
	itemServices: RecurringItemServices;
}

/** Services for recurring items. The Recurring page features are added later by `addRecurringPages`. */
export function createRecurring(app: WingspanBuilder): Recurring {
	const { calendar, formatter, dataService, monarchData } = app;
	const recurrence = new RecurrenceCalculator(calendar);
	const matcher = new TransactionMatcher();
	const manualBills = new ManualBillKind(matcher, new RecurringItemInferrer(recurrence), formatter);
	const cardPayments = new CardPaymentKind(matcher);
	const kinds = new RecurringItemKindRegistry([manualBills, cardPayments]);
	const payments = new RecurringPaymentCalculator(calendar, recurrence, kinds);
	const itemRepository = new RecurringItemRepository(dataService, calendar, kinds);
	return {
		kinds,
		manualBills,
		cardPayments,
		recurrence,
		payments,
		itemRepository,
		ledgerService: new RecurringPaymentLedgerService(itemRepository, monarchData, payments),
		statementsTotals: new StatementsTotals(),
		itemServices: {
			calendar,
			formatter,
			dueLabels: new DueLabelFormatter(formatter),
			recurrence,
			payments,
			matcher,
			factory: new RecurringItemFactory(calendar, recurrence, kinds),
			validator: new RecurringItemValidator(kinds),
			kinds
		}
	};
}
