export interface WingspanAccountLinkProps {
	/** The hidden wingspan account Wingspan saves to. */
	accountId: string;
	className: string;
}

export function WingspanAccountLink({ accountId, className }: WingspanAccountLinkProps) {
	return (
		<a className={className} href={`/accounts/details/${accountId}`}>
			See the wingspan account in Monarch
		</a>
	);
}
