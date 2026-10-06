import { browser } from 'wxt/browser';
import { logError } from './common/log';
import type { StalePage } from './common/stalePage';
import type { SyncedQueries } from './common/syncedQueries';
import type { SyncScheduler } from './common/syncScheduler';
import type { MonarchDataService } from './data/services/monarchDataService';
import type { WingspanDataService } from './data/services/wingspanDataService';
import type { WingspanFeature } from './features/wingspanFeature';
import { WINGSPAN_PARTS_SELECTOR } from './monarch/pages/wingspanAttributes';
import type { MonarchSession } from './monarch/session/monarchSession';
import type { WingspanBuilder } from './wingspanBuilder';

const VISIBLE_REFRESH_MS = 60_000;
const STARTED_EVENT = 'wingspan:started';

/** Keeps every feature in step with Monarch's page, and stops them all once the extension goes away. */
export class Wingspan implements Disposable {
	private readonly listeners = new DisposableStack();
	private readonly featureLifetime = new DisposableStack();
	private isSuspended = false;
	private householdId: string | null = null;
	private readonly failingFeatures = new Set<WingspanFeature>();
	private lastVisibleRefresh = 0;
	private hasReportedUnknownHousehold = false;
	private readonly window: Window;
	private readonly dataService: WingspanDataService;
	private readonly monarchData: MonarchDataService;
	private readonly syncedQueries: SyncedQueries;
	private readonly syncScheduler: SyncScheduler;
	private readonly stalePage: StalePage;
	private readonly session: MonarchSession;
	private readonly features: readonly WingspanFeature[];

	public constructor(builder: WingspanBuilder) {
		this.window = builder.window;
		this.dataService = builder.dataService;
		this.monarchData = builder.monarchData;
		this.syncedQueries = builder.syncedQueries;
		this.syncScheduler = builder.syncScheduler;
		this.stalePage = builder.stalePage;
		this.session = builder.session;
		this.features = builder.features;
		this.featureLifetime.use(builder);
	}

	/** Brings every feature in line with the page. A feature that throws is logged once and tried again next sync. */
	public readonly sync = (): void => {
		if (this.isSuspended) return;
		if (!this.isExtensionAlive()) {
			this.suspend();
			return;
		}

		if (!this.followSession()) return;

		for (const feature of this.features) {
			try {
				feature.sync();
				this.failingFeatures.delete(feature);
			} catch (error) {
				if (!this.failingFeatures.has(feature)) logError(error);
				this.failingFeatures.add(feature);
			}
		}
	};

	private followSession(): boolean {
		const householdId = this.session.householdId();
		if (!householdId && !this.householdId && this.session.hasUser() && !this.hasReportedUnknownHousehold) {
			this.hasReportedUnknownHousehold = true;
			void this.dataService.load();
		}
		if (!householdId || householdId === this.householdId) return true;
		if (this.householdId) {
			this.window.location.reload();
			return false;
		}

		this.householdId = householdId;
		void this.dataService.load();
		return true;
	}

	/** Stops syncing and greys out Wingspan once the extension was updated or disabled under the page. This one never resumes: a reload or a newer Wingspan takes over. */
	public suspend(): void {
		if (this.isSuspended) return;
		this.isSuspended = true;
		this.listeners.dispose();

		for (const feature of this.features) {
			try {
				feature.suspend?.();
			} catch (error) {
				logError(error);
			}
		}

		this.stalePage.show();
	}

	public [Symbol.dispose](): void {
		this.isSuspended = true;
		this.listeners.dispose();
		this.featureLifetime.dispose();
		this.stalePage.hide();
		this.window.removeEventListener(STARTED_EVENT, this.stepAside);
	}

	private readonly stepAside = (): void => this[Symbol.dispose]();

	/** Starts every feature and syncs on page changes. A Wingspan started later on the page, as after an update, replaces this one. */
	public start(): void {
		const document = this.window.document;

		this.window.dispatchEvent(new CustomEvent(STARTED_EVENT));
		this.window.addEventListener(STARTED_EVENT, this.stepAside);

		for (const feature of this.features) {
			feature.start();
			this.featureLifetime.use(feature);
		}

		this.syncScheduler.attach(this.sync);
		this.listeners.defer(() => this.syncScheduler.detach());

		const observer = new MutationObserver(records => {
			if (records.some(record => !isInWingspansParts(record.target))) this.syncScheduler.request();
		});

		observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		observer.observe(document.head, { childList: true, subtree: true, characterData: true });
		this.listeners.defer(() => observer.disconnect());

		const requestSync = () => this.syncScheduler.request();
		this.window.addEventListener('popstate', this.sync);
		document.addEventListener('visibilitychange', this.refreshWhenVisible);
		document.addEventListener('click', requestSync, true);

		this.listeners.defer(() => {
			this.window.removeEventListener('popstate', this.sync);
			document.removeEventListener('visibilitychange', this.refreshWhenVisible);
			document.removeEventListener('click', requestSync, true);
		});

		this.sync();
	}

	private readonly refreshWhenVisible = (): void => {
		if (this.window.document.visibilityState !== 'visible') return;

		this.monarchData.forgetFailure();
		this.syncedQueries.forgetFailures();
		this.sync();

		if (!this.householdId || Date.now() - this.lastVisibleRefresh < VISIBLE_REFRESH_MS) return;
		this.lastVisibleRefresh = Date.now();
		void this.dataService.refresh();
	};

	private isExtensionAlive(): boolean {
		try {
			return !!browser.runtime?.id;
		} catch {
			return false;
		}
	}
}

function isInWingspansParts(target: Node): boolean {
	const targetEl = target instanceof Element ? target : target.parentElement;
	return targetEl?.closest(WINGSPAN_PARTS_SELECTOR) != null;
}
