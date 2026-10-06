import { install as installTemporal } from 'temporal-polyfill/shim';

// Safari ships neither Temporal nor DisposableStack yet. Only the Safari build includes these; every other build will drop this as dead code.
if (import.meta.env.SAFARI) {
	installTemporal();
	(Symbol as { dispose?: symbol }).dispose ??= Symbol.for('Symbol.dispose');
	(globalThis as { DisposableStack?: unknown }).DisposableStack ??= class DisposableStack {
		#callbacks: (() => void)[] = [];
		#isDisposed = false;

		public get disposed(): boolean {
			return this.#isDisposed;
		}

		public defer(onDispose: () => void): void {
			this.#callbacks.push(onDispose);
		}

		public use<T extends Disposable | null | undefined>(value: T): T {
			if (value) this.#callbacks.push(() => value[Symbol.dispose]());
			return value;
		}

		public adopt<T>(value: T, onDispose: (value: T) => void): T {
			this.#callbacks.push(() => onDispose(value));
			return value;
		}

		public move(): DisposableStack {
			const moved = new DisposableStack();
			moved.#callbacks = this.#callbacks;
			this.#callbacks = [];
			this.#isDisposed = true;
			return moved;
		}

		public dispose(): void {
			if (this.#isDisposed) return;
			this.#isDisposed = true;
			const errors: unknown[] = [];
			for (const callback of this.#callbacks.reverse()) {
				try {
					callback();
				} catch (error) {
					errors.push(error);
				}
			}
			this.#callbacks = [];
			if (errors.length) throw errors.length === 1 ? errors[0] : new AggregateError(errors);
		}

		public [Symbol.dispose](): void {
			this.dispose();
		}
	};
}
