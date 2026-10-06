import { MonarchApiError, SIGNED_OUT_MESSAGE } from '../../monarch/api/monarchApiError';
import type { MonarchSession } from '../../monarch/session/monarchSession';

const OTHER_HOUSEHOLD_MESSAGE = 'A different Monarch household signed in. Reload the page.';
const UNKNOWN_HOUSEHOLD_MESSAGE = "Wingspan can't tell which Monarch household is signed in, so it can't load or save. Reloading the page may help; if not, report a problem from Settings.";

/**
 * Keeps browser storage separate per Monarch household, so data from two households signed in here never mixes. A
 * page belongs to the first household seen on it. If another signs in, nothing is read or saved until a reload.
 */
export class StorageScope {
	private pageHouseholdId: string | null = null;

	public constructor(private readonly session: MonarchSession) {}

	/** The storage key for `name` in the household's own space. Throws when the household is unknown or isn't this page's. */
	public key(name: string): `local:${string}` {
		return `local:${name}:${this.householdId()}`;
	}

	/** Checked between requests to Monarch: a response for another household's session can't be used by this page. */
	public checkSameHousehold(): void {
		if (!this.pageHouseholdId) return;
		// Signed out, or partway through another household signing in, so Monarch wouldn't respond for this page's household.
		const householdId = this.session.householdId();
		if (!householdId) throw new MonarchApiError(SIGNED_OUT_MESSAGE, false);
		if (householdId !== this.pageHouseholdId) throw new MonarchApiError(OTHER_HOUSEHOLD_MESSAGE, false);
	}

	private householdId(): string {
		const householdId = this.session.householdId();
		if (!householdId) throw new MonarchApiError(this.session.hasUser() ? UNKNOWN_HOUSEHOLD_MESSAGE : SIGNED_OUT_MESSAGE, false);
		this.pageHouseholdId ??= householdId;
		if (householdId !== this.pageHouseholdId) throw new MonarchApiError(OTHER_HOUSEHOLD_MESSAGE, false);
		return householdId;
	}
}
