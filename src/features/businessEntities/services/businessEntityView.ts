import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import { logError } from '../../../common/log';
import { isSameValue } from '../../../common/sameValue';
import type { BusinessEntity } from '../../../monarch/api/models/businessEntity';
import type { MonarchAccountsClient } from '../../../monarch/api/monarchAccountsClient';
import { EntityScope } from '../models/entityScope';

const BUSINESS_ENTITIES_QUERY = 'monarchBusinessEntities';
/** This tab's selection on Recurring, stored in session storage like Monarch stores its own filter. */
const CHOICE_STORAGE_KEY = 'wingspanBusinessEntitySet';
/** How long to wait before retrying after businesses fail to load. */
const LOAD_RETRY_MS = 60_000;

/**
 * Which businesses Wingspan shows. Where Monarch has its own business filter, like on Cash Flow, Wingspan follows it.
 * On Recurring, which has none, Wingspan's switch decides. Changing Monarch's filter also updates the switch, so
 * both stay in sync.
 */
export class BusinessEntityView {
	/** Null until businesses load from Monarch. */
	private readonly businessList = signal<BusinessEntity[] | null>(null);
	private readonly hasLoadFailed = signal(false);
	private readonly followsMonarch = signal(false);
	private readonly shownFilter = signal<readonly string[]>([]);
	private readonly chosenFilter = signal<readonly string[] | null>(null);
	private lastMonarchFilter: readonly string[] | null = null;
	private isLoading = false;
	private retryAt = 0;
	/** The current scope, based on the filter on the page. */
	public readonly scope: ReadonlySignal<EntityScope>;

	public constructor(
		private readonly storage: Storage,
		private readonly accountsClient: MonarchAccountsClient,
		private readonly queryClient: QueryClient
	) {
		this.chosenFilter.value = this.readChoice();
		this.scope = computed(() => {
			const businesses = this.businessList.value;
			if (businesses) return EntityScope.fromFilter(this.shownFilter.value, businesses);
			// Until businesses load, the filter is used as-is. If they never load, Wingspan's switch can't show, so its
			// selection doesn't filter anything. Monarch's filter still applies where it's on the page.
			return this.hasLoadFailed.value && !this.followsMonarch.value ? EntityScope.everything([]) : EntityScope.assumed(this.shownFilter.value);
		});
	}

	/** Null until businesses load from Monarch. */
	public get businesses(): ReadonlySignal<BusinessEntity[] | null> {
		return this.businessList;
	}

	/** The last filter set, in Monarch's format: business ids plus Household's id, with an empty list meaning everything. */
	public get filter(): ReadonlySignal<readonly string[]> {
		return this.shownFilter;
	}

	/** Fetches businesses from Monarch once. After a failure, waits a minute before retrying. */
	public load(): void {
		if (this.isLoading || this.businessList.peek() || Date.now() < this.retryAt) return;
		this.isLoading = true;
		this.queryClient
			.query({ queryKey: [BUSINESS_ENTITIES_QUERY], queryFn: () => this.accountsClient.getBusinessEntities() })
			.then(businesses => {
				this.businessList.value = businesses;
				this.hasLoadFailed.value = false;
			})
			.catch((error: unknown) => {
				logError(error);
				this.hasLoadFailed.value = true;
				this.retryAt = Date.now() + LOAD_RETRY_MS;
			})
			.finally(() => {
				this.isLoading = false;
			});
	}

	/** Called each sync with Monarch's saved filter and whether Monarch's filter is on the page, so Wingspan matches it. */
	public follow(monarchFilter: readonly string[], isMonarchsFilterShown: boolean): void {
		if (this.lastMonarchFilter === null) {
			this.lastMonarchFilter = monarchFilter;
			if (this.chosenFilter.peek() === null) this.chosenFilter.value = monarchFilter;
		} else if (!isSameValue(monarchFilter, this.lastMonarchFilter)) {
			this.lastMonarchFilter = monarchFilter;
			this.choose(monarchFilter);
		}

		if (this.followsMonarch.peek() !== isMonarchsFilterShown) this.followsMonarch.value = isMonarchsFilterShown;
		const shown = isMonarchsFilterShown ? monarchFilter : (this.chosenFilter.peek() ?? monarchFilter);
		if (!isSameValue(shown, this.shownFilter.peek())) this.shownFilter.value = shown;
	}

	/** Applies this filter and saves it as the switch's selection in this tab's session storage. */
	public choose(filter: readonly string[]): void {
		this.chosenFilter.value = filter;
		this.shownFilter.value = filter;
		try {
			this.storage.setItem(CHOICE_STORAGE_KEY, JSON.stringify(filter));
		} catch {
			// Without storage, the selection is lost on reload.
		}
	}

	private readChoice(): readonly string[] | null {
		try {
			const saved: unknown = JSON.parse(this.storage.getItem(CHOICE_STORAGE_KEY) ?? 'null');
			return Array.isArray(saved) && saved.every(entityId => typeof entityId === 'string') ? saved : null;
		} catch {
			return null;
		}
	}
}
