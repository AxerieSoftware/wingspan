import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { emptyWingspanData } from '../../../../data/models/wingspanData';
import type { RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import { Formatter } from '../../../../monarch/ui/formatter';
import { EntityScope, HOUSEHOLD_ENTITY_ID } from '../../../businessEntities/models/entityScope';
import { EntityMembership } from '../../../businessEntities/services/entityMembership';
import { ManualBillKind } from '../../../recurring/manualBills/manualBillKind';
import { RecurringItemInferrer } from '../../../recurring/manualBills/services/recurringItemInferrer';
import { RecurringItemKindRegistry } from '../../../recurring/recurringItems/kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import { RecurrenceCalculator } from '../../../recurring/recurringItems/services/recurrenceCalculator';
import { TransactionMatcher } from '../../../recurring/recurringItems/services/transactionMatcher';
import { CardPaymentKind } from '../../../recurring/statements/cardPaymentKind';
import { CashSettingsResolver } from '../../cashSettings/services/cashSettingsResolver';
import { EntityCashSettings } from '../../cashSettings/services/entityCashSettings';
import type { ProjectionInput } from '../models/projection';
import { account, input, monthly, plannerFor, recurringFlow, SIX_MONTHS, spent, TODAY } from './projectedBalancesPlanner.fixtures';

describe('a household with a business', () => {
	const BUSINESS = 'studio';
	const business = { businessEntity: { id: BUSINESS } };
	const calendar = new Calendar(() => Temporal.PlainDate.from(TODAY));
	const recurrence = new RecurrenceCalculator(calendar);
	const matcher = new TransactionMatcher();
	const kinds = new RecurringItemKindRegistry([new ManualBillKind(matcher, new RecurringItemInferrer(recurrence), new Formatter(calendar)), new CardPaymentKind(matcher)]);
	const membership = new EntityMembership(kinds);
	const cashSettings = new EntityCashSettings(new CashSettingsResolver());
	const businesses = [{ id: BUSINESS, name: 'Studio' }];
	const accounts = [
		account('Joint Checking', 'depository', 3000),
		account('Studio Checking', 'depository', 8000, business),
		account('Visa', 'credit', -400),
		account('Studio Card', 'credit', -900, business)
	];
	const unaccounted: RecurringFlow = {
		recurrenceGroup: { id: 'Gym', name: 'Gym', recurringType: 'expense', amount: -40, account: null, merchant: null },
		occurrences: [{ date: '2026-10-20', status: 'upcoming', amount: -40, account: null }]
	};
	const flows = [
		recurringFlow('Paycheck', 'income', '2026-10-25', 4000, 'Joint Checking'),
		recurringFlow('Rent', 'expense', '2026-10-15', -1500, 'Joint Checking'),
		recurringFlow('Client', 'income', '2026-10-18', 6000, 'Studio Checking'),
		recurringFlow('Software', 'expense', '2026-10-12', -200, 'Studio Card'),
		unaccounted
	];
	const bill = (name: string, accountId?: string): RecurringItem => ({
		id: name,
		kind: 'bill',
		name,
		recurrence: monthly(28),
		amount: 100,
		active: true,
		since: '2026-01',
		...(accountId ? { matchRule: { matchText: name, accountId } } : {})
	});
	const items = [bill('Water'), bill('Studio rent', 'Studio Checking')];
	const data = { ...emptyWingspanData(), cashSettings: { cushion: 500 }, businessCashSettings: { [BUSINESS]: { cushion: 2000 } } };

	const plan = (filter: string[], extra: Partial<ProjectionInput> = {}) => {
		const scope = EntityScope.fromFilter(filter, businesses);
		const within = membership.within(scope, accounts);
		const settings = cashSettings.forScope(accounts, data, scope);
		return plannerFor().plan(
			input({
				accounts,
				checkingAccountIds: settings.checkingAccountIds,
				cardAccountIds: settings.cardAccountIds,
				reserveAccountIds: settings.reserveAccountIds,
				cushion: settings.cushion,
				recurringFlows: within.recurringFlows(flows),
				unassignedAccountIds: new Set(accounts.filter(each => !each.businessEntity).map(each => each.id)),
				recurringItems: items.filter(within.includesItem),
				...extra
			})
		);
	};
	const labels = (projection: ReturnType<typeof plan>) => projection.days.flatMap(day => day.flows.map(flow => `${day.date} ${flow.label} ${flow.amount}`)).sort();
	const names = (projection: ReturnType<typeof plan>) => new Set(projection.days.flatMap(day => day.flows.map(flow => flow.label)));

	it('projects the household from its own checking and cards, plus items with no account', () => {
		const household = plan([HOUSEHOLD_ENTITY_ID]);

		expect(household.checkingBalance).toBe(3000);
		expect(household.cushion).toBe(500);
		expect(household.cards.map(card => card.name)).toEqual(['Visa']);
		expect(names(household)).toEqual(new Set(['Paycheck', 'Rent', 'Gym', 'Water', 'Visa']));
	});

	it('projects a business from its own checking and cards only', () => {
		const studio = plan([BUSINESS]);

		expect(studio.checkingBalance).toBe(8000);
		expect(studio.cushion).toBe(2000);
		expect(studio.cards.map(card => card.name)).toEqual(['Studio Card']);
		expect(names(studio)).toEqual(new Set(['Client', 'Software', 'Studio rent', 'Studio Card']));
	});

	it("counts a business card's purchases at a merchant with a household recurring item that has no account, shown alone or with everything", () => {
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 11, 'Studio Card', { merchantId: 'music' }));
		const music: RecurringFlow = { recurrenceGroup: { id: 'Music', name: 'Music', recurringType: 'expense', amount: -11, account: null, merchant: { id: 'music' } }, occurrences: [] };
		const paceOf = (filter: string[]) => plan(filter, { transactions, recurringFlows: membership.within(EntityScope.fromFilter(filter, businesses), accounts).recurringFlows([...flows, music]) }).pace;

		expect(paceOf([BUSINESS]).monthlyByAccountId.get('Studio Card')).toBe(11);
		expect(paceOf([]).monthlyByAccountId.get('Studio Card')).toBe(11);
	});

	it("counts the household's spending the same with a business shown or not, for a recurring item with no occurrences yet", () => {
		const transactions = SIX_MONTHS.map(month => spent(`${month}-12`, 120, 'Joint Checking', { merchantId: 'gym' }));
		const gym: RecurringFlow = {
			recurrenceGroup: { id: 'Gym yearly', name: 'Gym yearly', recurringType: 'expense', amount: -120, account: { id: 'Joint Checking' }, merchant: { id: 'gym' } },
			occurrences: []
		};
		const paceOf = (filter: string[]) => plan(filter, { transactions, recurringFlows: membership.within(EntityScope.fromFilter(filter, businesses), accounts).recurringFlows([gym]) }).pace;

		expect(paceOf([HOUSEHOLD_ENTITY_ID]).monthlyByAccountId.get('Joint Checking')).toBe(paceOf([]).monthlyByAccountId.get('Joint Checking'));
	});

	it("moves an item to its due day the same way in every part, when its month's payments come from two parts", () => {
		const split: RecurringFlow = {
			recurrenceGroup: { id: 'Split', name: 'Split', recurringType: 'expense', amount: -100, account: null, merchant: null },
			occurrences: [
				{ date: '2026-10-03', status: 'upcoming', amount: -100, account: { id: 'Visa' } },
				{ date: '2026-10-20', status: 'upcoming', amount: -100, account: { id: 'Studio Card' } }
			]
		};
		const dates = (filter: string[]) =>
			plan(filter, { recurringFlows: membership.within(EntityScope.fromFilter(filter, businesses), accounts).recurringFlows([split]), dueDayByRecurrenceId: { Split: 5 } }).days.flatMap(day =>
				day.flows.filter(flow => flow.label === 'Split').map(() => day.date)
			);

		expect([...dates([HOUSEHOLD_ENTITY_ID]), ...dates([BUSINESS])].sort()).toEqual(dates([]).sort());
	});

	it('projects everything as both parts combined, with every flow in exactly one part', () => {
		const [household, studio, everything] = [plan([HOUSEHOLD_ENTITY_ID]), plan([BUSINESS]), plan([])];

		expect(everything.checkingBalance).toBe(household.checkingBalance + studio.checkingBalance);
		expect(everything.cushion).toBe(household.cushion + studio.cushion);
		expect(labels(everything)).toEqual([...labels(household), ...labels(studio)].sort());
		expect(plan([HOUSEHOLD_ENTITY_ID, BUSINESS]).checkingBalance).toBe(everything.checkingBalance);
	});
});
