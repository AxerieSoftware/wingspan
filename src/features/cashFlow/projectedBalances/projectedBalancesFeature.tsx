import { effect, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import type { Calendar } from '../../../common/calendar';
import { logError } from '../../../common/log';
import type { MonarchDataService } from '../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { GoalContribution } from '../../../monarch/api/models/goalContribution';
import type { MonarchBudgetClient } from '../../../monarch/api/monarchBudgetClient';
import type { CashFlowPage, CashFlowTimeframe } from '../../../monarch/pages/cashFlow/cashFlowPage';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import type { CashSettingsLauncher } from '../cashSettings/services/cashSettingsLauncher';
import type { FreeCashSplitter } from '../freeCash/services/freeCashSplitter';
import { ProjectedBalancesCard } from './components/projectedBalancesCard';
import { REVERSIBLE_WINDOW_MONTHS } from './models/projectionHorizon';
import type { ProjectedBalancesService } from './services/projectedBalancesService';

const GOALS_QUERY = 'monarchGoalContributions';
/** After goals fail to load, how long to wait before a page change retries. */
const GOALS_RETRY_MS = 60_000;

/** Projected balances on Monarch's Cash Flow page, under its bar chart. */
export class ProjectedBalancesFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly goalContributions = signal<GoalContribution[]>([]);
	private readonly timeframe = signal<CashFlowTimeframe>('month');
	private sectionIsland: Island | null = null;
	private goalsMonth: string | null = null;
	private goalsRetryAt = 0;

	public constructor(
		private readonly page: CashFlowPage,
		private readonly monarchData: MonarchDataService,
		private readonly dataService: WingspanDataService,
		private readonly projectedBalances: ProjectedBalancesService,
		private readonly budgetClient: MonarchBudgetClient,
		private readonly queryClient: QueryClient,
		private readonly cashSettingsLauncher: CashSettingsLauncher,
		private readonly freeCashSplitter: FreeCashSplitter,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.projectedBalances.state.value, this.goalContributions.value, this.timeframe.value];
				this.renderSection();
			})
		);
	}

	/** On Cash Flow, shows the section and loads Monarch's data plus goal contributions for the months the free cash window covers. On other pages, removes it. */
	public sync(): void {
		if (!this.page.isActive) {
			this.goalsMonth = null;
			this.page.removeSection();
			return;
		}

		this.timeframe.value = this.page.timeframe;
		void this.monarchData.load();
		// Load goals once per visit and month, since sync runs on every page change.
		if (this.goalsMonth !== this.calendar.currentMonth() && Date.now() >= this.goalsRetryAt) void this.loadGoals();
		this.page.showSection({ render: sectionEl => this.mountSection(sectionEl) });
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeSection();
	}

	private async loadGoals(): Promise<void> {
		const month = this.calendar.currentMonth();
		this.goalsMonth = month;
		const lastMonth = this.calendar.addMonths(month, REVERSIBLE_WINDOW_MONTHS - 1);
		try {
			this.goalContributions.value = await this.queryClient.query({ queryKey: [GOALS_QUERY, month], queryFn: () => this.budgetClient.getGoalContributions(month, lastMonth) });
		} catch (error) {
			logError(error);
			this.goalsMonth = null;
			this.goalsRetryAt = Date.now() + GOALS_RETRY_MS;
		}
	}

	private mountSection(sectionEl: HTMLElement): () => void {
		this.sectionIsland = new Island(sectionEl);
		this.renderSection();
		return () => {
			this.sectionIsland?.unmount();
			this.sectionIsland = null;
		};
	}

	private renderSection(): void {
		if (!this.sectionIsland) return;
		const state = this.projectedBalances.state.peek();
		const isReady = state.status === 'ready';
		const retry = () => {
			this.monarchData.forgetFailure();
			void this.monarchData.load();
			void this.dataService.load();
			this.goalsRetryAt = 0;
			if (this.goalsMonth === null) void this.loadGoals();
		};
		const unavailableMessage =
			state.status !== 'unavailable'
				? null
				: state.missing === 'monarch'
					? "Couldn't load from Monarch, so there's nothing to project."
					: "Couldn't load Wingspan's saved items and settings, so there's nothing to project.";
		const projection = isReady ? state.projection : null;
		// Monarch's goals belong to the household, so they only come out of free cash when the household's accounts are included.
		const isHouseholdShown = !isReady || state.includesHousehold;
		this.sectionIsland.render(
			<ProjectedBalancesCard
				projection={projection}
				split={projection && isHouseholdShown ? this.freeCashSplitter.split(projection.freeCash, this.goalContributions.peek(), projection.reversible.endDate) : null}
				hasCheckingAccounts={!isReady || state.checkingAccountIds.length > 0}
				timeframe={this.timeframe.peek()}
				formatter={this.formatter}
				onEdit={() => isReady && this.cashSettingsLauncher.open(state.accounts)}
				onOpenGoals={() => this.page.openGoals()}
				unavailable={unavailableMessage ? { message: unavailableMessage, onRetry: retry } : undefined}
				stale={isReady && state.staleAsOf !== null ? { message: `Couldn't refresh from Monarch, so this is as of ${this.formatter.asOf(state.staleAsOf)}.`, onRetry: retry } : undefined}
			/>
		);
	}
}
