import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import { logError } from '../../../common/log';
import { isSameValue } from '../../../common/sameValue';
import type { BusinessEntity } from '../../../monarch/api/models/businessEntity';
import type { MonarchAccountsClient } from '../../../monarch/api/monarchAccountsClient';
import type { MonarchSession } from '../../../monarch/session/monarchSession';
import { EntityScope, HOUSEHOLD_ENTITY_ID } from '../models/entityScope';
import type { WorkspaceChoice } from './workspaceChoice';

const BUSINESS_ENTITIES_QUERY = 'monarchBusinessEntities';
/** How long to wait before retrying after businesses fail to load. */
const LOAD_RETRY_MS = 60_000;

/**
 * Which workspace Wingspan shows: Household or one business, never a mix. The choice is saved per browser and
 * household. On Cash Flow, whose own business filter can still be changed on the page, Wingspan follows that filter.
 */
export class BusinessEntityView {
	private readonly businessList = signal<BusinessEntity[] | null>(null);
	private readonly hasLoadFailed = signal(false);
	private readonly chosenEntityId = signal<string | null>(null);
	private readonly enabled = signal(true);
	/** Monarch's filter while its page shows one, otherwise null. */
	private readonly monarchFilter = signal<readonly string[] | null>(null);
	private householdId: string | null = null;
	private isLoading = false;
	private retryAt = 0;
	/** The current scope, based on the workspace or the filter on the page. */
	public readonly scope: ReadonlySignal<EntityScope>;
	/** The workspace's entity id, or null when workspaces are off or there are no businesses to switch between. */
	public readonly workspace: ReadonlySignal<string | null>;

	public constructor(
		private readonly choice: WorkspaceChoice,
		private readonly session: MonarchSession,
		private readonly accountsClient: MonarchAccountsClient,
		private readonly queryClient: QueryClient
	) {
		this.workspace = computed(() => {
			if (!this.enabled.value) return null;
			const businesses = this.businessList.value;
			// Until businesses load, the saved choice is used as-is. If they never load, nothing is filtered.
			if (!businesses) return this.hasLoadFailed.value ? null : this.chosenEntityId.value;
			if (!businesses.length) return null;
			const chosen = this.chosenEntityId.value;
			// A business that was deleted, or nothing chosen yet, falls back to Household.
			return chosen && businesses.some(business => business.id === chosen) ? chosen : HOUSEHOLD_ENTITY_ID;
		});
		this.scope = computed(() => {
			const businesses = this.businessList.value ?? [];
			const monarchFilter = this.monarchFilter.value;
			if (monarchFilter) return this.businessList.value ? EntityScope.fromFilter(monarchFilter, businesses) : EntityScope.assumed(monarchFilter);
			const workspace = this.workspace.value;
			return workspace ? EntityScope.fromFilter([workspace], businesses) : EntityScope.everything(businesses);
		});
	}

	/** Null until businesses load from Monarch. */
	public get businesses(): ReadonlySignal<BusinessEntity[] | null> {
		return this.businessList;
	}

	/** Whether workspaces are on in Wingspan's settings, for this browser and household. */
	public get isEnabled(): ReadonlySignal<boolean> {
		return this.enabled;
	}

	/** Fetches businesses from Monarch once, and reads the saved workspace for the signed-in household. After a failure, waits a minute before retrying. */
	public load(): void {
		const householdId = this.session.householdId();
		if (householdId !== this.householdId) {
			this.householdId = householdId;
			const saved = householdId ? this.choice.read(householdId) : null;
			this.chosenEntityId.value = saved?.entityId ?? null;
			this.enabled.value = saved?.isEnabled ?? true;
		}
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

	/** Called each sync with Monarch's filter while its page shows one, or null on pages without one. */
	public follow(monarchFilter: readonly string[] | null): void {
		if (!isSameValue(monarchFilter, this.monarchFilter.peek())) this.monarchFilter.value = monarchFilter;
	}

	/** Saves the workspace for this household. */
	public choose(entityId: string): void {
		if (this.chosenEntityId.peek() === entityId) return;
		this.chosenEntityId.value = entityId;
		this.save();
	}

	/** Turns workspaces on or off. Off, pages open as Monarch opens them and Monarch's own filters still apply. */
	public setEnabled(isEnabled: boolean): void {
		this.enabled.value = isEnabled;
		this.save();
	}

	private save(): void {
		if (this.householdId) this.choice.write(this.householdId, { entityId: this.chosenEntityId.peek(), isEnabled: this.enabled.peek() });
	}
}
