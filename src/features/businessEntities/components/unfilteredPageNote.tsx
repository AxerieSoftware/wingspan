import { Tooltip } from '../../../monarch/ui/components/tooltip';
import { WingspanMark } from '../../wingspanMark';

const EXPLANATION = "This page can't be filtered by workspace, so it shows all of them together.";

/** A quiet note in the page header that this page shows the household and businesses together. */
export function UnfilteredPageNote() {
	return (
		<Tooltip label={EXPLANATION}>
			<button
				type="button"
				aria-label={`Not filtered by workspace. ${EXPLANATION}`}
				className="inline-flex h-9 shrink-0 cursor-default items-center gap-xs rounded-sm border border-dashed border-border-primary bg-transparent px-sm text-sm font-medium text-content-secondary"
			>
				<WingspanMark />
				Not filtered by workspace
			</button>
		</Tooltip>
	);
}
