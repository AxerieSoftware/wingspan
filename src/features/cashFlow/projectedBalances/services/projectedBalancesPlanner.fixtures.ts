import { Calendar } from '../../../../common/calendar';
import type { Account } from '../../../../monarch/api/models/account';
import type { RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import { Formatter } from '../../../../monarch/ui/formatter';
import { ManualBillKind } from '../../../recurring/manualBills/manualBillKind';
import { RecurringItemInferrer } from '../../../recurring/manualBills/services/recurringItemInferrer';
import { RecurringItemKindRegistry } from '../../../recurring/recurringItems/kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import { RecurrenceCalculator } from '../../../recurring/recurringItems/services/recurrenceCalculator';
import { RecurringPaymentCalculator } from '../../../recurring/recurringItems/services/recurringPaymentCalculator';
import { TransactionMatcher } from '../../../recurring/recurringItems/services/transactionMatcher';
import { CardPaymentKind } from '../../../recurring/statements/cardPaymentKind';
import type { ProjectionInput } from '../models/projection';
import { BalanceProjector } from './balanceProjector';
import { CardForecaster } from './cardForecaster';
import { CardPaymentPlanner } from './cardPaymentPlanner';
import { MinimumPaymentEstimator } from './minimumPaymentEstimator';
import { ProjectedBalancesPlanner } from './projectedBalancesPlanner';
import { ScheduledFlowBuilder } from './scheduledFlowBuilder';
import { SpendingPaceCalculator } from './spendingPaceCalculator';

export const TODAY = '2026-10-02';
export const CHECKING = 'checking';
export const CARD = 'card';

export function plannerFor(today = TODAY) {
	const calendar = new Calendar(() => Temporal.PlainDate.from(today));
	const recurrence = new RecurrenceCalculator(calendar);
	const matcher = new TransactionMatcher();
	const manualBills = new ManualBillKind(matcher, new RecurringItemInferrer(recurrence), new Formatter(calendar));
	const cardPayments = new CardPaymentKind(matcher);
	const payments = new RecurringPaymentCalculator(calendar, recurrence, new RecurringItemKindRegistry([manualBills, cardPayments]));
	const balanceProjector = new BalanceProjector(calendar, new MinimumPaymentEstimator());
	return new ProjectedBalancesPlanner(
		calendar,
		new SpendingPaceCalculator(calendar),
		new ScheduledFlowBuilder(calendar, recurrence, payments, manualBills),
		new CardForecaster(calendar, recurrence, cardPayments),
		new CardPaymentPlanner(balanceProjector),
		balanceProjector
	);
}

export const account = (id: string, typeName: string, currentBalance: number, extra: Partial<Account> = {}): Account => ({
	id,
	displayName: id,
	currentBalance,
	isAsset: typeName !== 'credit',
	isHidden: false,
	type: { name: typeName, display: typeName },
	...extra
});

export const monthly = (day: number) => `DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`;

export const cardItem = (dueDay: number, accountId = CARD): RecurringItem & { accountId: string } => ({
	id: `card-${accountId}`,
	kind: 'card',
	name: `Card ${accountId}`,
	recurrence: monthly(dueDay),
	amount: 0,
	active: true,
	since: '2026-01',
	accountId
});

export const recurringFlow = (name: string, recurringType: string, date: string, amount: number, accountId = CHECKING, merchantId: string | null = null, status = 'upcoming'): RecurringFlow => ({
	recurrenceGroup: { id: name, name, recurringType, amount, account: { id: accountId }, merchant: merchantId ? { id: merchantId } : null },
	occurrences: [{ date, status, amount, account: { id: accountId } }]
});

let transactionCount = 0;
export const spent = (date: string, amount: number, accountId = CHECKING, extra: Partial<Transaction> = {}): Transaction => ({
	id: `t${++transactionCount}`,
	date,
	amount: -amount,
	description: '',
	accountId,
	category: { id: 'groceries', name: 'Groceries', icon: null, groupType: 'expense' },
	...extra
});

export const monthlyPaychecks = (amount: number, first = '2026-10-25') =>
	Array.from({ length: 12 }, (_, months) => recurringFlow('Paycheck', 'income', Temporal.PlainDate.from(first).add({ months }).toString(), amount));

export function input(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
	const accounts = overrides.accounts ?? [account(CHECKING, 'depository', 5000)];
	return {
		accounts,
		checkingAccountIds: [CHECKING],
		transactions: [],
		recurringFlows: [],
		recurringItems: [],
		outstandingOccurrences: [],
		itemTransactionIds: new Set(),
		owedByAccountId: Object.fromEntries(accounts.filter(each => !each.isAsset).map(each => [each.id, -(each.currentBalance ?? 0)])),
		unassignedAccountIds: new Set(accounts.map(each => each.id)),
		cushion: 0,
		safetyDays: 30,
		cardAccountIds: accounts.filter(each => each.type.name === 'credit').map(each => each.id),
		reserveAccountIds: [],
		dueDayByRecurrenceId: {},
		...overrides
	};
}

export const SIX_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
