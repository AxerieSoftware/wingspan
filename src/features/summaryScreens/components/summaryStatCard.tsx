import type { SummaryCardLook } from '../../../monarch/pages/summaryRow';
import { SkeletonText } from '../../../monarch/ui/components/skeleton';
import { TooltipButton } from '../../../monarch/ui/components/tooltip';
import { WingspanMark } from '../../wingspanMark';

export interface SummaryStatCardProps {
	look: SummaryCardLook;
	/** The card's name for screen readers, also used as its test id. */
	name: string;
	/** Null while loading. */
	value: string | null;
	label: string;
	info: string;
}

/** One of Wingspan's cards in a row of Monarch's totals, built from the classes of Monarch's own. Its label shows the info on hover or focus. */
export function SummaryStatCard({ look, name, value, label, info }: SummaryStatCardProps) {
	return (
		<div role="group" aria-label={name} data-testid={`${name.toLowerCase().replaceAll(' ', '-')}-card`} className={look.cardClassName}>
			{value === null ? <SkeletonText className="text-xl" style={{ width: 96 }} /> : <span className={look.valueClassName}>{value}</span>}
			<div className={look.labelRowClassName}>
				<TooltipButton label={info} className={`${look.labelClassName} cursor-help`} isLabelledByContent>
					{label}
				</TooltipButton>
				<WingspanMark />
			</div>
		</div>
	);
}
