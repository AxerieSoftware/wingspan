import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { MonarchDataService } from '../../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../../data/services/wingspanDataService';
import type { Account } from '../../../../monarch/api/models/account';
import type { BusinessFilter } from '../../../businessEntities/models/businessFilter';
import { entityIdOf, HOUSEHOLD_ENTITY_ID } from '../../../businessEntities/models/entityScope';
import type { Occurrence } from '../../../recurring/recurringItems/models/occurrence';
import type { RecurringItemRepository } from '../../../recurring/recurringItems/services/recurringItemRepository';
import type { RecurringPaymentLedgerService } from '../../../recurring/recurringItems/services/recurringPaymentLedgerService';
import type { CardPaymentPlans, PlannedCardPayment } from '../../../recurring/statements/models/cardPaymentPlans';
import type { EntityCashSettings } from '../../cashSettings/services/entityCashSettings';
import type { Projection } from '../models/projection';
import type { ProjectedBalancesPlanner } from './projectedBalancesPlanner';

/** The projection for the part of the household shown, or why there isn't one yet. */
export type ProjectionState =
	| { status: 'loading' }
	/** What couldn't load: Monarch's data, or Wingspan's own saved items and settings. */
	| { status: 'unavailable'; missing: 'monarch' | 'wingspan' }
	| {
			status: 'ready';
			projection: Projection | null;
			accounts: Account[];
			checkingAccountIds: string[];
			/** Whether the household's own money is in the projection. */
			includesHousehold: boolean;
			/** When the shown Monarch data was fetched, if its latest refresh failed. */
			staleAsOf: number | null;
	  };

/**
 * Shared by the cash flow features and the card payment notes on Recurring rows, so the projection is calculated once
 * per input change. It covers the part of the household being shown: only its accounts, its items, and Monarch's
 * recurring items on its accounts. A bill or recurring item with no account belongs to the household.
 */
export class ProjectedBalancesService implements CardPaymentPlans {
	/** Each card payment item's planned payments, for its card payment notes on Recurring. */
	public readonly byItemId: ReadonlySignal<ReadonlyMap<string, PlannedCardPayment[]>>;
	private readonly currentState: ReadonlySignal<ProjectionState>;

	public constructor(
		monarchData: MonarchDataService,
		itemRepository: RecurringItemRepository,
		ledgerService: RecurringPaymentLedgerService,
		dataService: WingspanDataService,
		planner: ProjectedBalancesPlanner,
		entityCashSettings: EntityCashSettings,
		businessFilter: BusinessFilter
	) {
		this.currentState = computed((): ProjectionState => {
			const monarch = monarchData.state.value;
			if (monarch.status !== 'ready') return monarch.status === 'loading' ? { status: 'loading' } : { status: 'unavailable', missing: 'monarch' };
			const { snapshot } = monarch;
			// Wait for the saved items and settings to load, or the projection would use defaults.
			if (!dataService.isLoaded.value) return dataService.loadFailureMessage.value ? { status: 'unavailable', missing: 'wingspan' } : { status: 'loading' };

			const scope = businessFilter.view.scope.value;
			const within = businessFilter.membership.within(scope, snapshot.accounts);
			const cashSettings = entityCashSettings.forScope(snapshot.accounts, dataService.data.value, scope);
			const { checkingAccountIds } = cashSettings;
			const ledger = ledgerService.ledger.value;
			const isWithin = (occurrence: Occurrence) => within.includesItem(occurrence.item);
			// Payments Wingspan matched to a bill or card, including early payments for next month, aren't everyday spending.
			const itemTransactionIds = new Set(
				[...[...ledger.historiesByItemId.values()].flat().map(point => point.transaction), ...ledger.settledOccurrences.map(occurrence => occurrence.matchedTransaction)]
					.map(transaction => transaction?.id)
					.filter(transactionId => transactionId !== undefined)
			);
			const projection = checkingAccountIds.length
				? planner.plan({
						accounts: snapshot.accounts,
						checkingAccountIds,
						transactions: snapshot.transactions,
						recurringFlows: within.recurringFlows(snapshot.recurringFlows),
						unassignedAccountIds: new Set(snapshot.accounts.filter(account => entityIdOf(account) === HOUSEHOLD_ENTITY_ID).map(account => account.id)),
						recurringItems: itemRepository.data.value.recurringItems.filter(within.includesItem),
						outstandingOccurrences: ledger.outstandingOccurrences.filter(isWithin),
						settledOccurrences: ledger.settledOccurrences.filter(isWithin),
						itemTransactionIds,
						owedByAccountId: snapshot.owedByAccountId,
						cushion: cashSettings.cushion,
						safetyDays: cashSettings.safetyDays,
						cardAccountIds: cashSettings.cardAccountIds,
						reserveAccountIds: cashSettings.reserveAccountIds,
						dueDayByRecurrenceId: dataService.data.value.recurringDueDates.dueDatesByRecurrenceId
					})
				: null;

			return {
				status: 'ready',
				projection,
				accounts: snapshot.accounts,
				checkingAccountIds,
				includesHousehold: within.includesAccount(undefined),
				staleAsOf: monarch.isStale ? snapshot.fetchedAt : null
			};
		});
		this.byItemId = computed(() => {
			const state = this.currentState.value;
			const cards = state.status === 'ready' ? (state.projection?.cards ?? []) : [];
			return new Map(cards.flatMap(card => (card.itemId ? [[card.itemId, card.payments] as const] : [])));
		});
	}

	/** Recomputed whenever Monarch's data, Wingspan's saved data or the business filter changes. A null projection means no checking account is chosen. */
	public get state(): ReadonlySignal<ProjectionState> {
		return this.currentState;
	}
}
