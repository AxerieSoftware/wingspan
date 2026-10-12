import type { SummaryCardLook } from '../../../monarch/pages/summaryRow';
import type { Formatter } from '../../../monarch/ui/formatter';
import { SummaryStatCard } from '../../summaryScreens/components/summaryStatCard';
import type { InterestCost } from '../models/interestCost';
import { describeInterestCost } from './describeInterestCost';

const NAME = 'Interest cost';
const LABEL = 'Interest a month';

export interface InterestCostCardProps {
	look: SummaryCardLook;
	cost: InterestCost;
	formatter: Formatter;
}

/** The summary card for what the debts shown cost in interest a month, at today's balances. */
export function InterestCostCard({ look, cost, formatter }: InterestCostCardProps) {
	return <SummaryStatCard look={look} name={NAME} value={formatter.wholeMoney(cost.monthly)} label={LABEL} info={describeInterestCost(cost, formatter)} />;
}
