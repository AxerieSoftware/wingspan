import { AsyncLocalStorage } from 'node:async_hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrossTabLock } from '../../common/crossTabLock';
import type { AccountSummary } from '../../monarch/api/models/account';
import type { MonarchAccountsClient } from '../../monarch/api/monarchAccountsClient';
import { MonarchApiError } from '../../monarch/api/monarchApiError';
import type { WingspanData } from '../models/wingspanData';
import { BrowserLocalStore } from '../stores/browserLocalStore';
import { MonarchAccountStore, SAFETY_HEADER } from '../stores/monarchAccountStore';
import { SyncedCopyStore } from '../stores/syncedCopyStore';
import { UnsavedChangesStore } from '../stores/unsavedChangesStore';
import { WingspanDataService } from './wingspanDataService';

/** A separate chrome.storage.local per fake browser, picked by which browser the calling code runs in, so browsers can interleave. */
const browserStorage = vi.hoisted(() => ({ byBrowser: new Map<string, Map<string, unknown>>(), activeBrowser: 'A' }));
const runningBrowser = vi.hoisted(() => ({ store: undefined as undefined | { getStore(): string | undefined } }));
vi.mock('wxt/utils/storage', () => {
	const items = () => {
		const browser = runningBrowser.store?.getStore() ?? browserStorage.activeBrowser;
		const existing = browserStorage.byBrowser.get(browser);
		if (existing) return existing;
		const created = new Map<string, unknown>();
		browserStorage.byBrowser.set(browser, created);
		return created;
	};
	return {
		storage: {
			getItem: async (key: string) => (items().has(key) ? structuredClone(items().get(key)) : null),
			setItem: async (key: string, value: unknown) => void items().set(key, structuredClone(value))
		}
	};
});

interface FakeAccount {
	id: string;
	displayName: string;
	notes: string | null;
	isHidden: boolean;
	isDeleted: boolean;
}

/** Monarch's accounts, shared by every browser. */
class FakeMonarch {
	public accounts: FakeAccount[] = [];
	public isDown = false;
	/** Monarch creates a new account but rejects the update that hides it. */
	public refusesHiding = false;
	public readonly calls: string[] = [];
	/** Runs before the next call of that name, once. */
	public readonly before = new Map<string, () => void>();
	private nextId = 100;

	public readonly client = {
		getAccountSummaries: async (): Promise<AccountSummary[]> =>
			this.reachable('getAccountSummaries', () => this.live().map(({ id, displayName, isHidden }) => ({ id, displayName, isHidden, type: { name: 'other_asset' } }))),
		getAccountNotes: async (id: string) => this.reachable('getAccountNotes', () => this.live().find(account => account.id === id) ?? null),
		createManualAccount: async ({ name }: { name: string }) =>
			this.reachable('createManualAccount', () => {
				const id = String(this.nextId++);
				this.accounts.push({ id, displayName: name, notes: null, isHidden: false, isDeleted: false });
				return id;
			}),
		updateAccount: async ({ id, notes, hideFromList }: { id: string; notes?: string; hideFromList?: boolean }) =>
			this.reachable('updateAccount', () => {
				const account = this.accounts.find(each => each.id === id) as FakeAccount;
				if (hideFromList && this.refusesHiding) throw new MonarchApiError("Monarch didn't make the change.", false);
				if (notes !== undefined) account.notes = notes;
				if (hideFromList) account.isHidden = true;
			}),
		deleteAccount: async (id: string) =>
			this.reachable('deleteAccount', () => {
				(this.accounts.find(each => each.id === id) as FakeAccount).isDeleted = true;
			})
	} as unknown as MonarchAccountsClient;

	/** The data stored in Wingspan's oldest account. */
	public savedData(): WingspanData | undefined {
		const notes = this.wingspanAccounts()[0]?.notes;
		return notes?.includes('{') ? JSON.parse(notes.slice(notes.indexOf('{'))).value : undefined;
	}

