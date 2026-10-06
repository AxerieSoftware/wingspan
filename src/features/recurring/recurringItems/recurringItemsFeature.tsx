import { effect } from '@preact/signals-core';
import type { SyncScheduler } from '../../../common/syncScheduler';
import type { BalancesByAccountId } from '../../../data/models/balancesByAccountId';
import type { MonarchDataService } from '../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { RecurringV2AddDialogExtension } from '../../../monarch/pages/recurringV2/models/recurringV2AddDialogExtension';
import type { RecurringV2WingspanRow } from '../../../monarch/pages/recurringV2/models/recurringV2WingspanRow';
import type { RecurringView } from '../../../monarch/pages/recurringV2/models/recurringView';
import type { RecurringV2Page } from '../../../monarch/pages/recurringV2/recurringV2Page';
import { WingspanAttribute } from '../../../monarch/pages/wingspanAttributes';
import { ConfirmPrompt } from '../../../monarch/ui/components/confirmDialog';
import { Island } from '../../../monarch/ui/components/island';
import { Layer } from '../../../monarch/ui/components/layer';
import type { MenuItem } from '../../../monarch/ui/components/menu';
import { PortalContainerContext } from '../../../monarch/ui/portalContainer';
import type { BusinessFilter } from '../../businessEntities/models/businessFilter';
import type { WingspanFeature } from '../../wingspanFeature';
import type { CardPaymentPlans } from '../statements/models/cardPaymentPlans';
import { AddRecurringChoice } from './components/addRecurringChoice';
import { ItemDetails } from './components/itemDetails';
import { ItemEditor } from './components/itemEditor';
import { RecurringRows, type RowEntry } from './components/recurringRowCells';
import type { DefaultPayingAccount } from './models/defaultPayingAccount';
import type { RecurringItem } from './models/recurringItem';
import type { RecurringLine } from './models/recurringLine';
import type { RecurringRowsData } from './models/recurringRowsData';
import type { RecurringItemServices } from './services/recurringItemServices';

const OTHER_SECTION = 'Other';

interface RowsBuild {
	key: string;
	placements: RecurringV2WingspanRow[];
	statementsFooterText: string | null;
	statementsEmptyText: string | null;
	entriesFor(rowEls: ReadonlyMap<string, HTMLElement>): RowEntry[];
}

