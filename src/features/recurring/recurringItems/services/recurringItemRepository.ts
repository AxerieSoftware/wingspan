import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { Calendar } from '../../../../common/calendar';
import type { WingspanDataService } from '../../../../data/services/wingspanDataService';
import type { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { RecurringData } from '../models/recurringData';
import type { RecurringItem } from '../models/recurringItem';

/** Items of a kind no longer registered stay saved but are hidden. */
export class RecurringItemRepository {
	private readonly recurringData: ReadonlySignal<RecurringData>;
	private readonly itemsById: ReadonlySignal<ReadonlyMap<string, RecurringItem>>;

	public constructor(
		private readonly dataService: WingspanDataService,
		private readonly calendar: Calendar,
		private readonly kinds: RecurringItemKindRegistry
	) {
		this.recurringData = computed(() => {
			const recurring = this.withTrackingSince(this.dataService.data.value.recurring);
			return { ...recurring, recurringItems: recurring.recurringItems.filter(item => this.kinds.supports(item)) };
		});
		this.itemsById = computed(() => new Map(this.recurringData.value.recurringItems.map(item => [item.id, item])));
	}

	/** Saved items of registered kinds only, with `trackingSince` filled in. */
	public get data(): ReadonlySignal<RecurringData> {
		return this.recurringData;
	}

	/** Undefined for an item that's gone or of an unregistered kind. */
	public find(itemId: string): RecurringItem | undefined {
		return this.itemsById.value.get(itemId);
	}

	/** Adds the item, or replaces the saved one with its id. */
	public save(savedItem: RecurringItem): Promise<void> {
		return this.dataService.update(data => {
			const recurring = this.withTrackingSince(data.recurring);
			const exists = recurring.recurringItems.some(item => item.id === savedItem.id);
			const recurringItems = exists ? recurring.recurringItems.map(item => (item.id === savedItem.id ? savedItem : item)) : [...recurring.recurringItems, savedItem];
			return { ...data, recurring: { ...recurring, recurringItems } };
		});
	}

	/** Works on the saved data, so it removes an item of an unregistered kind too. */
	public remove(itemId: string): Promise<void> {
		return this.dataService.update(data => ({ ...data, recurring: { ...data.recurring, recurringItems: data.recurring.recurringItems.filter(item => item.id !== itemId) } }));
	}

	// Tracking starts the month the first item is saved; nothing before it is owed.
	private withTrackingSince(recurring: RecurringData): RecurringData {
		return recurring.trackingSince ? recurring : { ...recurring, trackingSince: this.calendar.currentMonth() };
	}
}
