import { QueryClient } from '@tanstack/query-core';
import { browser } from 'wxt/browser';
import { Calendar } from './common/calendar';
import { StalePage } from './common/stalePage';
import { SyncedQueries } from './common/syncedQueries';
import { SyncScheduler } from './common/syncScheduler';
import { createStorage } from './data/createStorage';
import { MonarchDataService } from './data/services/monarchDataService';
import type { WingspanDataService } from './data/services/wingspanDataService';
import { StorageScope } from './data/stores/storageScope';
import { PROJECTED_DAYS } from './features/cashFlow/projectedBalances/models/projectionHorizon';
import type { WingspanFeature } from './features/wingspanFeature';
import { createMonarchApi, type MonarchApi } from './monarch/api/createMonarchApi';
import { MonarchApiError } from './monarch/api/monarchApiError';
import { createMonarchPages, type MonarchPages } from './monarch/pages/createMonarchPages';
import { MonarchSession } from './monarch/session/monarchSession';
import { ToastService } from './monarch/ui/components/toast';
import { Formatter } from './monarch/ui/formatter';
import { Wingspan } from './wingspan';

const MONARCH_DATA_FRESH_MS = 5 * 60_000;
const MONARCH_REQUEST_RETRIES = 2;

/** Makes the services features share. Features are added here, then `build` makes the runtime. */
export class WingspanBuilder implements Disposable {
	/** From the manifest, or "unknown". */
	public readonly version: string;
	public readonly calendar: Calendar;
	public readonly formatter: Formatter;
	public readonly syncScheduler: SyncScheduler;
	public readonly session: MonarchSession;
	public readonly monarchApi: MonarchApi;
	public readonly queryClient: QueryClient;
	public readonly syncedQueries: SyncedQueries;
	public readonly dataService: WingspanDataService;
	public readonly monarchData: MonarchDataService;
	public readonly pages: MonarchPages;
	public readonly toastService: ToastService;
	public readonly stalePage: StalePage;
	private readonly addedFeatures: WingspanFeature[] = [];
	private readonly shared = new DisposableStack();

	public constructor(public readonly window: Window) {
		this.version = currentVersion();
		this.calendar = new Calendar();
		this.formatter = new Formatter(this.calendar);
		this.syncScheduler = new SyncScheduler(window);
		this.session = new MonarchSession(window);
		const scope = new StorageScope(this.session);
		this.monarchApi = createMonarchApi(window, this.version, scope);

		const retry = (failureCount: number, error: Error) => failureCount < MONARCH_REQUEST_RETRIES && error instanceof MonarchApiError && error.isRetryable;
		this.queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: MONARCH_DATA_FRESH_MS, retry } } });
		this.syncedQueries = new SyncedQueries(this.queryClient, this.syncScheduler);

		this.dataService = createStorage(window, scope, this.monarchApi.accounts, this.version);
		this.monarchData = new MonarchDataService(this.queryClient, this.monarchApi.transactions, this.monarchApi.accounts, this.monarchApi.recurring, this.calendar, PROJECTED_DAYS);
		this.pages = createMonarchPages(window);
		this.toastService = new ToastService();
		this.stalePage = new StalePage(window.document, this.toastService);
	}

	/** The runtime, which takes over the builder and disposes it with everything added to it. */
	public build(): Wingspan {
		return new Wingspan(this);
	}

	/** In the order added, which is the order they start and sync. */
	public get features(): readonly WingspanFeature[] {
		return this.addedFeatures;
	}

	/** The runtime starts it, syncs it and disposes it. */
	public addFeature(feature: WingspanFeature): void {
		this.addedFeatures.push(feature);
	}

	/** Keeps something several features use until the builder is disposed, and returns it. */
	public addShared<TShared extends Disposable>(shared: TShared): TShared {
		return this.shared.use(shared);
	}

	public [Symbol.dispose](): void {
		this.shared.dispose();
	}
}

function currentVersion(): string {
	try {
		return browser.runtime.getManifest().version;
	} catch {
		return 'unknown';
	}
}
