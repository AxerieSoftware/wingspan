import { parsePersistedField } from '../persistedState';

const SESSION_STORAGE_KEY = 'persist:root';

/** Who is signed in to Monarch, as Monarch keeps it for its own pages. */
export class MonarchSession {
	// Read on every sync and request, so it's cached and only reparsed when Monarch changes it.
	private lastSession: { raw: string | null; user: unknown } | null = null;

	public constructor(private readonly window: Window) {}

	/** The signed-in household's id; null when signed out or when Monarch's saved session can't be read. */
	public householdId(): string | null {
		try {
			const user = this.user();
			const household = user && typeof user === 'object' && 'household' in user ? user.household : null;
			const id = household && typeof household === 'object' && 'id' in household ? household.id : null;
			return typeof id === 'string' && id !== '' ? id : null;
		} catch {
			return null;
		}
	}

	/** True when someone is signed in, even if their household id can't be read, since Monarch may have changed how it stores it. */
	public hasUser(): boolean {
		try {
			return !!this.user();
		} catch {
			return false;
		}
	}

	private user(): unknown {
		const raw = this.window.localStorage.getItem(SESSION_STORAGE_KEY);
		if (this.lastSession?.raw !== raw) this.lastSession = { raw, user: parsePersistedField(raw, 'user') ?? null };
		return this.lastSession.user;
	}
}
