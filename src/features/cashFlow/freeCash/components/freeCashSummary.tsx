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

/** Free cash today, with any shortfall, a note about cards counted as $0 because their balance is unknown, and a link to projected balances. */
export function FreeCashSummary({ projection, formatter, onEdit, onOpenProjection }: FreeCashSummaryProps) {
	if (!projection) return <Button onClick={onEdit}>Choose checking</Button>;
	const unknownCount = projection.cards.filter(card => !card.hasAmount).length;

	return (
		<>
			<div className="flex w-full items-center justify-between gap-xs">
				<div className="flex items-center gap-2xs">
					<span className="text-sm font-medium text-content-primary">Free cash today</span>
					<WingspanMark />
					<button type="button" className={`${iconButtonStyles({ size: '3xs' })} -my-2xs`} aria-label="Edit cash and cards" title="Edit" onClick={onEdit}>
						<Icon shape="pencil" size={12} />
					</button>
				</div>
				<span className={`text-sm font-medium ${projection.freeCash > 0 ? 'text-content-success' : 'text-content-secondary'}`}>{formatter.money(projection.freeCash)}</span>
			</div>
			<span className="text-xs font-book">
				{projection.shortfall > 0 ? <span className="text-content-danger">{`${formatter.money(projection.shortfall)} below what you keep in checking · `}</span> : null}
				{unknownCount ? <span className="text-content-warning">{`Leaves out ${unknownCount === 1 ? 'a card' : `${unknownCount} cards`} with no amount · `}</span> : null}
				<button type="button" className={LINK_BUTTON_CLASS_NAME} onClick={onOpenProjection}>
					See projected balances
				</button>
			</span>
		</>
	);
}

export function FreeCashSummaryLoading() {
	return (
		<>
			<SkeletonText className="text-sm" style={{ width: 140 }} />
			<SkeletonText className="text-sm" style={{ width: '100%' }} />
		</>
	);
}