	/** Wingspan's accounts, oldest first. */
	public wingspanAccounts(): FakeAccount[] {
		return this.live()
			.filter(account => account.displayName === 'wingspan' && account.notes?.startsWith(SAFETY_HEADER))
			.sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));
	}

	private live(): FakeAccount[] {
		return this.accounts.filter(account => !account.isDeleted);
	}

	/** Every call yields like a real request, so two browsers' calls interleave. */
	private async reachable<T>(name: string, read: () => T): Promise<T> {
		await new Promise(resolve => setTimeout(resolve, 0));
		this.calls.push(name);
		const hook = this.before.get(name);
		this.before.delete(name);
		hook?.();

		if (this.isDown) throw new MonarchApiError("Monarch couldn't be reached.", true);
		return read();
	}
}

/** Web Locks for the fake browsers: tabs of one browser take turns, different browsers don't. */
const heldLocks = new Map<string, Promise<unknown>>();
const browserLock: CrossTabLock = {
	run: <T>(name: string, task: () => Promise<T>): Promise<T> => {
		const lockKey = `${browserContext.getStore() ?? browserStorage.activeBrowser}:${name}`;
		const result = (heldLocks.get(lockKey) ?? Promise.resolve()).then(task, task);
		heldLocks.set(
			lockKey,
			result.catch(() => undefined)
		);
		return result;
	}
};

const serviceFor = (monarch: FakeMonarch) =>
	new WingspanDataService(
		new BrowserLocalStore<WingspanData>(() => 'local:wingspan'),
		new MonarchAccountStore<WingspanData>(monarch.client),
		new UnsavedChangesStore(() => 'local:wingspanUnsavedChanges'),
		new SyncedCopyStore(() => 'local:wingspanSynced'),
		browserLock,
		() => 'wingspanData',
		'1.0.0'
	);
const dataWith = (dueDays: Record<string, number>, cashSettings: WingspanData['cashSettings'] = { cushion: 0 }): WingspanData => ({
	recurring: { trackingSince: '', recurringItems: [] },
	recurringDueDates: { dueDatesByRecurrenceId: dueDays },
	cashSettings,
	businessCashSettings: {},
	hsaReimbursementTags: { toReimburseTagId: '', reimbursedTagId: '' }
});
const browserContext = new AsyncLocalStorage<string>();
runningBrowser.store = browserContext;
async function inBrowser<T>(browser: string, run: () => Promise<T>): Promise<T> {
	browserStorage.activeBrowser = browser;
	return browserContext.run(browser, run);
}

beforeEach(() => {
	browserStorage.byBrowser.clear();
	heldLocks.clear();
	browserStorage.activeBrowser = 'A';
});

const notesWith = (value: WingspanData, etag: string) => `${SAFETY_HEADER}\n\n${JSON.stringify({ version: 1, etag, value })}`;
const addDueDay = (recurrenceId: string, day: number) => (data: WingspanData) => ({
	...data,
	recurringDueDates: { ...data.recurringDueDates, dueDatesByRecurrenceId: { ...data.recurringDueDates.dueDatesByRecurrenceId, [recurrenceId]: day } }
});

