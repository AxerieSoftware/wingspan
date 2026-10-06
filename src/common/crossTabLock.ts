/** A named lock shared across all tabs in this browser. Tasks with the same name run one at a time. */
export interface CrossTabLock {
	run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

export class WebLock implements CrossTabLock {
	public constructor(private readonly locks: LockManager) {}

	/** Waits for the lock, runs the task, and releases the lock once the task settles. */
	public run<T>(name: string, task: () => Promise<T>): Promise<T> {
		return this.locks.request(name, task);
	}
}
