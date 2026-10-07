import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ReadonlySignal } from '@preact/signals-core';
import type { BusinessEntity } from '../../../monarch/api/models/businessEntity';
import type { SidebarStyles } from '../../../monarch/pages/sidebar/sidebarPage';
import { CheckIcon, ChevronIcon } from '../../../monarch/ui/components/icons';
import { useSignalValue } from '../../../monarch/ui/hooks/useSignalValue';
import { classNames, menuStyles } from '../../../monarch/ui/styles';
import { WingspanMark } from '../../wingspanMark';
import { HOUSEHOLD_ENTITY_ID } from '../models/entityScope';
import { BusinessEntityLogo } from './businessEntityLogo';

const HOUSEHOLD_LABEL = 'Household';
/** Half the difference between the 20px logo and Monarch's 16px nav icons, so the name lines up with the links below. */
const LOGO_OVERHANG = -2;

export interface WorkspaceSwitcherProps {
	businesses: ReadonlySignal<BusinessEntity[] | null>;
	/** Household's id or a business's. */
	workspace: ReadonlySignal<string | null>;
	styles: SidebarStyles;
	/** Inside Monarch's sidebar, so it stays open while the menu is hovered. */
	menuContainer?: HTMLElement;
	onChoose(entityId: string): void;
	onManage(): void;
}

/** A row at the top of Monarch's sidebar showing the workspace, Household or one business, with a menu to switch. */
export function WorkspaceSwitcher({ businesses: businessesSignal, workspace: workspaceSignal, styles, menuContainer, onChoose, onManage }: WorkspaceSwitcherProps) {
	const businesses = useSignalValue(businessesSignal) ?? [];
	const workspace = useSignalValue(workspaceSignal);
	const menuSlots = menuStyles();
	const current = businesses.find(business => business.id === workspace) ?? null;
	const currentName = current?.name ?? HOUSEHOLD_LABEL;
	const options = [{ entityId: HOUSEHOLD_ENTITY_ID, name: HOUSEHOLD_LABEL, business: null }, ...businesses.map(business => ({ entityId: business.id, name: business.name, business }))];

	return (
		<BaseMenu.Root modal={false}>
			<BaseMenu.Trigger className={classNames(styles.linkClassName, 'w-full cursor-pointer border-0 bg-transparent text-left')} aria-label={`Workspace: ${currentName}`}>
				<div className={styles.iconClassName}>
					<span className="inline-flex" style={{ margin: LOGO_OVERHANG }}>
						<BusinessEntityLogo business={current} />
					</span>
				</div>
				<span className="hidden min-w-0 flex-1 truncate font-medium in-aria-expanded:inline-block">{currentName}</span>
				<span className="ml-auto hidden text-content-secondary in-aria-expanded:inline-flex">
					<ChevronIcon />
				</span>
			</BaseMenu.Trigger>
			<BaseMenu.Portal container={menuContainer}>
				<BaseMenu.Positioner side="right" align="start" sideOffset={8} className={menuSlots.positioner()}>
					<BaseMenu.Popup className={menuSlots.popup({ className: 'w-64' })}>
						<div className={menuSlots.list()}>
							<div className={menuSlots.scroller()}>
								<div className="flex items-center justify-between px-sm pt-xs text-xs font-medium text-content-secondary">
									Switch workspace
									<WingspanMark />
								</div>
								{options.map(({ entityId, name, business }) => {
									const isCurrent = entityId === workspace;
									return (
										<BaseMenu.Item key={entityId} className={classNames(menuSlots.item(), 'gap-xs')} onClick={() => isCurrent || onChoose(entityId)}>
											<BusinessEntityLogo business={business} />
											<span className={classNames(menuSlots.itemLabel(), isCurrent ? 'font-medium' : undefined)}>{name}</span>
											{isCurrent ? <CheckIcon /> : null}
										</BaseMenu.Item>
									);
								})}
								<div role="separator" className="mx-sm my-2xs border-t border-border-primary" />
								<p className="px-sm text-xs text-content-secondary">Pages that can't be filtered by workspace say so in their header.</p>
								<BaseMenu.Item className={menuSlots.item()} onClick={onManage}>
									<span className={menuSlots.itemLabel()}>Manage businesses</span>
								</BaseMenu.Item>
							</div>
						</div>
					</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.Root>
	);
}