describe('saving in Monarch across browsers', () => {
	it("doesn't let a browser whose refresh failed overwrite another browser's newer changes", async () => {
		const monarch = new FakeMonarch();
		const [a, b] = [serviceFor(monarch), serviceFor(monarch)];
		await inBrowser('A', () => a.update(() => dataWith({ rent: 1 }, { cushion: 0, checkingAccountIds: ['first'] })));
		await inBrowser('B', () => b.load());
		await inBrowser('B', () => b.update(data => ({ ...data, recurringDueDates: { dueDatesByRecurrenceId: { rent: 15 } }, cashSettings: { cushion: 0, checkingAccountIds: ['second'] } })));

		monarch.isDown = true;
		await inBrowser('A', () => a.refresh());
		expect(a.status.value.state).toBe('error');
		monarch.isDown = false;
		await inBrowser('A', () => a.refresh());

		expect(monarch.savedData()).toMatchObject({ recurringDueDates: { dueDatesByRecurrenceId: { rent: 15 } }, cashSettings: { checkingAccountIds: ['second'] } });
		expect(a.data.value.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 15 });
	});

	it('keeps a change made while Monarch is down, including settings, and saves it once Monarch is back', async () => {
		const monarch = new FakeMonarch();
		const a = serviceFor(monarch);
		await a.update(() => dataWith({}, { cushion: 100 }));

		monarch.isDown = true;
		await a.update(data => ({ ...data, cashSettings: { cushion: 500 } }));
		expect(a.status.value.state).toBe('error');
		monarch.isDown = false;
		await a.refresh();

		expect(a.data.value.cashSettings.cushion).toBe(500);
		expect(monarch.savedData()?.cashSettings.cushion).toBe(500);
	});

	it('ends up with one account when two tabs save for the first time', async () => {
		const monarch = new FakeMonarch();
		const [first, second] = [serviceFor(monarch), serviceFor(monarch)];
		await Promise.all([first.load(), second.load()]);

		await Promise.all([first.update(() => dataWith({ a: 1 })), second.update(() => dataWith({ b: 2 }))]);
		await first.refresh();

		expect(monarch.wingspanAccounts()).toHaveLength(1);
	});

	it("hides its account if it shows in Monarch's lists", async () => {
		const monarch = new FakeMonarch();
		monarch.accounts.push({ id: '1', displayName: 'wingspan', notes: notesWith(dataWith({}), 'e'), isHidden: false, isDeleted: false });

		await serviceFor(monarch).load();

		expect(monarch.accounts[0]?.isHidden).toBe(true);
	});

	it("recreates the account from this browser's copy after it's deleted in Monarch", async () => {
		const monarch = new FakeMonarch();
		const a = serviceFor(monarch);
		await a.update(() => dataWith({ rent: 1 }));
		for (const account of monarch.wingspanAccounts()) account.isDeleted = true;

		await a.update(addDueDay('gym', 2));

		expect(monarch.wingspanAccounts()).toHaveLength(1);
		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 1, gym: 2 });
	});

	it("doesn't write when a new browser has no data of its own", async () => {
		const monarch = new FakeMonarch();
		await inBrowser('A', () => serviceFor(monarch).update(() => dataWith({ rent: 1 })));
		const before = monarch.calls.filter(call => call === 'updateAccount').length;

		await inBrowser('B', () => serviceFor(monarch).load());

		expect(monarch.calls.filter(call => call === 'updateAccount').length).toBe(before);
	});

	it("merges a browser's own items when it first finds an account another browser created", async () => {
		const monarch = new FakeMonarch();
		await inBrowser('C', () => serviceFor(monarch).update(() => dataWith({ phone: 3 })));
		browserStorage.byBrowser.set('A', new Map<string, unknown>([['local:wingspan', { version: 1, etag: 'own', value: dataWith({ rent: 1 }, { cushion: 500 }) }]]));

		const a = serviceFor(monarch);
		await inBrowser('A', () => a.load());

		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 1, phone: 3 });
		expect(monarch.savedData()?.cashSettings.cushion).toBe(500);
		expect(a.data.value.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 1, phone: 3 });
	});
});

describe('concurrent tabs and browsers', () => {
	it("doesn't let a tab with an old copy of this browser's data undo another tab's unsaved change", async () => {
		const monarch = new FakeMonarch();
		const [firstTab, secondTab] = [serviceFor(monarch), serviceFor(monarch)];
		await firstTab.update(() => dataWith({ rent: 1 }));
		await secondTab.load();

		monarch.isDown = true;
		await firstTab.update(data => ({ ...data, recurringDueDates: { dueDatesByRecurrenceId: { rent: 2 } } }));
		monarch.isDown = false;
		await secondTab.refresh();

		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 2 });
	});

	it('ends up with one account when two browsers save for the first time at once', async () => {
		const monarch = new FakeMonarch();
		const [a, b] = [serviceFor(monarch), serviceFor(monarch)];

		await Promise.all([inBrowser('A', () => a.update(addDueDay('a', 1))), inBrowser('B', () => b.update(addDueDay('b', 2)))]);
		await inBrowser('A', () => a.refresh());
		await inBrowser('B', () => b.refresh());

		expect(monarch.accounts.filter(account => !account.isDeleted)).toHaveLength(1);
	});

	it('switches to the oldest account once an older one appears, leaving the newer one alone', async () => {
		const monarch = new FakeMonarch();
		const newer = { id: '200', displayName: 'wingspan', notes: notesWith(dataWith({ gym: 1 }), 'e200'), isHidden: true, isDeleted: false };
		monarch.accounts.push({ ...newer });
		const service = serviceFor(monarch);
		await service.load();

		monarch.accounts.push({ id: '100', displayName: 'wingspan', notes: notesWith(dataWith({ rent: 1 }), 'e100'), isHidden: true, isDeleted: false });
		await service.update(addDueDay('rent', 5));

		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 5 });
		expect(monarch.accounts.find(account => account.id === '200')).toEqual(newer);
	});
});

