import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ReactNode } from 'react';
import { Avatar } from '../../../../monarch/ui/components/avatar';
import { usePortalPlacement } from '../../../../monarch/ui/portalContainer';
import { savedLogoUrl } from '../../../../monarch/ui/savedLogoUrl';
import type { RecurringItem, RecurringItemIcon } from '../../recurringItems/models/recurringItem';

const EMOJI_CHOICES = ['🏠', '💡', '💧', '🔥', '📱', '🌐', '📺', '🎵', '🚗', '⛽', '🏫', '👶', '🎓', '🏥', '💊', '🛒', '🍽️', '🐶', '🏋️', '⛪', '🎁', '💳', '🏦', '🧾'];
const CHOICE_CLASS_NAME = 'inline-flex size-9 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent hover:bg-background-secondary-hover';

/** `onPick` receives undefined when the item's initial is chosen. */
export interface IconPickerProps {
	item: RecurringItem;
	merchantLogoUrl: string | null;
	onPick(icon: RecurringItemIcon | undefined): void;
}

/** The item's avatar. Clicking it lets you choose the merchant's logo, its initial or an emoji. */
export function IconPicker({ item, merchantLogoUrl, onPick }: IconPickerProps) {
	const portalPlacement = usePortalPlacement();
	const logoUrl = merchantLogoUrl ?? savedLogoUrl(item.icon?.kind === 'logo' ? item.icon.url : undefined);

	const iconChoice = (title: string, icon: RecurringItemIcon | undefined, content: ReactNode) => (
		<BasePopover.Close key={title} className={CHOICE_CLASS_NAME} title={title} onClick={() => onPick(icon)}>
			{content}
		</BasePopover.Close>
	);

	return (
		<BasePopover.Root>
			<BasePopover.Trigger
				className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border-primary bg-background-primary p-0"
				aria-label="Choose icon"
				title="Choose icon"
			>
				<Avatar source={item} size="fill" />
			</BasePopover.Trigger>
			<BasePopover.Portal container={portalPlacement.container}>
				<BasePopover.Positioner positionMethod={portalPlacement.positionMethod} side="bottom" align="start" sideOffset={6} className="z-floating">
					<BasePopover.Popup
						data-mds="popover-content"
						className="rounded-default border border-border-primary bg-background-primary p-xs shadow-lg outline-none"
						style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 36px)', gap: 2 }}
					>
						{logoUrl ? iconChoice('Merchant logo', { kind: 'logo', url: logoUrl }, <img src={logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: 9999 }} />) : null}
						{iconChoice('Initial', undefined, <span className="text-sm font-medium text-content-secondary">Aa</span>)}
						{EMOJI_CHOICES.map(emoji => iconChoice(emoji, { kind: 'emoji', value: emoji }, <span style={{ fontSize: 18 }}>{emoji}</span>))}
					</BasePopover.Popup>
				</BasePopover.Positioner>
			</BasePopover.Portal>
		</BasePopover.Root>
	);
}
