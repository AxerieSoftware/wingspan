import type { StatementLinesReconciler } from '../../statements/services/statementLinesReconciler';
import type { StatementsTotals } from '../../statements/services/statementsTotals';
import type { RecurringItemRepository } from '../services/recurringItemRepository';
import type { RecurringLineBuilder } from '../services/recurringLineBuilder';
import type { RecurringPaymentLedgerService } from '../services/recurringPaymentLedgerService';

/** What Recurring's rows are built from: Wingspan's items, the payments matched to them, and the Statements card's lines and totals. */
export interface RecurringRowsData {
	readonly itemRepository: RecurringItemRepository;
	readonly ledgerService: RecurringPaymentLedgerService;
	readonly lineBuilder: RecurringLineBuilder;
	readonly statementLines: StatementLinesReconciler;
	readonly statementsTotals: StatementsTotals;
}
