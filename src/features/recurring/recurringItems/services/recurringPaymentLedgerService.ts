import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { MonarchDataService } from '../../../../data/services/monarchDataService';
import type { PaymentLedger } from '../models/paymentLedger';
import type { RecurringItemRepository } from './recurringItemRepository';
import type { RecurringPaymentCalculator } from './recurringPaymentCalculator';

/** The payment ledger, recalculated whenever items or Monarch's data change. */
export class RecurringPaymentLedgerService {
	private readonly currentLedger: ReadonlySignal<PaymentLedger>;

	public constructor(itemRepository: RecurringItemRepository, monarchData: MonarchDataService, paymentCalculator: RecurringPaymentCalculator) {
		this.currentLedger = computed(() => {
			const snapshot = monarchData.snapshot.value;
			return paymentCalculator.ledger(itemRepository.data.value, snapshot?.transactions ?? [], snapshot?.owedByAccountId ?? {});
		});
	}

	/** Until Monarch's transactions load, every due date in it is unpaid. */
	public get ledger(): ReadonlySignal<PaymentLedger> {
		return this.currentLedger;
	}
}
