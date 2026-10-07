import { WorkspaceChoice } from '@/src/features/businessEntities/services/workspaceChoice';
import { WorkspaceNavigation } from '@/src/features/businessEntities/services/workspaceNavigation';
import { MonarchSession } from '@/src/monarch/session/monarchSession';

/** Opens Monarch's pages filtered to the chosen workspace. It runs before Monarch's app, since some pages only read their filter as they first render. */
export default defineContentScript({
	matches: ['https://app.monarch.com/*'],
	runAt: 'document_start',
	// WXT's start-up window message, sent this early, made Wingspan's dialogs lose their focus trap on Monarch's pages.
	noScriptStartedPostMessage: true,

	main() {
		const householdId = new MonarchSession(window).householdId();
		const saved = householdId ? new WorkspaceChoice(window.localStorage).read(householdId) : null;
		if (saved?.isEnabled && saved.entityId) WorkspaceNavigation.applyBeforeMonarchStarts(window, saved.entityId);
	}
});
