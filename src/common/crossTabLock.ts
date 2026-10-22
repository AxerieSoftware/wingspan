/** A named lock shared across all tabs in this browser. Tasks with the same name run one at a time. */
export interface CrossTabLock {
	run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

/** Firefox gives content scripts the page's own objects through `wrappedJSObject`. Other browsers don't have it. */
interface FirefoxContentWindow extends Window {
	wrappedJSObject: { Promise: PromiseConstructor };
}

/** The lock for a content script on this window's page. */
export function createCrossTabLock(window: Window): CrossTabLock {
	return 'wrappedJSObject' in window ? new FirefoxContentScriptLock(window.navigator.locks, (window as FirefoxContentWindow).wrappedJSObject.Promise) : new WebLock(window.navigator.locks);
}

class WebLock implements CrossTabLock {
	public constructor(private readonly locks: LockManager) {}

	/** Waits for the lock, runs the task, and releases the lock once the task settles. */
	public run<T>(name: string, task: () => Promise<T>): Promise<T> {
		return this.locks.request(name, task);
	}
}

/**
 * Firefox runs content scripts apart from the page, and the page's lock manager isn't allowed to read a promise the
 * content script made (Bugzilla 1873028). So the lock waits on a promise made by the page's own Promise, and the task's
 * result stays in the content script.
 */
export class FirefoxContentScriptLock implements CrossTabLock {
	public constructor(
		private readonly locks: LockManager,
		private readonly pagePromise: PromiseConstructor
	) {}

	/** Waits for the lock, runs the task, and releases the lock once the task settles. */
	public async run<T>(name: string, task: () => Promise<T>): Promise<T> {
		let running: Promise<T> | undefined;
		await this.locks.request(name, () => {
			const { promise: released, resolve: release } = this.pagePromise.withResolvers<void>();
			running = task();
			running.then(
				() => release(),
				() => release()
			);
			return released;
		});
		return running as Promise<T>;
	}
}
