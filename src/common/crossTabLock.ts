/** A named lock shared across all tabs in this browser. Tasks with the same name run one at a time. */
export interface CrossTabLock {
	run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

/** Firefox gives content scripts the page's own objects through `wrappedJSObject`. Other browsers don't have it. */
interface FirefoxContentWindow extends Window {
	wrappedJSObject?: { Promise: PromiseConstructor };
}

/** Firefox's content-script global that makes a function callable by the page. */
declare function exportFunction<F extends (...args: never[]) => unknown>(callback: F, target: object): F;

/** Makes a content-script function one the page can call and read the result of. */
type ExportToPage = <F extends (...args: never[]) => unknown>(callback: F) => F;

/**
 * The lock for a content script on this window's page. Orion runs Firefox builds and gives them `wrappedJSObject` but not
 * `exportFunction`; it doesn't keep content scripts apart from the page, so the plain lock works there.
 */
export function createCrossTabLock(window: Window): CrossTabLock {
	// Read rather than checked with `in`: Firefox's wrapper provides it without reporting it as a property.
	const pageWindow = (window as FirefoxContentWindow).wrappedJSObject;
	return pageWindow && typeof exportFunction === 'function'
		? new FirefoxContentScriptLock(window.navigator.locks, pageWindow.Promise, callback => exportFunction(callback, pageWindow))
		: new WebLock(window.navigator.locks);
}

class WebLock implements CrossTabLock {
	public constructor(private readonly locks: LockManager) {}

	/** Waits for the lock, runs the task, and releases the lock once the task settles. */
	public run<T>(name: string, task: () => Promise<T>): Promise<T> {
		return this.locks.request(name, task);
	}
}

/**
 * Firefox runs content scripts apart from the page, and the page's lock manager calls the lock's callback from the page,
 * which can't read what a content-script function returns (Bugzilla 1873028). So the callback is exported to the page
 * and returns a promise made by the page's own Promise, and the task's result stays in the content script.
 */
export class FirefoxContentScriptLock implements CrossTabLock {
	public constructor(
		private readonly locks: LockManager,
		private readonly pagePromise: PromiseConstructor,
		private readonly exportToPage: ExportToPage
	) {}

	/** Waits for the lock, runs the task, and releases the lock once the task settles. */
	public async run<T>(name: string, task: () => Promise<T>): Promise<T> {
		let running: Promise<T> | undefined;
		await this.locks.request(
			name,
			this.exportToPage(() => {
				const { promise: released, resolve: release } = this.pagePromise.withResolvers<void>();
				running = task();
				running.then(
					() => release(),
					() => release()
				);
				return released;
			})
		);
		return running as Promise<T>;
	}
}
