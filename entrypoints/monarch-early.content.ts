import { WorkspaceChoice } from '@/src/features/businessEntities/services/workspaceChoice';
import { WorkspaceNavigation } from '@/src/features/businessEntities/services/workspaceNavigation';
import { HiddenSidebarItems } from '@/src/features/sidebar/hiddenItems/services/hiddenSidebarItems';
import { SidebarPage } from '@/src/monarch/pages/sidebar/sidebarPage';
import { MonarchSession } from '@/src/monarch/session/monarchSession';

/** Runs before Monarch's app: some pages only read their business filter as they first render, and hidden sidebar items shouldn't flash in. */
export default defineContentScript({
	matches: ['https://app.monarch.com/*'],
	runAt: 'document_start',
	// WXT's start-up window message, sent this early, made Wingspan's dialogs lose their focus trap on Monarch's pages.
	noScriptStartedPostMessage: true,

	main() {
		new SidebarPage(document).hideItems(HiddenSidebarItems.read(window.localStorage));

		const householdId = new MonarchSession(window).householdId();
		const savedWorkspace = householdId ? new WorkspaceChoice(window.localStorage).read(householdId) : null;
		if (savedWorkspace?.isEnabled && savedWorkspace.entityId) WorkspaceNavigation.applyBeforeMonarchStarts(window, savedWorkspace.entityId);
	}
});
