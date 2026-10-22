import { describe, expect, it } from 'vitest';
import { FirefoxContentScriptLock } from './crossTabLock';

/** Stands in for promises made by the page, which Firefox's lock manager can read. */
class PagePromise<T> extends Promise<T> {}

/** Runs one request at a time and, like Firefox's, refuses a callback's promise the page didn't make. */
class PageLockManager {
	public readonly events: string[] = [];
	private queue: Promise<unknown> = Promise.resolve();

	public request(name: string, callback: () => unknown): Promise<unknown> {
		const held = this.queue.then(async () => {
			this.events.push(`acquire ${name}`);
			const released = callback();
			if (!(released instanceof PagePromise)) throw new Error('Permission denied to access property "then"');
			await released;
			this.events.push(`release ${name}`);
		});
		this.queue = held.catch(() => undefined);
		return held;
	}
}

const createLock = (locks: PageLockManager) => new FirefoxContentScriptLock(locks as unknown as LockManager, PagePromise);

describe("Firefox's content-script lock", () => {
	it("hands the page a promise it can read and returns the task's result", async () => {
		const locks = new PageLockManager();
		await expect(createLock(locks).run('data', async () => 42)).resolves.toBe(42);
		expect(locks.events).toEqual(['acquire data', 'release data']);
	});

	it('holds the lock until the task settles, so tasks never overlap', async () => {
		const locks = new PageLockManager();
		const lock = createLock(locks);
		let finishFirst = () => {};
		const first = lock.run('data', () => new Promise<void>(resolve => (finishFirst = resolve)).then(() => locks.events.push('first done')));
		const second = lock.run('data', async () => locks.events.push('second ran'));
		await Promise.resolve();
		finishFirst();
		await Promise.all([first, second]);
		expect(locks.events).toEqual(['acquire data', 'first done', 'release data', 'acquire data', 'second ran', 'release data']);
	});

	it("passes on the task's error and still releases the lock", async () => {
		const locks = new PageLockManager();
		const lock = createLock(locks);
		await expect(
			lock.run('data', async () => {
				throw new Error('save failed');
			})
		).rejects.toThrow('save failed');
		await expect(lock.run('data', async () => 'next')).resolves.toBe('next');
	});
});
