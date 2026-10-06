import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ReactNode } from 'react';
import { usePortalPlacement } from '../portalContainer';
import { iconButtonStyles, menuStyles } from '../styles';
import { Button } from './button';
import { ChevronIcon, MoreIcon } from './icons';

/** A menu choice. `danger` shows it in red. */
export interface MenuItem {
	label: string;
	leading?: ReactNode;
	danger?: boolean;
	onClick(): void;
}

/** `triggerClassName` replaces the trigger's icon button style; `label` names it for screen readers. */
export interface MoreMenuProps {
	items: MenuItem[];
	triggerClassName?: string;
	label?: string;
}

/** Monarch's three-dot button that opens a menu of actions. */
export function MoreMenu({ items, triggerClassName, label = 'More options' }: MoreMenuProps) {
	return (
		<BaseMenu.Root modal={false}>
			<BaseMenu.Trigger data-mds="menu-trigger" className={triggerClassName ?? iconButtonStyles({ size: 'xs' })} aria-label={label}>
				<span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center" style={{ width: 16, height: 16 }}>
					<MoreIcon />
				</span>
			</BaseMenu.Trigger>
			<MenuPopup items={items} />
		</BaseMenu.Root>
	);
}

export interface ButtonMenuProps {
	label: string;
	leading?: ReactNode;
	loading?: boolean;
	items: MenuItem[];
}

/** A button like Monarch's, with a chevron, that opens a menu of choices. */
export function ButtonMenu({ label, leading, loading = false, items }: ButtonMenuProps) {
	return (
		<BaseMenu.Root modal={false}>
			<BaseMenu.Trigger data-mds="menu-trigger" render={<Button leading={leading} trailing={<ChevronIcon />} loading={loading} />}>
				{label}
			</BaseMenu.Trigger>
			<MenuPopup items={items} />
		</BaseMenu.Root>
	);
}

function MenuPopup({ items }: { items: MenuItem[] }) {
	const portalPlacement = usePortalPlacement();
	const menuSlots = menuStyles();
	return (
		<BaseMenu.Portal container={portalPlacement.container}>
			<BaseMenu.Positioner positionMethod={portalPlacement.positionMethod} side="bottom" align="end" sideOffset={8} className={menuSlots.positioner()}>
				<BaseMenu.Popup data-mds="menu-popup" className={menuSlots.popup()}>
					<div data-mds="menu-list" className={menuSlots.list()}>
						<div data-mds="menu-scroller" className={menuSlots.scroller()}>
							{items.map(menuItem => (
								<BaseMenu.Item key={menuItem.label} data-mds="menu-item" className={menuStyles({ variant: menuItem.danger ? 'destructive' : 'default' }).item()} onClick={menuItem.onClick}>
									{menuItem.leading}
									<span className={menuSlots.itemLabel()}>{menuItem.label}</span>
								</BaseMenu.Item>
							))}
						</div>
					</div>
				</BaseMenu.Popup>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	);
}
