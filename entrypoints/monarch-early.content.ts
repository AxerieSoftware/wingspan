import { WorkspaceChoice } from '@/src/features/businessEntities/services/workspaceChoice';
import { WorkspaceNavigation } from '@/src/features/businessEntities/services/workspaceNavigation';
import { HiddenSidebarItems } from '@/src/features/sidebar/hiddenItems/services/hiddenSidebarItems';
import { SidebarPage } from '@/src/monarch/pages/sidebar/sidebarPage';
import { MonarchSession } from '@/src/monarch/session/monarchSession';
import { StartupTheme } from '@/src/monarch/ui/startupTheme';

/** Runs before Monarch's app: some pages only read their business filter as they first render, and neither hidden sidebar items nor a light loading screen should flash in. */
export default defineContentScript({
	matches: ['https://app.monarch.com/*'],
	runAt: 'document_start',
	// WXT's start-up window message, sent this early, made Wingspan's dialogs lose their focus trap on Monarch's pages.
	noScriptStartedPostMessage: true,

	main() {
		const session = new MonarchSession(window);
		new StartupTheme(window, session).apply();
		new SidebarPage(document).hideItems(HiddenSidebarItems.read(window.localStorage));

		const householdId = session.householdId();
		const savedWorkspace = householdId ? new WorkspaceChoice(window.localStorage).read(householdId) : null;
		if (savedWorkspace?.isEnabled && savedWorkspace.entityId) WorkspaceNavigation.applyBeforeMonarchStarts(window, savedWorkspace.entityId);
	}
});
