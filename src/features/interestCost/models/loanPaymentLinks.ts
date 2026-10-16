import * as v from 'valibot';

/** The loan each Monarch recurring expense pays toward, by Monarch recurrence group id. */
export interface LoanPaymentLinks {
	loanAccountIdByRecurrenceId: Record<string, string>;
}

export const emptyLoanPaymentLinks = (): LoanPaymentLinks => ({ loanAccountIdByRecurrenceId: {} });

export const LoanPaymentLinksSchema: v.GenericSchema<LoanPaymentLinks> = v.looseObject({
	loanAccountIdByRecurrenceId: v.record(v.string(), v.string())
});