/** Wingspan's own items on Recurring: their rows, details panel and editor, and the Type choice in Add recurring. */
export class RecurringItemsFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly confirmPrompt: ConfirmPrompt;
	private rowsHostEl: HTMLElement | null = null;
	private rowsIsland: Island | null = null;
	private rowsBuild: RowsBuild | null = null;
	private hasDataChanged = true;
	private openItemId: string | null = null;
	private openRowKey: string | null = null;
	private detailIsland: Island | null = null;
	private lastMonarchItemId: string | null = null;
	private openLayer: Layer | null = null;

	public constructor(
		private readonly window: Window,
		private readonly page: RecurringV2Page,
		private readonly monarchData: MonarchDataService,
		private readonly dataService: WingspanDataService,
		private readonly syncScheduler: SyncScheduler,
		private readonly rowsData: RecurringRowsData,
		private readonly defaultPayingAccount: DefaultPayingAccount,
		private readonly cardPaymentPlans: CardPaymentPlans,
		private readonly businessFilter: BusinessFilter,
		private readonly services: RecurringItemServices
	) {
		this.confirmPrompt = new ConfirmPrompt(window.document);
	}

	/** Rebuilds the rows when items, Monarch's data, card plans or the business filter change. Escape closes the details. */
	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void this.rowsData.ledgerService.ledger.value;
				void this.monarchData.state.value;
				void this.dataService.data.value;
				void this.cardPaymentPlans.byItemId.value;
				void this.businessFilter.view.scope.value;
				this.hasDataChanged = true;
				this.syncScheduler.request();
			})
		);

		this.window.document.addEventListener('keydown', this.closeDetailOnEscape, true);
		this.subscriptions.defer(() => this.window.document.removeEventListener('keydown', this.closeDetailOnEscape, true));
	}

	/** Shows the rows for the month in view, rebuilt only when data or the page's view changed. */
	public sync(): void {
		const view = this.page.view;
		if (!view) {
			this.clear();
			return;
		}

		void this.monarchData.load();
		this.page.extendAddDialog(this.addDialogExtension);
		this.closeDetailIfMonarchOpened();

		const month = this.page.monthInView(this.services.calendar.currentMonth());
		// Do nothing until the page shows which month it's on, e.g. while Monarch is re-rendering.
		if (!month) return;
		const isLoading = this.monarchData.state.value.status === 'loading';
		const columnLabels = this.page.columnLabels;
		const buildKey = [view, month, isLoading, this.page.groupBy, this.openItemId, columnLabels.join('|')].join('/');
		const isRebuilt = this.hasDataChanged || this.rowsBuild?.key !== buildKey;
		if (isRebuilt || !this.rowsBuild) {
			this.hasDataChanged = false;
			this.rowsBuild = this.buildRows(buildKey, view, month, isLoading, columnLabels);
		}

		const rowEls = this.page.showWingspanRows({ rows: this.rowsBuild.placements, statementsFooterText: this.rowsBuild.statementsFooterText, statementsEmptyText: this.rowsBuild.statementsEmptyText });
		if (isRebuilt) this.ensureRowsIsland().render(<RecurringRows entries={this.rowsBuild.entriesFor(rowEls)} />);

		if (this.openItemId) {
			this.page.showWingspanDetail({ render: panelEl => this.mountDetail(panelEl) });
			if (isRebuilt) this.renderDetail();
		}
	}

	/** Removes the detail panel, which covers Monarch's summary, and the add dialog's fields, which replace Monarch's. */
	public suspend(): void {
		this.openItemId = null;
		this.page.removeWingspanDetail();
		this.page.removeAddDialogExtension();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.openLayer?.close();
		this.clear();
		this.page.removeAddDialogExtension();
		this.rowsIsland?.unmount();
		this.rowsHostEl?.remove();
		this.rowsIsland = null;
		this.rowsHostEl = null;
	}

	private clear(): void {
		this.closeDetail();
		this.rowsIsland?.render(null);
		this.page.removeWingspanRows();
		this.rowsBuild = null;
	}

	private buildRows(key: string, view: RecurringView, month: string, isLoading: boolean, columnLabels: string[]): RowsBuild {
		const { kinds, payments, formatter, recurrence } = this.services;
		const ledger = this.rowsData.ledgerService.ledger.value;
		const snapshot = this.monarchData.snapshot.value;
		const accounts = snapshot?.accounts ?? [];
		const accountNames = new Map(accounts.map(account => [account.id, account.displayName]));
		const defaultPayingAccountName = accountNames.get(this.defaultPayingAccount.accountId(accounts) ?? '') ?? '';
		const paidFromName = (item: RecurringItem) => (item.matchRule?.accountId ? (accountNames.get(item.matchRule.accountId) ?? '') : defaultPayingAccountName);
		// Without Monarch's transactions no payments can be found, so carried-over months aren't shown until they load.
		const isPaymentDataMissing = !snapshot;
		// Only show items in the current business filter scope, like Monarch's own rows. That depends on Monarch's accounts:
		// while they load no items show, and if they fail to load all items show, matching Monarch's rows.
		const scope = this.businessFilter.view.scope.value;
		const isWaitingForAccounts = !snapshot && isLoading && !scope.isEverything;
		const within = snapshot ? this.businessFilter.membership.within(scope, accounts) : null;
		const isShown = (item: RecurringItem) => !isWaitingForAccounts && (!within || within.includesItem(item));
		const builtLines = this.rowsData.lineBuilder
			.linesFor(view, month, this.rowsData.itemRepository.data.value, ledger, snapshot?.owedByAccountId ?? {}, !isPaymentDataMissing)
			.filter(line => isShown(line.item));
		const menuClassName = this.page.rowMenuClassName;
		const plansByItemId = this.cardPaymentPlans.byItemId.value;
		const owedByAccountId = snapshot?.owedByAccountId ?? {};
		const linesWithAmounts = builtLines.map(line => (kinds.of(line.item).isAmountUnknown?.(line.item, owedByAccountId) ? { ...line, amountUnknown: true } : line));
		const lines = this.rowsData.statementLines.reconcile({ lines: linesWithAmounts, view, month, plansByItemId, owedByAccountId });
		const earliestOverdueKeys = new Set(
			[
				...Map.groupBy(
					lines.filter(line => line.overdue && !line.paid),
					line => line.item.id
				).values()
			].map(itemLines => itemLines.reduce((earliest, line) => (line.dueDate < earliest.dueDate ? line : earliest)).key)
		);
		// An overdue line's payment is planned for today and shown only on the item's earliest overdue line.
		const plannedPaymentFor = (line: RecurringLine) => {
			if (view !== 'month' || line.paid || (line.overdue && !earliestOverdueKeys.has(line.key))) return undefined;
			return this.rowsData.statementLines.planFor(line.dueDate, plansByItemId.get(line.item.id) ?? []);
		};
		const groupBy = this.page.groupBy;

		const sectionNameFor = (line: RecurringLine): string => {
			switch (groupBy) {
				case 'type':
					return kinds.of(line.item).typeSectionName;
				case 'status':
					return line.paid ? 'Paid' : line.overdue ? 'Overdue' : 'Upcoming';
				case 'frequency':
					return recurrence.describe(recurrence.fromRecurrence(line.item.recurrence));
				case 'account':
					return paidFromName(line.item) || OTHER_SECTION;
				default:
					return OTHER_SECTION;
			}
		};

		const statementsLines = lines.filter(line => kinds.of(line.item).showsInStatements);
		const owedInStatements = this.unpaidTotal(statementsLines, snapshot?.owedByAccountId ?? {});
		const monarch = this.monarchData.state.value;
		const isStale = monarch.status === 'ready' && monarch.isStale;
		const footerText = this.owedText(owedInStatements);
		const isThisMonth = view === 'month' && month === this.services.calendar.currentMonth();
		const paidInStatements = statementsLines.flatMap(line => line.occurrences).reduce((total, occurrence) => total + (occurrence.paid ? occurrence.amount : 0), 0);
		this.rowsData.statementsTotals.publish(isThisMonth && !isPaymentDataMissing ? { paid: paidInStatements, left: owedInStatements.total, unknownCount: owedInStatements.unknownCount } : null);
		const statementsFooterText = view === 'all' || isPaymentDataMissing ? null : isStale ? `${footerText}, as of ${formatter.asOf(snapshot.fetchedAt)}` : footerText;

		const hasCardPayments = this.rowsData.itemRepository.data.value.recurringItems.some(item => kinds.of(item).showsInStatements && isShown(item));
		const statementsEmptyText =
			!this.dataService.isLoaded.value || isWaitingForAccounts
				? null
				: hasCardPayments
					? `No card payments ${view === 'all' ? 'yet' : month === this.services.calendar.currentMonth() ? 'due this month' : `due in ${formatter.longMonthYear(`${month}-01`)}`}.`
					: 'No card payments yet. Add one with Add recurring.';

		return {
			key,
			statementsFooterText,
			statementsEmptyText,
			placements: lines.map(line => ({
				key: line.key,
				label: line.item.name,
				sortDate: line.dueDate,
				sectionName: sectionNameFor(line),
				inStatements: kinds.of(line.item).showsInStatements,
				selected: line.item.id === this.openItemId,
				onOpen: () => this.openDetail(line.item.id, line.key)
			})),
			entriesFor: rowEls =>
				lines.flatMap((line): RowEntry[] => {
					const rowEl = rowEls.get(line.key);
					if (!rowEl) return [];

					const linkedAccountId = kinds.of(line.item).linkedAccountId(line.item);
					const accountName = linkedAccountId === undefined ? paidFromName(line.item) : (accountNames.get(linkedAccountId) ?? '');
					const points = this.rowsData.statementLines.reconcileHistory(line.item, ledger.historiesByItemId.get(line.item.id) ?? [], plansByItemId.get(line.item.id));
					const history = payments.monthlyHistory(points, payments.trackingFloor(line.item, this.rowsData.itemRepository.data.value));
					const cellsProps = {
						line,
						view,
						columnLabels,
						history,
						accountName,
						menuItems: this.menuItemsFor(line.item),
						menuClassName,
						isLoading,
						plannedPayment: plannedPaymentFor(line),
						couldNotCheckPayments: isPaymentDataMissing && !isLoading,
						services: this.services
					};
					return [{ rowEl, cellsProps }];
				})
		};
	}

	/**
	 * Total still owed: every unpaid occurrence, except a card linked to its Monarch account counts its balance once no
	 * matter how many statements are unpaid. Occurrences with an unknown amount are counted separately, never as $0.
	 */
	private unpaidTotal(lines: RecurringLine[], owedByAccountId: BalancesByAccountId): { total: number; unknownCount: number } {
		const linkedBalances = new Map<string, number>();
		let total = 0;
		const unknownItemIds = new Set<string>();
		for (const occurrence of lines.flatMap(line => line.occurrences).filter(each => !each.paid)) {
			const itemKind = this.services.kinds.of(occurrence.item);
			const accountId = itemKind.linkedAccountId(occurrence.item);
			if (itemKind.isAmountUnknown?.(occurrence.item, owedByAccountId)) unknownItemIds.add(occurrence.item.id);
			else if (accountId === undefined) total += occurrence.amount;
			else linkedBalances.set(accountId, occurrence.amount);
		}
		return { total: total + [...linkedBalances.values()].reduce((sum, balance) => sum + balance, 0), unknownCount: unknownItemIds.size };
	}

	private owedText({ total, unknownCount }: { total: number; unknownCount: number }): string {
		const owed = total ? `${this.services.formatter.money(total)} owed` : null;
		if (!unknownCount) return owed ?? 'All paid';
		const unknown = `${unknownCount} ${unknownCount === 1 ? 'amount' : 'amounts'} unknown`;
		return owed ? `${owed}, plus ${unknown}` : `Unpaid, ${unknown}`;
	}

	private ensureRowsIsland(): Island {
		if (this.rowsIsland) return this.rowsIsland;

		// One React root renders every row's cells through portals into the rows the page placed.
		this.rowsHostEl = this.window.document.createElement('div');
		this.rowsHostEl.hidden = true;
		this.rowsHostEl.setAttribute(WingspanAttribute.rowsHost, '');
		this.window.document.body.append(this.rowsHostEl);
		this.rowsIsland = new Island(this.rowsHostEl);
		return this.rowsIsland;
	}

	private menuItemsFor(item: RecurringItem): MenuItem[] {
		const confirmation = this.services.factory.removalConfirmation(item);
		return [
			{ label: 'Edit', onClick: () => void this.openEditor(item) },
			{ label: 'Remove', danger: true, onClick: () => (this.openLayer = this.confirmPrompt.ask(confirmation, () => this.removeItem(item.id))) }
		];
	}

	/** Moves focus to a neighboring row, since the removed row and its menu no longer exist. */
	private async removeItem(itemId: string): Promise<void> {
		const neighborRowEl = this.page.neighborRowElFor(itemId);
		await this.rowsData.itemRepository.remove(itemId);
		neighborRowEl?.focus();
	}

	private async openEditor(item: RecurringItem): Promise<void> {
		const accounts = await this.monarchData.getAccounts();
		this.openLayer = new Layer(this.window.document, close => (
			<ItemEditor item={item} accounts={accounts} services={this.services} monarchData={this.monarchData} itemRepository={this.rowsData.itemRepository} onClose={close} />
		));
	}

	/** `rowKey` is the row the panel was opened from, so focus can return to it. An item can appear on more than one row. */
	private openDetail(itemId: string, rowKey?: string): void {
		this.openRowKey = rowKey ?? null;
		this.page.closeMonarchDetail();
		this.lastMonarchItemId = this.page.openItemId;
		this.openItemId = itemId;
		this.syncScheduler.request();
	}

	private mountDetail(panelEl: HTMLElement): () => void {
		this.detailIsland = new Island(panelEl);
		this.renderDetail();
		return () => {
			this.detailIsland?.unmount();
			this.detailIsland = null;
		};
	}

	private renderDetail(): void {
		const item = this.openItemId ? this.rowsData.itemRepository.find(this.openItemId) : undefined;
		if (!item) {
			this.closeDetail();
			return;
		}

		const snapshot = this.monarchData.snapshot.value;
		this.detailIsland?.render(
			<ItemDetails
				item={item}
				historyPoints={this.rowsData.statementLines.reconcileHistory(
					item,
					this.rowsData.ledgerService.ledger.value.historiesByItemId.get(item.id) ?? [],
					this.cardPaymentPlans.byItemId.value.get(item.id)
				)}
				trackingSince={this.services.payments.trackingFloor(item, this.rowsData.itemRepository.data.value)}
				accountNames={new Map((snapshot?.accounts ?? []).map(account => [account.id, account.displayName]))}
				owedByAccountId={snapshot?.owedByAccountId ?? {}}
				isLoading={this.monarchData.state.value.status === 'loading'}
				couldNotCheckPayments={this.monarchData.state.value.status === 'failed'}
				menuItems={this.menuItemsFor(item)}
				services={this.services}
				onSave={savedItem => void this.rowsData.itemRepository.save(savedItem)}
				onClose={() => this.closeDetail()}
			/>
		);
	}

	/** If focus is inside the panel, moves it back to the item's row. */
	private closeDetail(): void {
		const itemId = this.openItemId;
		if (!itemId) return;
		const activeEl = this.window.document.activeElement;
		const hadFocus = !activeEl || activeEl === this.window.document.body || !activeEl.isConnected || this.page.isInWingspanDetail(activeEl);
		this.openItemId = null;
		this.page.removeWingspanDetail();
		this.syncScheduler.request();
		if (!hadFocus) return;
		(this.page.wingspanRowElFor(itemId, this.openRowKey ?? undefined) ?? this.page.neighborRowElFor(itemId))?.focus();
	}

	private closeDetailIfMonarchOpened(): void {
		const monarchItemId = this.page.openItemId;
		if (this.openItemId && monarchItemId && monarchItemId !== this.lastMonarchItemId) this.closeDetail();
		this.lastMonarchItemId = monarchItemId;
	}

	// Uses the capture phase so this runs before an open menu or dialog closes itself on Escape.
	private readonly closeDetailOnEscape = (event: KeyboardEvent): void => {
		if (event.key !== 'Escape' || !this.openItemId || Layer.isPopupOpen(this.window.document)) return;
		// Let fields handle Escape themselves, e.g. to clear a search.
		const target = event.target;
		if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
		this.closeDetail();
	};

	private readonly addDialogExtension: RecurringV2AddDialogExtension = {
		render: slots => {
			const choiceIsland = new Island(slots.choiceEl);
			choiceIsland.render(
				<PortalContainerContext value={slots.dialogEl}>
					<AddRecurringChoice slots={slots} services={this.services} monarchData={this.monarchData} itemRepository={this.rowsData.itemRepository} />
				</PortalContainerContext>
			);
			return () => choiceIsland.unmount();
		}
	};
}
