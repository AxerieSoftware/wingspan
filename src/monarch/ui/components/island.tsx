import { type ReactNode, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { logError } from '../../../common/log';

const FALLBACK = <span className="text-sm font-book text-content-secondary">Wingspan couldn't show this. Reload the page to try again.</span>;

/** A React root for part of Monarch's page. If a part fails to render, it shows an error and retries on the next render. */
export class Island {
	private readonly root: Root;

	public constructor(hostEl: Element) {
		// The error boundary already logs errors; letting React log them too would duplicate every one.
		this.root = createRoot(hostEl, { onCaughtError: () => {} });
	}

	/** Replaces what the island shows. Content that failed to render is retried when it changes. */
	public render(content: ReactNode): void {
		this.root.render(
			<StrictMode>
				<ErrorBoundary fallback={FALLBACK} resetKeys={[content]} onError={error => logError(error)}>
					{content}
				</ErrorBoundary>
			</StrictMode>
		);
	}

	/** Removes the React root, leaving the host element in place. */
	public unmount(): void {
		this.root.unmount();
	}
}