describe("never touching what isn't Wingspan's", () => {
	it("leaves a user's own account named wingspan alone and saves to a separate account", async () => {
		const monarch = new FakeMonarch();
		const ownAccount = { id: '1', displayName: 'wingspan', notes: 'My notes', isHidden: false, isDeleted: false };
		monarch.accounts.push({ ...ownAccount });

		await serviceFor(monarch).update(() => dataWith({ rent: 3 }));

		expect(monarch.accounts[0]).toEqual(ownAccount);
		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 3 });
	});

	it('leaves an account named Wingspan, capitalized, alone', async () => {
		const monarch = new FakeMonarch();
		const legacy = { id: 'legacy', displayName: 'Wingspan', notes: notesWith(dataWith({ old: 1 }), 'legacy'), isHidden: true, isDeleted: false };
		monarch.accounts.push({ ...legacy });

		await serviceFor(monarch).update(() => dataWith({ rent: 3 }));

		expect(monarch.accounts[0]).toEqual(legacy);
	});

	it("never writes over Monarch notes it can't read", async () => {
		const monarch = new FakeMonarch();
		monarch.accounts.push({ id: '1', displayName: 'wingspan', notes: `${SAFETY_HEADER} {"version":1,"etag":"e","value":{"unknown":true}}`, isHidden: true, isDeleted: false });
		const a = serviceFor(monarch);

		await a.load();
		await a.update(() => dataWith({ rent: 3 }));

		expect(monarch.accounts).toHaveLength(1);
		expect(monarch.accounts[0]).toMatchObject({ notes: expect.stringContaining('unknown'), isDeleted: false });
	});

	it("never writes over browser data it can't read", async () => {
		const unreadable = { version: 1, etag: 42, value: dataWith({ keep: 9 }) };
		browserStorage.byBrowser.set('A', new Map<string, unknown>([['local:wingspan', unreadable]]));
		const a = serviceFor(new FakeMonarch());

		await a.load();
		await a.update(data => ({ ...data, cashSettings: { cushion: 1 } }));

		expect(a.status.value.state).toBe('error');
		expect(browserStorage.byBrowser.get('A')?.get('local:wingspan')).toEqual(unreadable);
	});
});

describe("Wingspan's account in Monarch", () => {
	it("never leaves a new account showing in Monarch when hiding it fails, however often it's tried", async () => {
		const monarch = new FakeMonarch();
		monarch.refusesHiding = true;
		const service = serviceFor(monarch);

		await service.update(() => dataWith({ rent: 1 }));
		await service.refresh();
		await service.update(data => ({ ...data, recurringDueDates: { dueDatesByRecurrenceId: { rent: 2 } } }));

		expect(monarch.accounts.filter(account => !account.isDeleted)).toEqual([]);
		expect(service.data.value.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 2 });
	});

	it("still loads and saves when Monarch won't hide the account", async () => {
		const monarch = new FakeMonarch();
		monarch.accounts.push({ id: '1', displayName: 'wingspan', notes: notesWith(dataWith({ rent: 1 }), 'e'), isHidden: false, isDeleted: false });
		monarch.refusesHiding = true;
		const service = serviceFor(monarch);

		await service.update(addDueDay('rent', 2));

		expect(service.status.value.state).toBe('idle');
		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 2 });
	});

	it("keeps fields saved by a newer version of Wingspan that this one doesn't know", async () => {
		const monarch = new FakeMonarch();
		const saved = { ...dataWith({ rent: 1 }), futureFeature: { on: true } };
		monarch.accounts.push({ id: '1', displayName: 'wingspan', notes: `${SAFETY_HEADER}\n\n${JSON.stringify({ version: 1, etag: 'e', value: saved })}`, isHidden: true, isDeleted: false });
		const service = serviceFor(monarch);

		await service.update(addDueDay('rent', 2));

		expect(monarch.savedData()).toMatchObject({ futureFeature: { on: true }, recurringDueDates: { dueDatesByRecurrenceId: { rent: 2 } } });
	});
});

