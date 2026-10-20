import { TooltipButton } from '../../../monarch/ui/components/tooltip';
import type { Formatter } from '../../../monarch/ui/formatter';
import { WingspanMark } from '../../wingspanMark';
import type { InterestCost } from '../models/interestCost';
import { describeInterestCost } from './describeInterestCost';

export interface GroupInterestNoteProps {
	cost: InterestCost;
	formatter: Formatter;
}

/** After a group's change on Accounts: what the group's debts cost in interest a month. */
export function GroupInterestNote({ cost, formatter }: GroupInterestNoteProps) {
	return (
		<>
			<TooltipButton label={describeInterestCost(cost, formatter)} className="text-base font-medium text-content-secondary" isLabelledByContent>
				{`${formatter.wholeMoney(cost.monthly)} a month in interest`}
			</TooltipButton>
			<WingspanMark />
		</>
	);
}
