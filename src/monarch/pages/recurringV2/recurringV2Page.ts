import { readPersistedField } from '../../persistedState';
import { StyleOverrides } from '../../ui/styleOverrides';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';
import type { RecurringV2AddDialogExtension } from './models/recurringV2AddDialogExtension';
import type { RecurringV2DetailRow } from './models/recurringV2DetailRow';
import type { RecurringV2DueDate, RecurringV2Item } from './models/recurringV2Item';
import type { RecurringV2WingspanRow, RecurringV2WingspanRows } from './models/recurringV2WingspanRow';
import type { RecurringView } from './models/recurringView';
import { RecurringV2AddDialog } from './recurringV2AddDialog';
import { RecurringV2EntityFilter, type RecurringV2Summary } from './recurringV2EntityFilter';
import { RecurringV2LayoutCopier } from './recurringV2LayoutCopier';
import { RecurringV2Row } from './recurringV2Row';
import { RecurringV2Section } from './recurringV2Section';
import { type RecurringV2SectionCard, RecurringV2SectionCards } from './recurringV2SectionCards';
import { MONTH_NAMES, RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';
import { RecurringV2Sidebar } from './recurringV2Sidebar';
import { RecurringV2StatementsCard } from './recurringV2StatementsCard';

const GROUP_BY_STORAGE_KEY = 'persist:recurringV2';
const BY_TYPE = 'type';
const FALLBACK_ROW_CLASS_NAME = 'grid cursor-pointer items-center gap-lg border-t border-t-divider-primary px-default py-sm';
const ALL_VIEW_REFERENCE_MONTH = '2000-01';
const YEAR_PATTERN = /^\d{4}$/;
const ITEM_ID_PATTERN = /^\d+$/;
const ROW_ACTIVATION_KEYS = new Set(['Enter', ' ']);

/*
 * Monarch's Recurring 2.0 page: /recurring-v2/{monthly|all}[/<itemId>]
 *
 * +- list: /recurring-v2/monthly or /all ------------------+  +- detail panel: .../<openItemId> ---+
 * | October 2026  < >                        shownMonth    |  | Type        Expense                |
 * |                                                        |  | Frequency   Monthly                |
 * | Expenses                                               |  | Due day     [ 14th ]   <- Wingspan |
 * | +- RecurringV2Section (sectionEl) -------------------+ |  |                         detail row |
 * | | +- RecurringV2Row (rowEl) -----------------------+ | |  +------------------------------------+
 * | | | Streaming                             name     | | |    showDetailRow / removeDetailRow
 * | | | Monthly . Due Oct 1     subtitle + dueLabel    | | |
 * | | |                   Paid Oct 1     statusDay     | | |
 * | | +------------------------------------------------+ | |
 * | | +- RecurringV2Row -------------------------------+ | |
 * | | | Phone bill ...                                 | | |
 * | | +------------------------------------------------+ | |
 * | | (other children follow the row above them)         | |
 * | +----------------------------------------------------+ |
 * |                                                        |
 * | Income                                                 |
 * | +- RecurringV2Section -------------------------------+ |
 * | | ...                                                | |
 * | +----------------------------------------------------+ |
 * +--------------------------------------------------------+
 *
 * Each Wingspan row goes in the section it names. If Monarch has no such
 * section, a copied section card is added for it. Statements rows go in
 * the Statements card in place of "Coming soon".
 */
export class RecurringV2Page {
	/** Marks the menu in a Wingspan row, so clicks on it don't open the row. */
	public static readonly rowMenuAttribute = WingspanAttribute.rowMenu;

	private readonly rowsByEl = new WeakMap<HTMLElement, RecurringV2Row>();
	private readonly rowOrderStyles = new StyleOverrides();
	private readonly addedSectionStyles = new StyleOverrides();
	private readonly layoutCopier = new RecurringV2LayoutCopier();
	private readonly sectionCards: RecurringV2SectionCards;
	private readonly statementsCard: RecurringV2StatementsCard;
	private readonly addDialog: RecurringV2AddDialog;
	private readonly sidebar: RecurringV2Sidebar;
	private readonly entityFilter: RecurringV2EntityFilter;
	private readonly wingspanRowEls = new Map<string, HTMLElement>();
	private readonly wingspanRowOpeners = new Map<string, () => void>();
	private detailRow: MountedSlot | null = null;

	public constructor(private readonly window: Window) {
		this.sectionCards = new RecurringV2SectionCards(window.document, this.addedSectionStyles);
		this.statementsCard = new RecurringV2StatementsCard(window.document, this.layoutCopier);
		this.addDialog = new RecurringV2AddDialog(window.document);
		this.sidebar = new RecurringV2Sidebar(window.document);
		this.entityFilter = new RecurringV2EntityFilter(window.document);
	}

	/** The all view sorts by day of the month like Monarch does, so every date is mapped into one reference month. */
	public static allViewSortDate(dayOfMonth: number): string {
		return `${ALL_VIEW_REFERENCE_MONTH}-${String(dayOfMonth).padStart(2, '0')}`;
	}

	/** Which list the path shows, or null when it isn't one of the Recurring 2.0 lists. */
	public get view(): RecurringView | null {
		const [, rootSegment, viewSegment] = this.window.location.pathname.split('/');
		if (rootSegment !== 'recurring-v2') return null;
		if (viewSegment === 'monthly' || viewSegment === undefined || viewSegment === '') return 'month';
		return viewSegment === 'all' ? 'all' : null;
	}

	/** The month in the list's title as YYYY-MM, or null when it can't be read. */
	public get shownMonth(): string | null {
		const titleText = this.window.document.querySelector(SELECTORS.monthTitle)?.textContent?.trim() ?? '';
		const [monthName, year] = titleText.split(' ');
		const monthIndex = MONTH_NAMES.findIndex(name => monthName?.startsWith(name));
		if (monthIndex < 0 || !YEAR_PATTERN.test(year ?? '')) return null;

		return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
	}

	public isShowingMonth(month: string): boolean {
		return this.view === 'month' && this.monthInView(month) === month;
	}

	/** Null in the month view while the title can't be read, since guessing the current month could show one month's amounts on another month's page. */
	public monthInView(currentMonth: string): string | null {
		return this.view === 'month' ? this.shownMonth : currentMonth;
	}

	/** The item whose detail panel the path opens, or null. */
	public get openItemId(): string | null {
		const itemId = this.window.location.pathname.split('/')[3];
		return itemId && ITEM_ID_PATTERN.test(itemId) ? itemId : null;
	}

	/** How Monarch groups the list, as saved in its local storage; by type when unset. */
	public get groupBy(): string {
		const groupBy = readPersistedField(this.window.localStorage, GROUP_BY_STORAGE_KEY, 'groupBy');
		return typeof groupBy === 'string' ? groupBy : BY_TYPE;
	}

	/** The section columns' headings between the name and the menu, Monarch's defaults when there's no header. */
	public get columnLabels(): string[] {
		return this.sectionCards.columnLabels(this.sectionCards.findMonarchCards());
	}

	/** The class of a Monarch row's menu button, for Wingspan's rows to match. */
	public get rowMenuClassName(): string | undefined {
		const sampleRowEl = this.sectionCards.sampleMonarchRowEl(this.sectionCards.findMonarchCards());
		return sampleRowEl?.querySelector(SELECTORS.rowMenuButton)?.getAttribute('class') ?? undefined;
	}

	public get monarchItems(): RecurringV2Item[] {
		return this.sections.flatMap(section => section.rows).filter(row => !row.isWingspanRow);
	}

	/** Adds due labels to Monarch's rows and sorts every section by date, using Wingspan's own dates for its rows. */
	public showDueDates(dueDateFor: (item: RecurringV2Item) => RecurringV2DueDate | null): void {
		for (const section of this.sections) {
			const datesByRow = new Map<RecurringV2Row, string | null>();
			for (const row of section.rows) {
				if (row.isWingspanRow) {
					datesByRow.set(row, row.wingspanRowDate);
					continue;
				}

				const dueDate = dueDateFor(row);
				row.dueLabel = dueDate?.label ?? '';
				datesByRow.set(row, dueDate?.date ?? null);
			}

			section.orderRows(
				row => datesByRow.get(row) ?? null,
				this.rowOrderStyles,
				rowEl => this.entityFilter.hides(rowEl)
			);
		}
	}

	/** Removes the due labels and restores Monarch's row order. */
	public removeDueDates(): void {
		for (const row of this.sections.flatMap(section => section.rows)) row.dueLabel = '';
		this.rowOrderStyles.restore();
	}

	/**
	 * Hides Monarch's rows that don't match, and any sections left empty, so counts only include visible rows. Inactive
	 * items are counted by type, so their footer is only adjusted when the list is grouped by type.
	 */
	public filterMonarchItems(isShown: (item: RecurringV2Item) => boolean, hiddenInactiveCount: (kind: string) => number): void {
		const sections = this.sectionCards.findMonarchCards().map(card => ({ card, rows: new RecurringV2Section(card.rowsEl, rowEl => this.rowFor(rowEl)).rows }));
		this.entityFilter.showOnly(sections, isShown, this.groupBy === BY_TYPE ? hiddenInactiveCount : () => 0);
	}

	/** Shows Wingspan's Expenses and Income lines in place of Monarch's in the month summary. */
	public showOwnSummary(summary: RecurringV2Summary): void {
		this.entityFilter.showSummary(summary);
	}

	public removeOwnSummary(): void {
		this.entityFilter.removeSummary();
	}

	/** Restores every row, count and summary line to how Monarch shows them. */
	public removeEntityFilter(): void {
		this.entityFilter.remove();
	}

	/** Adds a Wingspan row at the end of the open detail panel's meta rows, styled like Monarch's. */
	public showDetailRow(detailRow: RecurringV2DetailRow): void {
		const monarchMetaRowEl = this.window.document.querySelector(SELECTORS.detailPanel)?.querySelector<HTMLElement>(SELECTORS.detailMetaRow);
		const metaRowsEl = monarchMetaRowEl?.parentElement;
		if (!monarchMetaRowEl || !metaRowsEl) {
			this.removeDetailRow();
			return;
		}

		// A new detail panel means a different item, so the row is recreated.
		if (!this.detailRow?.hostEl.isConnected) {
			this.removeDetailRow();
			this.detailRow = MountedSlot.mount(this.window.document, detailRow, WingspanAttribute.detailRow, { className: monarchMetaRowEl.className });
		}

		if (this.detailRow.hostEl !== metaRowsEl.lastElementChild) metaRowsEl.append(this.detailRow.hostEl);
	}

	public removeDetailRow(): void {
		this.detailRow?.remove();
		this.detailRow = null;
	}

	/** Puts Wingspan's rows in their sections or the Statements card, adding any sections Monarch doesn't have; returns the row elements by key. */
	public showWingspanRows(wingspanRows: RecurringV2WingspanRows): ReadonlyMap<string, HTMLElement> {
		const monarchCards = this.sectionCards.findMonarchCards();
		const sampleRowEl = this.sectionCards.sampleMonarchRowEl(monarchCards);
		this.removeRowsNotIn(new Set(wingspanRows.rows.map(row => row.key)));

		const usesStatements = this.groupBy === BY_TYPE && this.statementsCard.isShowingComingSoon;
		const addedSectionNames = new Set<string>();
		const statementsRows: { rowEl: HTMLElement; sortDate: string }[] = [];
		for (const row of wingspanRows.rows) {
			const rowEl = this.wingspanRowEl(row, sampleRowEl);
			if (row.inStatements && usesStatements) {
				statementsRows.push({ rowEl, sortDate: row.sortDate });
				continue;
			}

			// Once Monarch has the section itself, such as an Overdue section it adds later, remove the one Wingspan added.
			if (!monarchCards.some(card => card.name === row.sectionName)) addedSectionNames.add(row.sectionName);
			const sectionRowsEl = this.sectionCards.rowsElFor(row.sectionName, monarchCards);
			if (sectionRowsEl && rowEl.parentElement !== sectionRowsEl) sectionRowsEl.append(rowEl);
		}

		this.sectionCards.keepOnly(addedSectionNames);
		this.sectionCards.fitAddedCards(this.layoutModel(monarchCards), this.layoutCopier);
		if (usesStatements) this.showStatements(statementsRows, wingspanRows, monarchCards);
		else this.statementsCard.remove();
		return this.wingspanRowEls;
	}

	/** The row with this key, or else the item's first row on the page if it shows more than once. */
	public wingspanRowElFor(itemId: string, rowKey?: string): HTMLElement | undefined {
		const keyedRowEl = rowKey ? this.wingspanRowEls.get(rowKey) : undefined;
		if (keyedRowEl?.isConnected) return keyedRowEl;
		for (const [key, rowEl] of this.wingspanRowEls) if (key.startsWith(`${itemId}@`) && rowEl.isConnected) return rowEl;
		return undefined;
	}

	/**
	 * Where focus moves after the item's row is removed: the next visible focusable row in its table, or the previous one.
	 * Rows are sorted by date with CSS `order`, so that order is used instead of DOM order.
	 */
	public neighborRowElFor(itemId: string): HTMLElement | undefined {
		const rowEl = this.wingspanRowElFor(itemId);
		const siblingEls = [...(rowEl?.parentElement?.children ?? [])].filter((childEl): childEl is HTMLElement => childEl instanceof HTMLElement);
		const orderOf = (siblingEl: HTMLElement) => Number(siblingEl.style.getPropertyValue('order')) || 0;
		const shownOrder = siblingEls.map((siblingEl, index) => ({ siblingEl, index })).toSorted((first, second) => orderOf(first.siblingEl) - orderOf(second.siblingEl) || first.index - second.index);
		const position = shownOrder.findIndex(({ siblingEl }) => siblingEl === rowEl);
		if (position < 0) return undefined;

		const isFocusableRow = (candidateEl: HTMLElement) =>
			!candidateEl.getAttribute(RecurringV2Row.ownRowAttribute)?.startsWith(`${itemId}@`) && candidateEl.matches('[tabindex], a[href], button') && candidateEl.getClientRects().length > 0;
		const after = shownOrder.slice(position + 1).find(({ siblingEl }) => isFocusableRow(siblingEl));
		const before = shownOrder.slice(0, position).findLast(({ siblingEl }) => isFocusableRow(siblingEl));
		return (after ?? before)?.siblingEl;
	}

	/** Removes Wingspan's rows, the sections it added and its Statements content. */
	public removeWingspanRows(): void {
		this.removeRowsNotIn(new Set());
		this.sectionCards.removeAll();
		this.statementsCard.remove();
		this.addedSectionStyles.restore();
	}

	/** Adds Wingspan's parts to Monarch's Add recurring dialog while it's open. */
	public extendAddDialog(extension: RecurringV2AddDialogExtension): void {
		this.addDialog.extend(extension);
	}

	public removeAddDialogExtension(): void {
		this.addDialog.remove();
	}

	/** Shows a Wingspan item's detail in the sidebar, over Monarch's summary. */
	public showWingspanDetail(detailContent: SlotContent): void {
		this.sidebar.showPanel(detailContent);
	}

	public isInWingspanDetail(targetEl: Element): boolean {
		return this.sidebar.contains(targetEl);
	}

	public removeWingspanDetail(): void {
		this.sidebar.removePanel();
	}

	public closeMonarchDetail(): void {
		this.sidebar.closeMonarchDetail();
	}

	/** Shows Wingspan's content on the summary's Statements line in place of "Coming soon". */
	public showSummaryStatements(summaryContent: SlotContent): void {
		this.sidebar.showSummaryStatements(summaryContent);
	}

	public removeSummaryStatements(): void {
		this.sidebar.removeSummaryStatements();
	}

	private showStatements(
		statementsRows: { rowEl: HTMLElement; sortDate: string }[],
		{ statementsFooterText, statementsEmptyText }: RecurringV2WingspanRows,
		monarchCards: RecurringV2SectionCard[]
	): void {
		if (!statementsRows.length && !statementsEmptyText) {
			this.statementsCard.remove();
			return;
		}

		const rowEls = statementsRows.sort((first, second) => first.sortDate.localeCompare(second.sortDate)).map(statementsRow => statementsRow.rowEl);
		const columnLabels = this.sectionCards.columnLabels(monarchCards);
		this.statementsCard.show({ columnLabels, rowEls, footerText: rowEls.length ? statementsFooterText : null, emptyText: statementsEmptyText ?? '' }, this.layoutModel(monarchCards) ?? null);
	}

	/** The card whose column layout Wingspan's cards copy. It must be one the business filter hasn't hidden, since Monarch still lays those out. */
	private layoutModel(monarchCards: RecurringV2SectionCard[]): RecurringV2SectionCard | undefined {
		return monarchCards.find(card => !this.entityFilter.hides(card.cardEl)) ?? monarchCards[0];
	}

	private removeRowsNotIn(wantedKeys: Set<string>): void {
		for (const [key, rowEl] of this.wingspanRowEls) {
			if (wantedKeys.has(key)) continue;
			rowEl.remove();
			this.wingspanRowEls.delete(key);
			this.wingspanRowOpeners.delete(key);
		}
	}

	private wingspanRowEl(row: RecurringV2WingspanRow, sampleRowEl: HTMLElement | null): HTMLElement {
		let rowEl = this.wingspanRowEls.get(row.key);
		if (!rowEl) {
			rowEl = this.createWingspanRowEl(row.key);
			this.wingspanRowEls.set(row.key, rowEl);
		}

		this.wingspanRowOpeners.set(row.key, row.onOpen);
		this.setAttributeIfChanged(rowEl, RecurringV2Row.ownRowDateAttribute, row.sortDate);
		this.setAttributeIfChanged(rowEl, 'aria-label', row.label);
		this.setAttributeIfChanged(rowEl, 'data-selected', String(row.selected));

		if (sampleRowEl) this.layoutCopier.copy(sampleRowEl, rowEl, true);
		else if (rowEl.className !== FALLBACK_ROW_CLASS_NAME) rowEl.className = FALLBACK_ROW_CLASS_NAME;
		return rowEl;
	}

	private createWingspanRowEl(key: string): HTMLElement {
		const rowEl = this.window.document.createElement('div');
		rowEl.setAttribute(RecurringV2Row.ownRowAttribute, key);
		rowEl.setAttribute('role', 'button');
		rowEl.setAttribute('tabindex', '0');

		const open = () => this.wingspanRowOpeners.get(key)?.();
		rowEl.addEventListener('click', event => {
			if (!(event.target as Element).closest(`[${RecurringV2Page.rowMenuAttribute}]`)) open();
		});
		rowEl.addEventListener('keydown', event => {
			if (!ROW_ACTIVATION_KEYS.has(event.key) || event.target !== rowEl) return;
			event.preventDefault();
			open();
		});

		return rowEl;
	}

	private setAttributeIfChanged(targetEl: HTMLElement, attributeName: string, value: string): void {
		if (targetEl.getAttribute(attributeName) !== value) targetEl.setAttribute(attributeName, value);
	}

	private get sections(): RecurringV2Section[] {
		const sectionEls = [...this.window.document.querySelectorAll<HTMLElement>(SELECTORS.sectionRows)];
		return sectionEls.map(sectionEl => new RecurringV2Section(sectionEl, rowEl => this.rowFor(rowEl)));
	}

	private rowFor(rowEl: HTMLElement): RecurringV2Row {
		let row = this.rowsByEl.get(rowEl);
		if (!row) {
			row = new RecurringV2Row(rowEl);
			this.rowsByEl.set(rowEl, row);
		}

		return row;
	}
}
