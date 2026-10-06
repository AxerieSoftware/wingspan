import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import type { Account } from '../../../../monarch/api/models/account';
import type { RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { Occurrence } from '../../../recurring/recurringItems/models/occurrence';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import type { PlannedCardPayment } from '../../../recurring/statements/models/cardPaymentPlans';

/** A draw is money moved into checking to cover a shortfall: borrowed on a card or taken from a reserve account. */
export type FlowKind = 'income' | 'bill' | 'cardPayment' | 'spending' | 'draw';

/** A negative amount is money out. No accountId means checking. */
export interface ScheduledFlow {
	date: string;
	amount: number;
	label: string;
	kind: FlowKind;
	accountId?: string;
}

/** Everyday spending per month, as a positive amount, by the account it's charged to. */
export interface SpendingPace {
	monthlyByAccountId: ReadonlyMap<string, number>;
}

/** A card in the projection: what it owes today and each payment planned on it. */
export interface CardForecast {
	/** The card payment item it comes from, if any. */
	itemId?: string;
	name: string;
	owedToday: number;
	payments: PlannedCardPayment[];
	/** False when the card's due day is unknown, so it's assumed due 30 days out. */
	hasDueDate: boolean;
	/** False when the card has no Monarch balance and no typical payment, so it's counted as $0. */
	hasAmount: boolean;
	chargesInterest: boolean;
	apr: number | null;
}

/** One day of the projection. Balances are at the day's end unless said otherwise. */
export interface ProjectedDay {
	date: string;
	/**
	 * The day's lowest balance: after bills and spending but before deposits, since an afternoon paycheck doesn't cover a
	 * morning bill. Or the end-of-day balance if that's lower, since card payments go out after deposits.
	 */
	lowestChecking: number;
	checking: number;
	cardsOwed: number;
	/** Total moved from reserve accounts into checking so far in the burndown. */
	reservesDrawn: number;
	/** The day's lowest value of checking minus what the cards owe at that moment, either before or after the day's card payments. */
	lowestAfterCards: number;
	/** Null when no card has a known limit. */
	creditLeft: number | null;
	/** Total owed on cards with a known limit, including any amount over the limit. */
	creditUsed: number;
	flows: ScheduledFlow[];
}

/** Checking's lowest point from today through endDate in the cash-only projection. */
export interface ProjectionWindow {
	endDate: string;
	lowestChecking: number;
	lowestDate: string;
	/** The first day checking falls below the cushion, if any. */
	firstShortDate: string | null;
}

/** End-of-day checking minus what the cards owe and anything drawn from reserves: what would be left if every card were paid off. */
export const afterCardsOf = (day: ProjectedDay): number => day.checking - day.cardsOwed - day.reservesDrawn;

/** A card hits its limit, checking drops below the cushion, or checking goes below $0. */
export type ProjectionEventKind = 'cardMaxedOut' | 'cushionUsed' | 'outOfCash';

/** A day marked in the burndown: each time a card maxes out, and the first time checking drops below the cushion or runs out. */
export interface ProjectionEvent {
	date: string;
	kind: ProjectionEventKind;
	label: string;
}

/** The same days, but with cards and reserves used to keep checking at the cushion, plus the events along the way. */
export interface Burndown {
	days: ProjectedDay[];
	events: ProjectionEvent[];
}

/** The inputs to a projection, for the part of the household being shown. */
export interface ProjectionInput {
	accounts: Account[];
	checkingAccountIds: string[];
	transactions: Transaction[];
	recurringFlows: RecurringFlow[];
	/** The household's own accounts. A Monarch recurring item with no account is assumed to be paid from one of these. */
	unassignedAccountIds: ReadonlySet<string>;
	recurringItems: RecurringItem[];
	outstandingOccurrences: Occurrence[];
	/** Every occurrence the ledger settled, including paid ones carried over from last month, since a Monarch card's statement may still have a balance. */
	settledOccurrences?: Occurrence[];
	/** Payments matched to Wingspan's items, kept out of everyday spending. */
	itemTransactionIds: ReadonlySet<string>;
	owedByAccountId: BalancesByAccountId;
	cushion: number;
	/** Free cash keeps the cushion covered for this many days, or until the next payday if that's later. */
	safetyDays: number;
	/** In the order they're borrowed on. Cards not listed are left out of the projection. */
	cardAccountIds: string[];
	/** In the order they're drawn on. */
	reserveAccountIds: string[];
	dueDayByRecurrenceId: Readonly<Record<string, number>>;
}

/** Checking and the counted cards day by day from today. checkingBalance is today's balance minus pending money out. */
export interface Projection {
	checkingBalance: number;
	cushion: number;
	pace: SpendingPace;
	cards: CardForecast[];
	/** Cash only: nothing borrowed, no reserves used, and each card paid what checking can afford on its due date. Free cash is calculated from these. */
	days: ProjectedDay[];
	/** Runs through the household's safety days or the next payday, whichever is later. */
	reversible: ProjectionWindow;
	freeCash: number;
	/** Income less bills and everyday spending in an average month of the year ahead; below $0, money runs short over time. */
	monthlySurplus: number;
	shortfall: number;
	/** Total credit limit of the counted Monarch cards. Null when none has a known limit. */
	creditLimit: number | null;
	/** The same days, but once checking runs low it's covered from cards, reserves and then the cushion, in the household's order. */
	burndown: Burndown;
}
