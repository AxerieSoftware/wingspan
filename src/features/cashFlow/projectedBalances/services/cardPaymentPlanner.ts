import { floorToCents } from '../../../../common/money';
import type { PlannedCardPayment } from '../../../recurring/statements/models/cardPaymentPlans';
import type { CardForecast, ProjectedDay } from '../models/projection';
import type { BalanceProjector, ProjectorInput } from './balanceProjector';
import { cardPaymentKey } from './balanceProjector';

const SETTLING_ATTEMPTS = 4;
const CENT = 0.01;

type PlanningInput = Omit<ProjectorInput, 'paymentPlan' | 'burndown'>;

/** The payments planned on every due date, and how much room the ones due by `protectedUntil` leave. */
export interface CardPaymentPlan {
	/** What checking pays each card on each due date, by cardPaymentKey. */
	payments: Map<string, number>;
	/**
	 * How much lower checking could start and still pay every card due by `protectedUntil` as planned: in full where
	 * planned in full, and at least the minimum otherwise. Infinity when nothing is due.
	 */
	spare: number;
}

interface PaymentChoice {
	payment: number;
	spare: number;
}

interface DueDate {
	cardIndex: number;
	date: string;
}

/**
 * Plans what checking can pay each card on each due date while staying at or above the cushion through the payment's
 * cycle: until the card is due again and the next income after that, and through any earlier planned cycle that's
 * still running. Minimums due within the cycle, including the card's next one, are set aside first, so paying extra on
 * an earlier card never costs another card its minimum. What's left goes to the cards in due date order, each up to
 * what it owes. Later due dates are planned from what's left, so a tight month further out lowers those payments, not
 * this one.
 */
export class CardPaymentPlanner {
	public constructor(private readonly projector: BalanceProjector) {}

	/** Every payment keeps checking at or above the cushion at least through `protectedUntil`, the free cash window. */
	public plan(input: PlanningInput, cushion: number, protectedUntil: string): CardPaymentPlan {
		const dueDates = input.cards.flatMap((card, cardIndex) => card.dueDates.map((date): DueDate => ({ cardIndex, date }))).sort((a, b) => a.date.localeCompare(b.date) || a.cardIndex - b.cardIndex);
		const incomeDates = [...new Set(input.flows.filter(flow => flow.accountId === undefined && flow.kind === 'income' && flow.amount > 0).map(flow => flow.date))].sort();
		const paymentPlan = new Map<string, number>();
		let plannedCycleEnd = protectedUntil;
		let spare = Number.POSITIVE_INFINITY;

		for (const [position, dueDate] of dueDates.entries()) {
			const cycleEnd = this.laterOf(this.cycleEnd(input, dueDate, incomeDates), plannedCycleEnd);
			const choice = this.affordablePayment(input, paymentPlan, dueDates, position, cycleEnd, cushion);
			paymentPlan.set(cardPaymentKey(dueDate.cardIndex, dueDate.date), choice.payment);
			plannedCycleEnd = cycleEnd;
			if (dueDate.date <= protectedUntil) spare = Math.min(spare, choice.spare);
		}
		return { payments: paymentPlan, spare };
	}

	/** Given the earlier planned payments, the largest this payment can be while its cycle still covers the cushion and the minimums due in it. */
	private affordablePayment(input: PlanningInput, paymentPlan: ReadonlyMap<string, number>, dueDates: DueDate[], position: number, cycleEnd: string, cushion: number): PaymentChoice {
		const dueDate = dueDates[position] as DueDate;
		const key = cardPaymentKey(dueDate.cardIndex, dueDate.date);
		// Nothing after the cycle is read, so the projection stops there.
		const projectWith = (payment: number) => this.projector.project({ ...input, endDate: cycleEnd, paymentPlan: new Map(paymentPlan).set(key, payment) });
		const withoutPayment = projectWith(0);
		const due = withoutPayment.cards[dueDate.cardIndex]?.payments.find(payment => payment.date === dueDate.date);
		if (!due) return { payment: 0, spare: Number.POSITIVE_INFINITY };

		// Later minimums shrink as this payment grows, so recalculate them until the payment converges.
		let choice = this.paymentWithin(withoutPayment.days, withoutPayment.cards, due, dueDates, position, cycleEnd, cushion);
		for (let attempt = 1; attempt < SETTLING_ATTEMPTS; attempt++) {
			const settled = this.paymentWithin(withoutPayment.days, projectWith(choice.payment).cards, due, dueDates, position, cycleEnd, cushion);
			if (Math.abs(settled.payment - choice.payment) < CENT) break;
			choice = settled;
		}
		return choice;
	}

	/** The most a payment can be, against checking without it, after the minimums due later in its cycle. */
	private paymentWithin(days: ProjectedDay[], cards: CardForecast[], due: PlannedCardPayment, dueDates: DueDate[], position: number, cycleEnd: string, cushion: number): PaymentChoice {
		const isInCycle = (date: string) => date >= due.date && date <= cycleEnd;
		const laterMinimums = dueDates
			.slice(position + 1)
			.filter(later => isInCycle(later.date))
			.map(later => ({ date: later.date, amount: cards[later.cardIndex]?.payments.find(payment => payment.date === later.date)?.minimum ?? 0 }));
		let room = Number.POSITIVE_INFINITY;
		let roomAfterMinimums = Number.POSITIVE_INFINITY;
		let setAside = 0;
		for (const day of days) {
			if (!isInCycle(day.date)) continue;
			setAside += laterMinimums.filter(later => later.date === day.date).reduce((total, later) => total + later.amount, 0);
			// On the due date the payment goes out after the day's deposits, so only the end-of-day balance limits it.
			const low = day.date === due.date ? day.checking : day.lowestChecking;
			room = Math.min(room, low - cushion);
			roomAfterMinimums = Math.min(roomAfterMinimums, low - cushion - setAside);
		}

		const affordable = Math.max(Math.min(due.minimum ?? 0, room), roomAfterMinimums);
		// Lower starting checking reduces the room dollar for dollar. A full payment stays full while the affordable amount
		// covers the balance, and any payment keeps its minimum while the room before later minimums covers it.
		const isInFull = affordable >= due.owed;
		const spare = isInFull ? affordable - due.owed : room - Math.min(due.minimum ?? 0, due.owed);
		// Paying the whole balance pays it exactly; anything less is floored to the cent so it never exceeds the room.
		return { payment: isInFull ? due.owed : floorToCents(Math.max(0, affordable)), spare: Math.max(0, spare) };
	}

	/** The last day a payment must keep the cushion covered: the first payday on or after the card's next due date. */
	private cycleEnd(input: PlanningInput, dueDate: DueDate, incomeDates: string[]): string {
		const nextDueDate = input.cards[dueDate.cardIndex]?.dueDates.find(date => date > dueDate.date);
		if (!nextDueDate) return input.endDate;
		return incomeDates.find(date => date >= nextDueDate) ?? input.endDate;
	}

	private laterOf(first: string, second: string): string {
		return first > second ? first : second;
	}
}
