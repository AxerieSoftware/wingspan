import '@/src/common/polyfills';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { addAccounts } from '@/src/features/accounts/addAccounts';
import { addBudget } from '@/src/features/budget/addBudget';
import { addBusinessEntities } from '@/src/features/businessEntities/addBusinessEntities';
import { addCashSettings } from '@/src/features/cashFlow/cashSettings/addCashSettings';
import { addFreeCash } from '@/src/features/cashFlow/freeCash/addFreeCash';
import { addMonthEnd } from '@/src/features/cashFlow/monthEnd/addMonthEnd';
import { addProjectedBalances } from '@/src/features/cashFlow/projectedBalances/addProjectedBalances';
import { addCategories } from '@/src/features/categories/addCategories';
import { addGoals } from '@/src/features/goals/addGoals';
import { addInterestCost } from '@/src/features/interestCost/addInterestCost';
import { createManualLoans } from '@/src/features/interestCost/createManualLoans';
import { addLoansPaidDown } from '@/src/features/loansPaidDown/addLoansPaidDown';
import { addRecurringPages } from '@/src/features/recurring/addRecurringPages';
import { createRecurring } from '@/src/features/recurring/createRecurring';
import { addRetailSync } from '@/src/features/retailSync/addRetailSync';
import { addSettings } from '@/src/features/settings/addSettings';
import { addSidebar } from '@/src/features/sidebar/addSidebar';
import { createSummaryScreens } from '@/src/features/summaryScreens/createSummaryScreens';
import { addTransactions } from '@/src/features/transactions/addTransactions';
import { WingspanBuilder } from '@/src/wingspanBuilder';

export default defineContentScript({
	matches: ['https://app.monarch.com/*'],

	main(context: ContentScriptContext) {
		const builder = new WingspanBuilder(window);
		const recurring = createRecurring(builder);
		// Features sync in the order they're added. Workspaces go first so the other features use the chosen workspace.
		const businessFilter = addBusinessEntities(builder, recurring);
		const hiddenSidebarItems = addSidebar(builder, businessFilter);
		addSettings(builder, businessFilter, hiddenSidebarItems);
		addRetailSync(builder);
		const cashSettings = addCashSettings(builder, businessFilter);
		const projectedBalances = addProjectedBalances(builder, recurring, cashSettings, businessFilter);
		addMonthEnd(builder, projectedBalances);
		addGoals(builder, projectedBalances);
		const summaryScreens = createSummaryScreens(builder, businessFilter);
		const manualLoans = createManualLoans(builder);
		addLoansPaidDown(builder, summaryScreens, manualLoans);
		addInterestCost(builder, summaryScreens, businessFilter, manualLoans);
		addRecurringPages(builder, recurring, cashSettings, projectedBalances, businessFilter);
		addFreeCash(builder, recurring, cashSettings, projectedBalances);
		addAccounts(builder);
		addBudget(builder);
		addCategories(builder);
		addTransactions(builder);

		const wingspan = builder.build();
		wingspan.start();
		context.addEventListener(window, 'wxt:locationchange', wingspan.sync);
		context.onInvalidated(() => wingspan.suspend());
	}
});
