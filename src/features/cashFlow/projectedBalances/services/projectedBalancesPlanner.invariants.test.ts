import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import { RecurrenceCalculator } from '../../../recurring/recurringItems/services/recurrenceCalculator';
import type { ProjectionInput, ScheduledFlow } from '../models/projection';
import { account, CARD, CHECKING, cardItem, input, monthly, monthlyPaychecks, plannerFor, recurringFlow, spent, TODAY } from './projectedBalancesPlanner.fixtures';

describe('invariants over generated households', { timeout: 60_000 }, () => {
	/** Mulberry32, so a failing household can be reproduced from its seed. */
	const randomFrom = (seed: number) => {
		let state = seed;
		return () => {
			state = (state + 0x6d2b79f5) | 0;
			let t = Math.imul(state ^ (state >>> 15), 1 | state);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	};
	const SEEDS = Array.from({ length: 150 }, (_, index) => index + 1);
	/** The dates used as today: early in a month, the last day of a month, a leap day, and the end of a year. */
	const TODAYS = ['2026-10-02', '2026-10-31', '2028-02-29', '2026-12-31'];
	const calendarOn = (today: string) => new Calendar(() => Temporal.PlainDate.from(today));

	function household(seed: number) {
		const random = randomFrom(seed);
		const between = (low: number, high: number) => Math.round(low + random() * (high - low));
		const cents = (low: number, high: number) => Math.round((low + random() * (high - low)) * 100) / 100;
		const today = TODAYS[seed % TODAYS.length] as string;
		const calendar = calendarOn(today);
		const recurrence = new RecurrenceCalculator(calendar);
		const month = calendar.currentMonth();
		const pastMonths = Array.from({ length: 6 }, (_, index) => calendar.addMonths(month, index - 6));
		const cardIds = Array.from({ length: between(1, 4) }, (_, index) => `card${index}`);
		const accounts = [
			account(CHECKING, 'depository', cents(0, 6000)),
			...cardIds.map(cardId =>
				// Now and then a card carries a credit balance, owing nothing.
				account(cardId, 'credit', random() < 0.15 ? cents(1, 300) : -cents(0, 9000), {
					limit: random() < 0.7 ? between(2000, 15000) : null,
					apr: random() < 0.7 ? between(15, 30) : null,
					minimumPayment: random() < 0.3 ? cents(25, 200) : null
				})
			)
		];
		const payday = between(1, 28);
		const recurringFlows = [
			...monthlyPaychecks(cents(1500, 6000), calendar.dayInMonth(payday < calendar.dayOf(today) ? calendar.addMonths(month, 1) : month, payday)),
			...Array.from({ length: between(0, 4) }, (_, index) => recurringFlow(`Bill ${index}`, 'expense', calendar.dayInMonth(month, between(1, 31)), -cents(50, 1500)))
		];
		const transactions = [
			...pastMonths.map(pastMonth => spent(calendar.dayInMonth(pastMonth, 12), cents(0, 2000))),
			...cardIds.flatMap(cardId => pastMonths.map(pastMonth => spent(calendar.dayInMonth(pastMonth, 8), cents(0, 1500), cardId))),
			// About half the cards charged interest last month, so they carry a balance and paying them early saves some.
			...cardIds
				.filter(() => random() < 0.5)
				.map(cardId =>
					spent(calendar.dayInMonth(calendar.addMonths(month, -1), 20), cents(5, 120), cardId, {
						description: 'INTEREST CHARGE ON PURCHASES',
						category: { id: 'interest', name: 'Interest Charges', icon: null, groupType: 'expense' }
					})
				),
			// The last few days' purchases and a deposit, which the pending invariant takes as not yet posted.
			// Derived from the seed instead of the random draws, so the rest of the household stays the same.
			...[CHECKING, ...cardIds].map((accountId, index) => spent(calendar.addDays(today, -((seed + index) % 5)), ((seed * 37 + index * 11) % 400) + 1, accountId)),
			spent(calendar.addDays(today, -(seed % 5)), -(((seed * 53) % 2000) + 1))
		];
		const dueDateIn = (item: RecurringItem, inMonth: string) => recurrence.dueDates(item.recurrence, `${inMonth}-01`, calendar.lastOfMonth(inMonth))[0];
		// Due on any day, including the 29th to 31st, which a shorter month clamps to its last day.
		const linkedItems = cardIds.map(cardId => ({ ...cardItem(1, cardId), recurrence: recurrence.toRecurrence(recurrence.monthly(between(1, 31))) }));
		// Cards outside Monarch, due monthly or twice a month, owing a fixed amount.
		const outsideItems = Array.from({ length: between(0, 2) }, (_, index): RecurringItem => {
			const firstDay = between(1, 14);
			const itemRecurrence = random() < 0.5 ? monthly(firstDay) : `DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=${firstDay},${firstDay + 14}`;
			return { id: `outside${index}`, kind: 'card', name: `Outside ${index}`, recurrence: itemRecurrence, amount: cents(25, 400), active: true, since: '2026-01' };
		});
		const recurringItems = [...linkedItems, ...outsideItems];
		// Last month's statement is sometimes still unpaid, and this month's is unpaid or paid, as the ledger would track them.
		const outstandingOccurrences = recurringItems.flatMap(item => {
			const occurrenceOn = (dueDate: string, paid: boolean, carried: boolean) => ({
				item,
				dueDate,
				key: `${item.id}@${dueDate}`,
				amount: item.amount,
				paid,
				matchedTransaction: null,
				carried,
				overdue: !paid && dueDate < today
			});
			const [lastMonthDue, thisMonthDue] = [dueDateIn(item, calendar.addMonths(month, -1)), dueDateIn(item, month)];
			const lastMonth = lastMonthDue && random() < 0.3 ? [occurrenceOn(lastMonthDue, false, true)] : [];
			return [...lastMonth, ...(thisMonthDue ? [occurrenceOn(thisMonthDue, random() < 0.4, false)] : [])];
		});
		return {
			today,
			scenario: input({ accounts, recurringFlows, transactions, recurringItems, outstandingOccurrences, cardAccountIds: cardIds, cushion: cents(0, 1500), safetyDays: [30, 60, 90][between(0, 2)] })
		};
	}

	it('reaches the risky cases: paying cards early, credit balances, month-end due days and a leap day', () => {
		const households = SEEDS.map(seed => household(seed));
		const projections = households.map(({ today, scenario }) => plannerFor(today).plan(scenario));
		expect(projections.filter(projection => projection.cards.some(card => card.chargesInterest && card.owedToday > 0)).length).toBeGreaterThan(5);
		expect(households.filter(({ scenario }) => scenario.accounts.some(each => each.type.name === 'credit' && (each.currentBalance ?? 0) > 0)).length).toBeGreaterThan(5);
		expect(households.filter(({ scenario }) => scenario.outstandingOccurrences.some(occurrence => Number(occurrence.dueDate.slice(8)) >= 29)).length).toBeGreaterThan(5);
		// A due day of the 29th to 31st that falls on the leap day itself.
		expect(households.filter(({ scenario }) => scenario.outstandingOccurrences.some(occurrence => occurrence.dueDate === '2028-02-29')).length).toBeGreaterThan(5);
	});

	it("asks a Monarch card's closed statement for what was on it, whatever's been charged since", () => {
		for (const seed of SEEDS) {
			const random = randomFrom(seed);
			const between = (low: number, high: number) => Math.round(low + random() * (high - low));
			// A statement closed 25 days before its due date, between now and three weeks out, with charges posted since.
			const dueDay = between(3, 23);
			const dueDate = `2026-10-${String(dueDay).padStart(2, '0')}`;
			const closeDate = Temporal.PlainDate.from(dueDate).subtract({ days: 25 }).toString();
			const statement = between(0, 4000);
			const chargesSinceClose = Array.from({ length: between(0, 6) }, () =>
				spent(
					Temporal.PlainDate.from(closeDate)
						.add({ days: between(1, Temporal.PlainDate.from(TODAY).since(closeDate).days) })
						.toString(),
					between(5, 900),
					CARD
				)
			);
			const owedToday = statement + chargesSinceClose.reduce((total, transaction) => total - transaction.amount, 0);
			const item = cardItem(dueDay);
			const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -owedToday)];

			const projection = plannerFor().plan(input({ accounts, transactions: chargesSinceClose, recurringItems: [item] }));
			const first = projection.cards[0]?.payments[0];

			if (statement === 0) expect(first?.date === dueDate ? first.owed : 0, `seed ${seed}`).toBeCloseTo(0, 2);
			else expect(first, `seed ${seed}`).toMatchObject({ date: dueDate, owed: statement });
		}
	});

	/** Spends `amount` from checking today in `scenario`, and checks that the cushion, every minimum and every statement planned in full still hold. */
	function expectSafeToSpend(today: string, scenario: ProjectionInput, amount: number, label: string) {
		const planned = plannerFor(today).plan(scenario);
		const [spentFrom] = scenario.checkingAccountIds;
		const accounts = scenario.accounts.map(each => (each.id === spentFrom ? { ...each, currentBalance: (each.currentBalance ?? 0) - amount } : each));
		const afterSpending = plannerFor(today).plan({ ...scenario, accounts });

		expect(afterSpending.reversible.firstShortDate, label).toBeNull();
		planned.cards.forEach((card, index) => {
			for (const payment of card.payments.filter(each => each.date <= planned.reversible.endDate)) {
				const after = afterSpending.cards[index]?.payments.find(each => each.date === payment.date);
				const paymentLabel = `${label} ${card.name} ${payment.date}`;
				expect(after?.amount ?? 0, paymentLabel).toBeGreaterThanOrEqual(Math.min(payment.amount, payment.minimum ?? 0) - 0.01);
				// Short of in full by no more than the interest the amount spent adds, should an earlier partial payment shrink by it.
				const interestOnSpent = ((amount * (card.apr ?? 36)) / 100 / 12) * 3;
				if (payment.amount >= payment.owed - 0.01) expect(after?.amount ?? 0, paymentLabel).toBeGreaterThanOrEqual((after?.owed ?? 0) - 0.01 - interestOnSpent);
			}
		});
	}

	it('spending free cash today still leaves the cushion, every minimum, and every statement planned in full covered through the window', () => {
		for (const seed of SEEDS) {
			const { today, scenario } = household(seed);
			const { freeCash } = plannerFor(today).plan(scenario);
			if (freeCash > 0) expectSafeToSpend(today, scenario, freeCash, `seed ${seed}`);
		}
	});

	it("offers free cash that's safe to spend whether or not the bank's balances count what's still pending", () => {
		let reached = 0;
		for (const seed of SEEDS) {
			const { today, scenario } = household(seed);
			const recent = calendarOn(today).addDays(today, -5);
			const transactions = scenario.transactions.map(each => (each.date >= recent ? { ...each, pending: true } : each));
			if (!transactions.some(each => each.pending)) continue;
			reached++;
			const withPending = { ...scenario, transactions };
			const { freeCash } = plannerFor(today).plan(withPending);
			if (freeCash <= 0) continue;
			// A bank whose balances exclude pending transactions: the household as Wingspan sees it.
			expectSafeToSpend(today, withPending, freeCash, `seed ${seed}, balances without pending`);
			// A bank whose balances already include them: the same household with every transaction counted as posted.
			expectSafeToSpend(today, scenario, freeCash, `seed ${seed}, balances with pending`);
		}
		expect(reached).toBeGreaterThan(20);
	});

	it("checking's balance moves by exactly the day's flows", () => {
		for (const seed of SEEDS) {
			const { today, scenario } = household(seed);
			const projection = plannerFor(today).plan(scenario);
			let checking = projection.checkingBalance;
			for (const day of projection.days) {
				const sumOf = (keep: (flow: ScheduledFlow) => boolean) => day.flows.filter(flow => flow.accountId === undefined && keep(flow)).reduce((total, flow) => total + flow.amount, 0);
				const beforeDeposits = checking + sumOf(flow => flow.amount < 0 && flow.kind !== 'cardPayment');
				const closing = beforeDeposits + sumOf(flow => flow.amount > 0) + sumOf(flow => flow.kind === 'cardPayment');
				expect(day.checking, `seed ${seed} ${day.date}`).toBeCloseTo(closing, 6);
				expect(day.lowestChecking, `seed ${seed} ${day.date}`).toBeCloseTo(Math.min(beforeDeposits, closing), 6);
				checking = day.checking;
			}
		}
	});

	it("no card payment takes checking below the cushion during its cycle, and none is more than what's owed", () => {
		for (const seed of SEEDS) {
			const { today, scenario } = household(seed);
			const projection = plannerFor(today).plan(scenario);
			const incomeDates = projection.days.filter(day => day.flows.some(flow => flow.kind === 'income' && flow.accountId === undefined)).map(day => day.date);
			const lastDate = projection.days.at(-1)?.date ?? '';

			for (const card of projection.cards) {
				for (const [index, payment] of card.payments.entries()) {
					expect(payment.amount, `seed ${seed}`).toBeGreaterThanOrEqual(0);
					expect(payment.amount, `seed ${seed}`).toBeLessThanOrEqual(payment.owed + 0.005);
					if (payment.amount <= 0) continue;

					const nextDueDate = card.payments[index + 1]?.date;
					const cycleEnd = nextDueDate ? (incomeDates.find(date => date >= nextDueDate) ?? lastDate) : lastDate;
					// The payment goes out at the end of its due date, so it's bound by that day's close and every later day's low.
					for (const day of projection.days.filter(each => each.date >= payment.date && each.date <= cycleEnd)) {
						const low = day.date === payment.date ? day.checking : day.lowestChecking;
						expect(low, `seed ${seed}: ${card.name} paid ${payment.amount} on ${payment.date}, ${day.date}`).toBeGreaterThanOrEqual(scenario.cushion - 0.01);
					}
				}
			}
		}
	});

	it('a card is paid at least its minimum unless checking is already at the cushion somewhere in the cycles still running', () => {
		for (const seed of SEEDS) {
			const { today, scenario } = household(seed);
			const projection = plannerFor(today).plan(scenario);
			const incomeDates = projection.days.filter(day => day.flows.some(flow => flow.kind === 'income' && flow.accountId === undefined)).map(day => day.date);
			const lastDate = projection.days.at(-1)?.date ?? '';
			const cycles = projection.cards.flatMap(card =>
				card.payments.map((payment, index) => {
					const nextDueDate = card.payments[index + 1]?.date;
					return { start: payment.date, end: nextDueDate ? (incomeDates.find(date => date >= nextDueDate) ?? lastDate) : lastDate };
				})
			);

			for (const card of projection.cards) {
				for (const payment of card.payments) {
					if (payment.minimum === null || payment.amount >= payment.minimum - 0.005) continue;
					const end = cycles.filter(cycle => cycle.start <= payment.date).reduce((latest, cycle) => (cycle.end > latest ? cycle.end : latest), payment.date);
					const lowest = Math.min(...projection.days.filter(day => day.date >= payment.date && day.date <= end).map(day => day.lowestChecking));
					expect(lowest, `seed ${seed}: ${card.name} paid ${payment.amount} of ${payment.minimum} on ${payment.date}`).toBeLessThan(scenario.cushion + 0.01);
				}
			}
		}
	});
});
