import type { ReactNode } from 'react';
import type { RecurringV2DetailRow } from '../../../../monarch/pages/recurringV2/models/recurringV2DetailRow';
import { Island } from '../../../../monarch/ui/components/island';
import { MetaRowContent } from '../../../../monarch/ui/components/metaRow';
import { WingspanMark } from '../../../wingspanMark';

/** One of Wingspan's rows in a Monarch item's panel: a label, a control and the Wingspan mark, like Monarch's own rows. */
export abstract class WingspanPanelRow<TProps> implements RecurringV2DetailRow {
	private rowIsland: Island | null = null;
	private props: TProps | null = null;
	private renderedKey = '';

	protected constructor(private readonly label: string) {}

	/** Rerenders only when the key of the props changed. */
	public update(props: TProps): void {
		this.props = props;
		this.renderContent();
	}

	public render(detailRowEl: HTMLElement): () => void {
		this.rowIsland = new Island(detailRowEl);
		this.renderedKey = '';
		this.renderContent();
		return () => {
			this.rowIsland?.unmount();
			this.rowIsland = null;
		};
	}

	/** Changes whenever the control would show something different. */
	protected abstract keyOf(props: TProps): string;

	protected abstract control(props: TProps): ReactNode;

	private renderContent(): void {
		if (!this.rowIsland || !this.props) return;

		const renderKey = this.keyOf(this.props);
		if (this.renderedKey === renderKey) return;

		this.renderedKey = renderKey;
		this.rowIsland.render(
			<MetaRowContent label={this.label}>
				<div className="flex min-w-0 items-center gap-xs">
					{this.control(this.props)}
					<WingspanMark />
				</div>
			</MetaRowContent>
		);
	}
}
