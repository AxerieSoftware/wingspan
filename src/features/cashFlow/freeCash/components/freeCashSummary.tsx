import { countOf } from '../../../../common/countOf';
import { Button } from '../../../../monarch/ui/components/button';
import { Icon } from '../../../../monarch/ui/components/icons';
import { SkeletonText } from '../../../../monarch/ui/components/skeleton';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { iconButtonStyles, LINK_BUTTON_CLASS_NAME } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import type { Projection } from '../../projectedBalances/models/projection';

/** A null projection means no checking account is chosen yet. */
export interface FreeCashSummaryProps {
	projection: Projection | null;
	formatter: Formatter;
	onEdit(): void;
	onOpenProjection(): void;
}

/** Free cash today and how long it's safe for, or the shortfall when checking falls short, with a link to projected balances. */
export function FreeCashSummary({ projection, formatter, onEdit, onOpenProjection }: FreeCashSummaryProps) {
	if (!projection) return <Button onClick={onEdit}>Choose checking</Button>;
	const cardsWithoutAmountCount = projection.cards.filter(card => !card.hasAmount).length;
	const { reversible } = projection;
	const shortFromDate = projection.shortfall > 0 ? reversible.firstShortDate : null;

	return (
		<>
			<div className="flex w-full items-center justify-between gap-xs">
				<div className="flex items-center gap-2xs">
					<span className="text-sm font-medium text-content-primary">{shortFromDate ? `Short from ${formatter.nearDate(shortFromDate)}` : 'Free cash today'}</span>
					<WingspanMark />
					<button type="button" className={`${iconButtonStyles({ size: '3xs' })} -my-2xs`} aria-label="Edit cash and cards" title="Edit" onClick={onEdit}>
						<Icon shape="pencil" size={12} />
					</button>
				</div>
				<span className={`text-sm font-medium ${freeCashTone(projection, shortFromDate !== null)}`}>{formatter.money(shortFromDate ? projection.shortfall : projection.freeCash)}</span>
			</div>
			<span className="text-xs font-book">
				{shortFromDate ? null : <span className="text-content-secondary">{`Safe through ${formatter.nearDate(reversible.endDate)} · `}</span>}
				{cardsWithoutAmountCount ? <span className="text-content-warning">{`${countOf(cardsWithoutAmountCount, 'card')} counted as $0 · `}</span> : null}
				<button type="button" className={LINK_BUTTON_CLASS_NAME} onClick={onOpenProjection}>
					See projected balances
				</button>
			</span>
		</>
	);
}

/** Red when checking falls short, green when there's free cash, and plain at $0. */
function freeCashTone(projection: Projection, isShort: boolean): string {
	if (isShort) return 'text-content-danger';
	return projection.freeCash > 0 ? 'text-content-success' : 'text-content-primary';
}

export function FreeCashSummaryLoading() {
	return (
		<>
			<SkeletonText className="text-sm" style={{ width: 140 }} />
			<SkeletonText className="text-sm" style={{ width: '100%' }} />
		</>
	);
}
