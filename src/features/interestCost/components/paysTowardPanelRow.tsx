import { Select } from '../../../monarch/ui/components/select';
import { WingspanPanelRow } from '../../recurring/shared/components/wingspanPanelRow';

const NO_LOAN = '';

/** A loan the household can pick, by Monarch account id. */
export interface LoanChoice {
	id: string;
	name: string;
}

interface PaysTowardPanelRowProps {
	itemId: string;
	loanAccountId: string | undefined;
	loans: readonly LoanChoice[];
}

/** The Pays toward row in a Monarch expense's panel, linking its payments to a loan. */
export class PaysTowardPanelRow extends WingspanPanelRow<PaysTowardPanelRowProps> {
	public constructor(private readonly onChange: (itemId: string, loanAccountId: string | undefined) => void) {
		super('Pays toward');
	}

	protected keyOf({ itemId, loanAccountId, loans }: PaysTowardPanelRowProps): string {
		return `${itemId}|${loanAccountId ?? ''}|${loans.map(loan => `${loan.id}:${loan.name}`).join(',')}`;
	}

	protected control({ itemId, loanAccountId, loans }: PaysTowardPanelRowProps) {
		const options = [[NO_LOAN, 'None'] as const, ...loans.map(loan => [loan.id, loan.name] as const)];
		if (loanAccountId && !loans.some(loan => loan.id === loanAccountId)) options.push([loanAccountId, 'Hidden or closed loan']);
		return <Select inline label="Pays toward" options={options} value={loanAccountId ?? NO_LOAN} onChange={chosen => this.onChange(itemId, chosen || undefined)} />;
	}
}
