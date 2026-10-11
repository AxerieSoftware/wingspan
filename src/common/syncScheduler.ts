/**
 * Coalesces sync requests into one sync before the browser next paints, so Monarch's changes never show for a frame
 * before Wingspan's. Hidden tabs don't paint, so their syncs wait until the tab is shown. Requests made while detached
 * do nothing.
 */
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

	/** Queues one sync for the next frame, unless one is queued already. */
	public request(): void {
		if (this.isQueued || !this.syncHandler) return;

		this.isQueued = true;
		this.window.requestAnimationFrame(() => {
			this.isQueued = false;
			this.syncHandler?.();
		});
	}
}
