import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const SAVE_UP_PATH = '/goals/savings';
const SECTIONS_SELECTOR = '[data-external-id="goals-table-sections"]';
const CARD_SELECTOR = ':scope > [data-mds="card"]';

/*
 * Monarch's Goals page, Save up tab: /goals/savings
 *
 * +- sections --------------------+ +- side ---------------+
 * | Save up goals card            | | Available for goals  |
 * | [ render(sectionEl) mounts ]  | +----------------------+
 * | disclaimer                    |
 * +-------------------------------+
 *
 * Wingspan's section goes under Monarch's goals card. Pay down has Monarch's own payoff timeline, so it gets nothing.
 */
export class GoalsPage {
	private section: MountedSlot | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	/** Save up itself, not a single goal's page under it. */
	public get isActive(): boolean {
		return this.navigator.path === SAVE_UP_PATH;
	}

	/** Puts Wingspan's section under Monarch's goals card, or removes it while that card isn't there. */
	public showSection(content: SlotContent): void {
		const cardEl = this.window.document.querySelector(SECTIONS_SELECTOR)?.querySelector<HTMLElement>(CARD_SELECTOR);
		if (!cardEl) {
			this.removeSection();
			return;
		}

		this.section ??= MountedSlot.mount(this.window.document, content, WingspanAttribute.goalPlanner);
		if (cardEl.nextElementSibling !== this.section.hostEl) cardEl.after(this.section.hostEl);
	}

	public removeSection(): void {
		this.section?.remove();
		this.section = null;
	}
}
