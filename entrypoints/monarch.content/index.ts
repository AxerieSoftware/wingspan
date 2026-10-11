import '@/src/common/safariPolyfills';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { addAccounts } from '@/src/features/accounts/addAccounts';
import { addBusinessEntities } from '@/src/features/businessEntities/addBusinessEntities';
import { addCashSettings } from '@/src/features/cashFlow/cashSettings/addCashSettings';
import { addFreeCash } from '@/src/features/cashFlow/freeCash/addFreeCash';
import { addProjectedBalances } from '@/src/features/cashFlow/projectedBalances/addProjectedBalances';
import { addRecurringPages } from '@/src/features/recurring/addRecurringPages';
import { createRecurring } from '@/src/features/recurring/createRecurring';
import { addRetailSync } from '@/src/features/retailSync/addRetailSync';
import { addSettings } from '@/src/features/settings/addSettings';
import { addSidebar } from '@/src/features/sidebar/addSidebar';
import { WingspanBuilder } from '@/src/wingspanBuilder';

export default defineContentScript({
	matches: ['https://app.monarch.com/*'],

	main(context: ContentScriptContext) {
		const builder = new WingspanBuilder(window);
		const recurring = createRecurring(builder);
		// Features sync in the order they're added. Workspaces go first so the other features use the chosen workspace.
		const businessFilter = addBusinessEntities(builder, recurring);
		const hiddenSidebarItems = addSidebar(builder);
		addSettings(builder, businessFilter, hiddenSidebarItems);
		addRetailSync(builder);
		const cashSettings = addCashSettings(builder, businessFilter);
		const projectedBalances = addProjectedBalances(builder, recurring, cashSettings, businessFilter);
		addRecurringPages(builder, recurring, cashSettings, projectedBalances, businessFilter);
		addFreeCash(builder, recurring, cashSettings, projectedBalances);
		addAccounts(builder);

		const wingspan = builder.build();
		wingspan.start();
		context.addEventListener(window, 'wxt:locationchange', wingspan.sync);
		context.onInvalidated(() => wingspan.suspend());
	}
});
