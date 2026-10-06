import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ReadonlySignal } from '@preact/signals-core';
import type { BusinessEntity } from '../../../monarch/api/models/businessEntity';
import { MonarchIcon } from '../../../monarch/ui/components/icons';
import { useSignalValue } from '../../../monarch/ui/hooks/useSignalValue';
import { usePortalPlacement } from '../../../monarch/ui/portalContainer';
import { buttonStyles, classNames, menuStyles } from '../../../monarch/ui/styles';
import { HOUSEHOLD_ENTITY_ID } from '../models/entityScope';
import { BusinessEntityLogo } from './businessEntityLogo';

const HOUSEHOLD_LABEL = 'Household';

/** `filter` uses Monarch's format: business ids plus Household's id, with an empty list meaning everything. */
export interface BusinessEntitySwitchProps {
	businesses: ReadonlySignal<BusinessEntity[] | null>;
	filter: ReadonlySignal<readonly string[]>;
	buttonClassName?: string;
	onChange(filter: string[]): void;
}

/** The same label Monarch uses for its business filter. */
export function businessFilterLabel(filter: readonly string[], businesses: readonly BusinessEntity[]): string {
	const chosenBusinesses = businesses.filter(business => filter.includes(business.id));
	const includesHousehold = filter.includes(HOUSEHOLD_ENTITY_ID);
	if (!chosenBusinesses.length) return includesHousehold ? `${HOUSEHOLD_LABEL} only` : 'Business';
	if (includesHousehold) return 'Mixed';
	return chosenBusinesses.length === 1 ? (chosenBusinesses[0]?.name ?? 'Business') : `${chosenBusinesses.length} businesses`;
}

/** The logo Monarch's filter button shows when only Household or a single business is selected. None for any other mix. */
function buttonLogo(filter: readonly string[], businesses: readonly BusinessEntity[]): BusinessEntity | null | undefined {
	const chosenBusinesses = businesses.filter(business => filter.includes(business.id));
	const includesHousehold = filter.includes(HOUSEHOLD_ENTITY_ID);
	if (!chosenBusinesses.length) return includesHousehold ? null : undefined;
	return chosenBusinesses.length === 1 && !includesHousehold ? chosenBusinesses[0] : undefined;
}

/** A copy of Monarch's Cash Flow business filter for Recurring: a toggle for each business, then Household. */
export function BusinessEntitySwitch({ businesses: businessesSignal, filter: filterSignal, buttonClassName, onChange }: BusinessEntitySwitchProps) {
	const businesses = useSignalValue(businessesSignal) ?? [];
	const filter = useSignalValue(filterSignal);
	const portalPlacement = usePortalPlacement();
	const menuSlots = menuStyles();
	const options = [...businesses.map(business => ({ entityId: business.id, label: business.name, business })), { entityId: HOUSEHOLD_ENTITY_ID, label: HOUSEHOLD_LABEL, business: null }];
	const toggle = (entityId: string, isChosen: boolean) => onChange(isChosen ? [...filter.filter(chosenId => chosenId !== entityId), entityId] : filter.filter(chosenId => chosenId !== entityId));
	const logo = buttonLogo(filter, businesses);
	const isFiltered = filter.some(entityId => entityId === HOUSEHOLD_ENTITY_ID || businesses.some(business => business.id === entityId));

	return (
		<>
			<BaseMenu.Root modal={false}>
				<BaseMenu.Trigger data-mds="menu-trigger" className={buttonClassName ?? buttonStyles()} aria-label={`Business filter: ${businessFilterLabel(filter, businesses)}`}>
					<span data-mds="button-icon" className="inline-flex shrink-0 items-center justify-center">
						{logo === undefined ? <MonarchIcon name="folder" size={16} /> : <BusinessEntityLogo business={logo} />}
					</span>
					<span data-mds="button-label" className="max-w-40 truncate">
						{businessFilterLabel(filter, businesses)}
					</span>
				</BaseMenu.Trigger>
				<BaseMenu.Portal container={portalPlacement.container}>
					<BaseMenu.Positioner positionMethod={portalPlacement.positionMethod} side="bottom" align="end" sideOffset={8} className={menuSlots.positioner()}>
						<BaseMenu.Popup data-mds="menu-popup" className={menuSlots.popup({ className: 'min-w-50' })}>
							<div data-mds="menu-list" className={menuSlots.list()}>
								<div data-mds="menu-scroller" className={menuSlots.scroller()}>
									{options.map(({ entityId, label, business }) => {
										const isChosen = filter.includes(entityId);
										return (
											<BaseMenu.CheckboxItem
												key={entityId}
												data-mds="menu-item"
												className={classNames(menuSlots.item(), 'gap-xs')}
												checked={isChosen}
												onCheckedChange={isChosen => toggle(entityId, isChosen)}
											>
												<BusinessEntityLogo business={business} />
												<span className={classNames(menuSlots.itemLabel(), isChosen ? 'text-content-link' : business ? undefined : 'text-content-secondary')}>{label}</span>
												<BaseMenu.CheckboxItemIndicator className="inline-flex shrink-0" style={{ color: 'var(--border-info)' }}>
													<MonarchIcon name="check" size={24} />
												</BaseMenu.CheckboxItemIndicator>
											</BaseMenu.CheckboxItem>
										);
									})}
								</div>
							</div>
						</BaseMenu.Popup>
					</BaseMenu.Positioner>
				</BaseMenu.Portal>
			</BaseMenu.Root>
			{isFiltered ? <span aria-hidden="true" className="pointer-events-none absolute -top-1 -right-1 size-3 shrink-0 rounded-full bg-background-brand" /> : null}
		</>
	);
}
