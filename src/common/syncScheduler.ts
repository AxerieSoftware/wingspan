/** Coalesces sync requests into one sync on the next task; requests made while detached do nothing. */
export class SyncScheduler {
	private syncHandler: (() => void) | null = null;
	private isQueued = false;

	public constructor(private readonly window: Window) {}

	/** Sets the sync callback. Until then, requests do nothing. */
	public attach(syncHandler: () => void): void {
		this.syncHandler = syncHandler;
	}

	/** Stops syncs, including one already queued. */
	public detach(): void {
		this.syncHandler = null;
	}

	/** Queues one sync for the next task, unless one is queued already. */
	public request(): void {
		if (this.isQueued || !this.syncHandler) return;

		this.isQueued = true;
		this.window.setTimeout(() => {
			this.isQueued = false;
			this.syncHandler?.();
		}, 0);
	}
}
