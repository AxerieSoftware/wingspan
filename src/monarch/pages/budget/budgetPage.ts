import type { MonarchNavigator } from '../monarchNavigator';
import { parseMonthYear } from '../monarchText';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const BUDGET_PATH = '/plan';
const HISTORY_POPOVER_SELECTOR = '[data-external-id="budget-amount-popover"]';
const HISTORY_CHIP_SELECTOR = '[data-external-id="gray-round-container"]';
/** Both halves of a budget row, the names and the amounts, carry the id of what the row budgets. */
const ROW_ID_ATTRIBUTE = 'data-goal-row-id';
const CATEGORY_LINK_PREFIX = '/categories/';
const LOADED_VALUE_CLASS = 'fs-mask';
const EARNED_LABEL_PREFIX = 'Earned';
const HEADER_SELECTOR = '[data-external-id="header"]';
const ROW_TITLE_SELECTOR = '[data-external-id="plan-row-title"]';
/** The names column holds one block per group: its header row, then a drawer with its category rows. */
const DRAWER_SELECTOR = '[data-external-id="deprecated-drawer"]';
const CATEGORY_NAME_ROW_SELECTOR = '[data-external-id="plan-group-left-row"]';

/** The classes of Monarch's History chips, so Wingspan's look the same in every theme. */
export interface HistoryChipLook {
	rowClassName: string;
	chipClassName: string;
	valueClassName: string;
	labelClassName: string;
}

/** A row on the Budget page and the categories it covers: a category's row covers itself, a group's header row every category in it. */
export interface BudgetRow {
	key: string;
	categoryIds: string[];
	/** The row's name, which a note goes under. */
	titleEl: HTMLElement;
}

/** The History popover open on a category's budget amount. */
export interface CategoryHistory {
	categoryId: string;
	/** Monarch says "Earned last month" for an income category, where an expense category says "Spent". */
	isIncome: boolean;
	look: HistoryChipLook;
}

/*
 * Monarch's Budget page: /plan. Focusing a category's budget amount opens its History popover.
 *
 * +- History popover -----------------------------------+
 * | History                                             |
 * | [$174 Spent last month]  [$122 Monthly average]     |
 * | +- Wingspan's averages ---------------------------+ |
 * | | [ render(averagesEl) mounts here ]              | |
 * | +-------------------------------------------------+ |
 * | bars for the last six months                        |
 * | [x] Apply $140 to all future months                 |
 * +-----------------------------------------------------+
 */
export class BudgetPage {
	private averages: MountedSlot | null = null;
	private readonly rowNotes = new Map<string, MountedSlot>();

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	public get isActive(): boolean {
		return this.navigator.isUnder(BUDGET_PATH);
	}

	/** The month shown, as "YYYY-MM", from the header's "October 2026". Null in Year view or while loading. */
	public get month(): string | null {
		const headingEls = this.window.document.querySelector(HEADER_SELECTOR)?.querySelectorAll('*') ?? [];
		for (const headingEl of headingEls) {
			const month = headingEl.childElementCount ? null : parseMonthYear(headingEl.textContent ?? '');
			if (month) return month;
		}
		return null;
	}

	/** The category rows and group header rows in the names column. Goals and other rows that aren't categories are left out. */
	public get rows(): BudgetRow[] {
		const nameRowEls = [...this.window.document.querySelectorAll<HTMLElement>(CATEGORY_NAME_ROW_SELECTOR)];
		const categoryIdOf = (rowEl: Element) => (rowEl.querySelector(`a[href^="${CATEGORY_LINK_PREFIX}"]`) ? rowEl.getAttribute(ROW_ID_ATTRIBUTE) : null);
		const categoryRows = nameRowEls.flatMap(rowEl => {
			const categoryId = categoryIdOf(rowEl);
			const titleEl = rowEl.querySelector<HTMLElement>(ROW_TITLE_SELECTOR);
			return categoryId && titleEl ? [{ key: `category:${categoryId}`, categoryIds: [categoryId], titleEl }] : [];
		});
		// Only the names column's drawers hold name rows; the amounts column has drawers of its own.
		const groupRows = [...this.window.document.querySelectorAll<HTMLElement>(DRAWER_SELECTOR)].flatMap((drawerEl, index) => {
			const titleEl = this.groupHeaderTitle(drawerEl);
			const categoryIds = [...drawerEl.querySelectorAll(CATEGORY_NAME_ROW_SELECTOR)].flatMap(rowEl => categoryIdOf(rowEl) ?? []);
			return titleEl && categoryIds.length ? [{ key: `group:${index}`, categoryIds, titleEl }] : [];
		});
		return [...groupRows, ...categoryRows];
	}

