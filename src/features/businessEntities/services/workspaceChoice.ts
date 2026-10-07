/** In Monarch's local storage, not the extension's, so the early script can read it before Monarch's app starts. */
const STORAGE_KEY = 'wingspanWorkspace';

/** What this browser chose for one household. */
export interface SavedWorkspace {
	/** Household's id or a business's; null when nothing was chosen yet. */
	entityId: string | null;
	/** Workspaces are on unless turned off in Wingspan's settings. */
	isEnabled: boolean;
}

interface StoredWorkspace extends SavedWorkspace {
	householdId: string;
}

const NOTHING_SAVED: SavedWorkspace = { entityId: null, isEnabled: true };

/** The workspace this browser last switched to, Household or a business, kept per Monarch household. */
export class WorkspaceChoice {
	public constructor(private readonly storage: Storage) {}

	public read(householdId: string): SavedWorkspace {
		try {
			const saved = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? 'null') as Partial<StoredWorkspace> | null;
			if (saved?.householdId !== householdId) return NOTHING_SAVED;
			return { entityId: typeof saved.entityId === 'string' ? saved.entityId : null, isEnabled: saved.isEnabled !== false };
		} catch {
			return NOTHING_SAVED;
		}
	}

	public write(householdId: string, workspace: SavedWorkspace): void {
		try {
			this.storage.setItem(STORAGE_KEY, JSON.stringify({ householdId, ...workspace } satisfies StoredWorkspace));
		} catch {
			// Monarch keeps its sign-in in the same storage, so it's only unavailable when Monarch can't work either.
		}
	}
}
