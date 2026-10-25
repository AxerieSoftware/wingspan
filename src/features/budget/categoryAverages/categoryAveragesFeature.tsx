import type { SyncedQueries } from '../../../common/syncedQueries';
import type { MonarchBudgetClient } from '../../../monarch/api/monarchBudgetClient';
import type { BudgetPage } from '../../../monarch/pages/budget/budgetPage';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import { CategoryAveragesRows } from './components/categoryAveragesRows';
import type { CategoryAveragesCalculator } from './services/categoryAveragesCalculator';

const TOTALS_QUERY = 'monarchCategoryMonthTotals';

/** 3-month, 12-month and year-to-date averages in the History popover of a category's budget amount. */
export class CategoryAveragesFeature implements WingspanFeature {
	private island: Island | null = null;
	/** What the row last rendered, as JSON, so a sync that changes nothing doesn't render again. */
	private renderedPropsJson: string | null = null;

	public constructor(
		private readonly page: BudgetPage,
		private readonly budgetClient: MonarchBudgetClient,
		private readonly calculator: CategoryAveragesCalculator,
		private readonly syncedQueries: SyncedQueries,
		private readonly formatter: Formatter
	) {}

	/** Nothing to subscribe to: the totals query requests a sync when it loads. */
	public start(): void {}

	/** While a category's History popover is open, shows the averages. The dates move with the month, so each month loads its own totals. They're left out if loading fails. */
	public sync(): void {
		const history = this.page.isActive ? this.page.openCategoryHistory : null;
		const { startDate, endDate } = this.calculator.dates();
		const totals = history ? this.syncedQueries.read([TOTALS_QUERY, startDate, endDate], () => this.budgetClient.getCategoryMonthTotals(startDate, endDate)) : null;
		if (!history || !totals || totals.status === 'failed') {
			this.page.removeAverages();
			return;
		}

		this.page.showAverages({ render: hostElement => this.mount(hostElement) });
		const averages = totals.status === 'ready' ? this.calculator.averages(history.categoryId, totals.data) : null;
		const propsJson = JSON.stringify([history.look, averages]);
		if (!this.island || propsJson === this.renderedPropsJson) return;
		this.renderedPropsJson = propsJson;
		this.island.render(<CategoryAveragesRows look={history.look} averages={averages} isIncome={history.isIncome} formatter={this.formatter} onPick={amount => this.page.enterBudgetAmount(amount)} />);
	}

	public [Symbol.dispose](): void {
		this.page.removeAverages();
	}

	private mount(hostElement: HTMLElement): () => void {
		this.island = new Island(hostElement);
		this.renderedPropsJson = null;
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}
}
