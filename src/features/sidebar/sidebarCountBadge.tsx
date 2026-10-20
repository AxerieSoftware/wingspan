import type { SidebarPage } from '../../monarch/pages/sidebar/sidebarPage';
import { Badge } from '../../monarch/ui/components/badge';
import { Island } from '../../monarch/ui/components/island';

/** A count at the end of a sidebar link, like Monarch's beside Recurring. Hidden at 0. */
export class SidebarCountBadge {
	private island: Island | null = null;
	private renderedCount = 0;

	public constructor(
		private readonly sidebar: SidebarPage,
		private readonly path: string
	) {}

	/** `label` is what screen readers say, like "3 transactions to review". */
	public show(count: number, label: string): void {
		if (count === 0) {
			this.remove();
			return;
		}

		this.sidebar.showLinkBadge(this.path, { render: badgeEl => this.mount(badgeEl) });
		if (count === this.renderedCount) return;

		this.renderedCount = count;
		this.island?.render(
			<Badge tone="count" label={label}>
				{count}
			</Badge>
		);
	}

	public remove(): void {
		this.sidebar.removeLinkBadge(this.path);
	}

	private mount(badgeEl: HTMLElement): () => void {
		this.island = new Island(badgeEl);
		this.renderedCount = 0;
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}
}
