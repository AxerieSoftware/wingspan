import { Popover as BasePopover } from '@base-ui/react/popover';
import { Badge } from '../../../../monarch/ui/components/badge';
import { Button } from '../../../../monarch/ui/components/button';
import { ChevronIcon, RefreshIcon } from '../../../../monarch/ui/components/icons';
import { Spinner } from '../../../../monarch/ui/components/spinner';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { usePortalPlacement } from '../../../../monarch/ui/portalContainer';
import { classNames, LINK_BUTTON_CLASS_NAME, popoverStyles } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import type { AccountSyncStatus, SyncSummary } from '../models/syncSummary';

/** Banks usually sync daily, so an account this far behind is likely stuck, like a card that syncs only when its owner opens Monarch. */
const STALE_AFTER_MS = 2 * 24 * 60 * 60_000;

/** Room for a long account name beside its sync time; Monarch's stylesheet has no width class this size. */
const POPOVER_WIDTH = '18rem';

export interface SyncStatusNoteProps {
	summary: SyncSummary;
	isRefreshing: boolean;
	now: number;
	formatter: Formatter;
	onRefresh(): void;
	onOpenAccounts(): void;
}

/** In the Transactions header: a button saying when the accounts last synced, opening each account's sync and a Refresh all button. */
export function SyncStatusNote({ summary, isRefreshing, now, formatter, onRefresh, onOpenAccounts }: SyncStatusNoteProps) {
	const portalPlacement = usePortalPlacement();
	const popoverSlots = popoverStyles();
	const { latestSyncedAt, accounts } = summary;
	const needsAttentionCount = accounts.filter(account => account.needsAttention).length;
	// The button's name starts with what it shows, so voice control users can say it.
	let shortStatus = 'Not synced';
	let status = 'Not synced yet';
	if (isRefreshing) {
		shortStatus = 'Refreshing…';
		status = 'Refreshing accounts';
	} else if (latestSyncedAt !== null) {
		shortStatus = formatter.shortTimeAgo(latestSyncedAt, now);
		status = `${shortStatus}, last account sync`;
	}
	if (needsAttentionCount > 0) status += needsAttentionCount === 1 ? ', 1 account needs attention' : `, ${needsAttentionCount} accounts need attention`;

	return (
		<BasePopover.Root>
			<BasePopover.Trigger aria-label={status} render={<Button leading={isRefreshing ? <Spinner size="xs" /> : <RefreshIcon />} trailing={<ChevronIcon />} />}>
				<span className="flex items-center gap-xs">
					{shortStatus}
					{needsAttentionCount > 0 ? <Badge tone="count">{needsAttentionCount}</Badge> : null}
				</span>
			</BasePopover.Trigger>
			<BasePopover.Portal container={portalPlacement.container}>
				<BasePopover.Positioner positionMethod={portalPlacement.positionMethod} side="bottom" align="end" sideOffset={8} className={popoverSlots.positioner()}>
					<BasePopover.Popup data-mds="popover-content" aria-label="Account syncs" className={popoverSlots.content({ className: 'gap-sm p-sm' })} style={{ width: POPOVER_WIDTH }}>
						<span className="flex items-center justify-between gap-sm px-2xs text-sm font-medium">
							Account syncs
							<WingspanMark />
						</span>
						<ul className="m-0 flex list-none flex-col gap-2xs p-0">
							{accounts.map(account => (
								<AccountSyncRow key={account.id} account={account} now={now} formatter={formatter} onOpenAccounts={onOpenAccounts} />
							))}
						</ul>
						<Button className="w-full" loading={isRefreshing} onClick={onRefresh}>
							Refresh all
						</Button>
					</BasePopover.Popup>
				</BasePopover.Positioner>
			</BasePopover.Portal>
		</BasePopover.Root>
	);
}

interface AccountSyncRowProps {
	account: AccountSyncStatus;
	now: number;
	formatter: Formatter;
	onOpenAccounts(): void;
}

function AccountSyncRow({ account, now, formatter, onOpenAccounts }: AccountSyncRowProps) {
	const isStale = account.syncedAt !== null && now - account.syncedAt > STALE_AFTER_MS;
	return (
		<li className="flex items-center justify-between gap-sm px-2xs text-sm font-book">
			<span className="min-w-0 truncate text-content-primary">{account.name}</span>
			{account.needsAttention ? (
				<button type="button" className={classNames(LINK_BUTTON_CLASS_NAME, 'shrink-0 text-sm')} onClick={onOpenAccounts}>
					Needs attention
				</button>
			) : (
				<span className={classNames('shrink-0', isStale ? 'text-content-warning' : 'text-content-secondary')}>
					{account.syncedAt !== null ? formatter.timeAgo(account.syncedAt, now) : 'Not synced yet'}
				</span>
			)}
		</li>
	);
}