	/** Null when no History popover is open, or it's for a group or goal rather than a category. */
	public get openCategoryHistory(): CategoryHistory | null {
		const chipEl = this.monarchChips()[0];
		// Until History loads, the amount is a placeholder with classes of its own; the loaded amount is masked from recordings.
		const valueEl = chipEl?.querySelector(`:scope > .${LOADED_VALUE_CLASS}`);
		const labelEl = chipEl?.lastElementChild;
		const rowEl = chipEl?.parentElement;
		const categoryId = this.focusedCategoryId();
		if (!chipEl || !valueEl || !labelEl || !rowEl || !categoryId) return null;
		const isIncome = labelEl.textContent?.trim().startsWith(EARNED_LABEL_PREFIX) ?? false;
		return { categoryId, isIncome, look: { rowClassName: rowEl.className, chipClassName: chipEl.className, valueClassName: valueEl.className, labelClassName: labelEl.className } };
	}

	/** Puts each note under its row's name, and removes the notes of rows not given. */
	public showRowNotes(notes: readonly { row: BudgetRow; content: SlotContent }[]): void {
		const keys = new Set(notes.map(({ row }) => row.key));
		for (const [key, slot] of this.rowNotes) {
			if (keys.has(key)) continue;
			slot.remove();
			this.rowNotes.delete(key);
		}
		for (const { row, content } of notes) {
			const { key, titleEl } = row;
			let slot = this.rowNotes.get(key);
			if (!slot) {
				slot = MountedSlot.mount(this.window.document, content, WingspanAttribute.budgetRowNote, { tagName: 'span' });
				this.rowNotes.set(key, slot);
			}
			// A category's name sits in a column meant for a line under it; a group's name has the title to itself.
			const lineEl = titleEl.querySelector('.flex-col');
			if (!lineEl) slot.hostEl.style.marginLeft = 'var(--spacing-xs)';
			if (slot.hostEl.parentElement !== (lineEl ?? titleEl)) (lineEl ?? titleEl).append(slot.hostEl);
		}
	}

	public removeRowNotes(): void {
		this.showRowNotes([]);
	}

	/** Puts Wingspan's averages under Monarch's chips, or removes them while no popover is open. */
	public showAverages(content: SlotContent): void {
		const chipRowEl = this.monarchChips()[0]?.parentElement;
		if (!chipRowEl) {
			this.removeAverages();
			return;
		}

		// Its rows join Monarch's, so they're spaced like them.
		this.averages ??= MountedSlot.mount(this.window.document, content, WingspanAttribute.budgetAverages, { style: 'display: contents;' });
		if (chipRowEl.nextElementSibling !== this.averages.hostEl) chipRowEl.after(this.averages.hostEl);
	}

	public removeAverages(): void {
		this.averages?.remove();
		this.averages = null;
	}

	/**
	 * Types the amount into the focused budget amount, as clicking one of Monarch's chips does. Monarch saves it when
	 * the field loses focus or Enter is pressed.
	 */
	public enterBudgetAmount(amount: number): void {
		const inputEl = this.window.document.activeElement;
		if (!(inputEl instanceof HTMLInputElement)) return;
		// React tracks the value it last set, so the change only registers when made through the input's own setter.
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(inputEl, String(amount));
		inputEl.dispatchEvent(new Event('input', { bubbles: true }));
	}

	/** A group's header row is the nearest earlier sibling of its drawer with a row name. */
	private groupHeaderTitle(drawerEl: HTMLElement): HTMLElement | null {
		let headerEl = drawerEl.previousElementSibling;
		while (headerEl && !headerEl.querySelector(ROW_TITLE_SELECTOR)) headerEl = headerEl.previousElementSibling;
		return headerEl?.querySelector<HTMLElement>(ROW_TITLE_SELECTOR) ?? null;
	}

	private monarchChips(): HTMLElement[] {
		const popoverEl = this.window.document.querySelector(HISTORY_POPOVER_SELECTOR);
		return [...(popoverEl?.querySelectorAll<HTMLElement>(HISTORY_CHIP_SELECTOR) ?? [])].filter(chipEl => !chipEl.closest(`[${WingspanAttribute.budgetAverages}]`));
	}

	/** The popover belongs to the budget amount that has focus. Its row's name links to the category, or to a group. */
	private focusedCategoryId(): string | null {
		const rowId = this.window.document.activeElement?.closest(`[${ROW_ID_ATTRIBUTE}]`)?.getAttribute(ROW_ID_ATTRIBUTE);
		if (!rowId) return null;
		const nameLinkEl = this.window.document.querySelector(`[${ROW_ID_ATTRIBUTE}="${rowId}"] a[href^="${CATEGORY_LINK_PREFIX}"]`);
		return nameLinkEl ? rowId : null;
	}
}