describe('loading', () => {
	it("finishes loading after this browser's copy couldn't be read, once it can", async () => {
		const monarch = new FakeMonarch();
		browserStorage.byBrowser.set('A', new Map<string, unknown>([['local:wingspan', { not: "wingspan's" }]]));
		const service = serviceFor(monarch);

		await service.load();
		expect(service.status.value.state).toBe('error');
		// Nothing was read, so defaults aren't presented as the household's data.
		expect(service.isLoaded.value).toBe(false);

		browserStorage.byBrowser.get('A')?.delete('local:wingspan');
		await service.load();
		expect(service.status.value.state).toBe('idle');
		expect(service.isLoaded.value).toBe(true);
	});
});

describe('merging changes made offline', () => {
	it("keeps another browser's newer edits, taking only what this browser changed", async () => {
		const monarch = new FakeMonarch();
		const [a, b] = [serviceFor(monarch), serviceFor(monarch)];
		await inBrowser('A', () => a.update(() => dataWith({ rent: 1 }, { cushion: 100 })));
		await inBrowser('B', () => b.load());

		monarch.isDown = true;
		await inBrowser('B', () => b.update(addDueDay('phone', 9)));
		monarch.isDown = false;
		await inBrowser('A', () => a.update(data => ({ ...data, recurringDueDates: { dueDatesByRecurrenceId: { rent: 20 } }, cashSettings: { cushion: 999 } })));
		await inBrowser('B', () => b.refresh());

		expect(monarch.savedData()).toMatchObject({ recurringDueDates: { dueDatesByRecurrenceId: { rent: 20, phone: 9 } }, cashSettings: { cushion: 999 } });
	});
});

describe('error messages', () => {
	const unreadable = `${SAFETY_HEADER} {"version":1,"etag":"e","value":{"unknown":true}}`;

	it("explains why it can't save when Monarch's data can't be read, in plain language", async () => {
		const monarch = new FakeMonarch();
		monarch.accounts.push({ id: '1', displayName: 'wingspan', notes: unreadable, isHidden: true, isDeleted: false });
		const service = serviceFor(monarch);

		await service.update(() => dataWith({ rent: 3 }));

		expect(service.status.value.message).toMatch(/can't read what it saved in Monarch, so it's leaving it as is/);
		expect(service.status.value.message).not.toMatch(/unknown|expected|ETag/);
	});

	it("asks to update instead of reporting a problem when a newer version saved data this one can't read", async () => {
		const monarch = new FakeMonarch();
		// A setting value from a newer version that this one doesn't know, in otherwise valid data.
		const newer = { ...dataWith({ rent: 3 }), cashSettings: { cushion: 0, reserveAccountIds: 'all' } };
		monarch.accounts.push({
			id: '1',
			displayName: 'wingspan',
			notes: `${SAFETY_HEADER}\n\n${JSON.stringify({ version: 1, etag: 'e1', wingspanVersion: '1.1.0', value: newer })}`,
			isHidden: true,
			isDeleted: false
		});
		const service = serviceFor(monarch);

		await service.update(() => dataWith({ rent: 4 }));

		expect(service.status.value.message).toMatch(/A newer version of Wingspan saved your data.*Update Wingspan/);
		expect(monarch.savedData()?.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 3 });
	});

	it('only says a change was kept in this browser when it actually was', async () => {
		const monarch = new FakeMonarch();
		const service = serviceFor(monarch);
		await service.update(() => dataWith({ rent: 1 }));

		monarch.isDown = true;
		await service.update(() => dataWith({ rent: 2 }));

		expect(service.status.value.message).toBe("Couldn't save to Monarch. Monarch couldn't be reached. Your change is saved in this browser and will be saved to Monarch once it's reachable.");
	});
});
