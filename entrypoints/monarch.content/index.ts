import '@/src/common/safariPolyfills';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { addBusinessEntities } from '@/src/features/businessEntities/addBusinessEntities';
import { addCashSettings } from '@/src/features/cashFlow/cashSettings/addCashSettings';
import { addFreeCash } from '@/src/features/cashFlow/freeCash/addFreeCash';
import { addProjectedBalances } from '@/src/features/cashFlow/projectedBalances/addProjectedBalances';
import { addRecurringPages } from '@/src/features/recurring/addRecurringPages';
import { createRecurring } from '@/src/features/recurring/createRecurring';
import { addRetailSync } from '@/src/features/retailSync/addRetailSync';
import { addSettings } from '@/src/features/settings/addSettings';
import { WingspanBuilder } from '@/src/wingspanBuilder';

export default defineContentScript({
	matches: ['https://app.monarch.com/*'],

	main(context: ContentScriptContext) {
		const builder = new WingspanBuilder(window);
		const recurring = createRecurring(builder);
		// Features sync in the order they're added. Workspaces go first so the other features use the chosen workspace.
		const businessFilter = addBusinessEntities(builder, recurring);
		addSettings(builder, businessFilter);
		addRetailSync(builder);
		const cashSettings = addCashSettings(builder, businessFilter);
		const projectedBalances = addProjectedBalances(builder, recurring, cashSettings, businessFilter);
		addRecurringPages(builder, recurring, cashSettings, projectedBalances, businessFilter);
		addFreeCash(builder, recurring, cashSettings, projectedBalances);

		const wingspan = builder.build();
		wingspan.start();
		context.addEventListener(window, 'wxt:locationchange', wingspan.sync);
		context.onInvalidated(() => wingspan.suspend());
	}
});
