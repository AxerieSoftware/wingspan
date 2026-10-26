import type { MonarchNavigator } from '../monarchNavigator';
import { parseMoney, parseShortDate } from '../monarchText';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const CATEGORY_PATHS = ['/categories', '/category-groups'];
const ROW_SELECTOR = '[data-external-id="summary-card"] [data-external-id="summary-card-row"]';
const AVERAGE_TRANSACTION_LABEL = 'Average transaction';
const TOTAL_SPENDING_LABEL = 'Total spending';
const TOTAL_INCOME_LABEL = 'Total income';
const FIRST_TRANSACTION_LABEL = 'First transaction';
const PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;

export type SummaryPeriod = (typeof PERIODS)[number];

/** The classes of a row in Monarch's Summary card, so Wingspan's row looks the same. */
export interface SummaryRowLook {
	rowClassName: string;
	labelClassName: string;
	valueClassName: string;
	valueTextClassName: string;
}

/** What Monarch's Summary card shows, read from its rows. */
export interface CategorySummary {
	/** The "Total spending" amount, or "Total income" for a category with no spending. */
	total: number;
	/** "YYYY-MM-DD". */
	firstTransactionDate: string;
	look: SummaryRowLook;
}

/*
 * Monarch's page for one category or category group: /categories/:id or /category-groups/:id
 *
 * +- chart: a bar per period; clicking one picks it --+
 * +- Transactions ----------------+ +- Summary ------------------+
 * |                               | | Total transactions     38  |
 * |                               | | Largest transaction    $…  |
 * |                               | | Average transaction    $…  |
 * |                               | | [ render(rowEl) mounts ]   |
 * |                               | | Total spending         $…  |
 * +-------------------------------+ +----------------------------+
 *
 * The Summary covers all time, or the period picked, given in the URL as `date` (its first day) and `timeframe`.
 */
export class CategorySummaryPage {
	private row: MountedSlot | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	public get isActive(): boolean {
		return CATEGORY_PATHS.some(path => this.navigator.isUnder(path));
	}

	/** The picked period, or null when the Summary covers all time. */
	public get period(): { kind: SummaryPeriod; startDate: string } | null {
		const searchParams = new URLSearchParams(this.window.location.search);
		const startDate = searchParams.get('date');
		const kind = PERIODS.find(candidate => candidate === searchParams.get('timeframe'));
		return startDate && kind ? { kind, startDate } : null;
	}

	/** Null while the Summary loads, or for a period with no transactions. */
	public get summary(): CategorySummary | null {
		const rowEls = this.monarchRows();
		// A category with refunds shows both totals; spending is the one an expense category is about.
		const totalRowEl = this.rowLabeled(rowEls, TOTAL_SPENDING_LABEL) ?? this.rowLabeled(rowEls, TOTAL_INCOME_LABEL);
		const total = parseMoney(totalRowEl?.children[1]?.textContent ?? '');
		const firstRowEl = this.rowLabeled(rowEls, FIRST_TRANSACTION_LABEL);
		const firstTransactionDate = parseShortDate(firstRowEl?.children[1]?.textContent ?? '');
		const [labelEl, valueEl] = [totalRowEl?.children[0], totalRowEl?.children[1]];
		const valueTextEl = valueEl?.firstElementChild;
		if (!totalRowEl || total === null || !firstTransactionDate || !labelEl || !valueEl || !valueTextEl) return null;
		return {
			total,
			firstTransactionDate,
			look: { rowClassName: totalRowEl.className, labelClassName: labelEl.className, valueClassName: valueEl.className, valueTextClassName: valueTextEl.className }
		};
	}

	/** Puts Wingspan's row after Monarch's "Average transaction", or removes it while that row isn't there. */
	public showRow(content: SlotContent): void {
		const averageRowEl = this.rowLabeled(this.monarchRows(), AVERAGE_TRANSACTION_LABEL);
		if (!averageRowEl) {
			this.removeRow();
			return;
		}

		this.row ??= MountedSlot.mount(this.window.document, content, WingspanAttribute.categorySummaryRow, { style: 'display: contents;' });
		if (averageRowEl.nextElementSibling !== this.row.hostEl) averageRowEl.after(this.row.hostEl);
	}

	public removeRow(): void {
		this.row?.remove();
		this.row = null;
	}

	private monarchRows(): HTMLElement[] {
		return [...this.window.document.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter(rowEl => !rowEl.closest(`[${WingspanAttribute.categorySummaryRow}]`));
	}

	private rowLabeled(rowEls: HTMLElement[], label: string): HTMLElement | undefined {
		return rowEls.find(rowEl => rowEl.children[0]?.textContent?.trim() === label);
	}
}
