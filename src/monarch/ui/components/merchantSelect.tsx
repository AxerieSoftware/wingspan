import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { type KeyboardEvent, useRef, useState } from 'react';
import { usePortalPlacement } from '../portalContainer';
import { inputBaseStyles, inputGroupStyles, menuStyles } from '../styles';
import { MerchantLogo } from './avatar';
import { ChevronIcon, SearchIcon } from './icons';

/** A merchant to choose, with its logo if Monarch has one. */
export interface MerchantChoice {
	id: string;
	name: string;
	logoUrl?: string;
}

export interface MerchantSelectProps {
	merchants: readonly MerchantChoice[];
	value: MerchantChoice | null;
	label: string;
	onChange(merchant: MerchantChoice | null): void;
}

const TRIGGER_CLASS_NAME = 'flex h-10 w-full items-center justify-between gap-sm px-sm text-left text-base';
const PLACEHOLDER = 'Choose a merchant';

/** A searchable merchant picker like Monarch's, with each merchant's logo. */
export function MerchantSelect({ merchants, value, label, onChange }: MerchantSelectProps) {
	const portalPlacement = usePortalPlacement();
	const [search, setSearch] = useState('');
	const [isOpen, setIsOpen] = useState(false);
	// When a keypress opens the popup, focus stays on the button until the search box mounts, and Base UI would treat
	// that as focus-out and close the popup.
	const isMovingFocusRef = useRef(false);
	const menuSlots = menuStyles({ popupWidth: 'anchor' });
	const inputGroupSlots = inputGroupStyles({ size: 'sm' });
	const searchText = search.trim().toLowerCase();
	const shownMerchants = searchText ? merchants.filter(merchant => merchant.name.toLowerCase().includes(searchText)) : merchants;

	// Letters typed on the button start a search. Left to Base UI, they would pick the first merchant starting with them.
	const startSearch = (event: KeyboardEvent<HTMLButtonElement> & { preventBaseUIHandler?: () => void }) => {
		if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey || event.key === ' ') return;
		event.preventBaseUIHandler?.();
		event.preventDefault();
		setSearch(current => current + event.key);
		setIsOpen(true);
		isMovingFocusRef.current = true;
	};

	return (
		<BaseCombobox.Root
			open={isOpen}
			items={shownMerchants}
			value={value}
			inputValue={search}
			filter={null}
			autoHighlight={searchText.length > 0}
			itemToStringLabel={(merchant: MerchantChoice | null) => merchant?.name ?? ''}
			isItemEqualToValue={(merchant: MerchantChoice | null, selected: MerchantChoice | null) => merchant?.id === selected?.id}
			onInputValueChange={(inputValue, details) => details.reason === 'input-change' && setSearch(inputValue)}
			onOpenChange={(nextIsOpen, details) => {
				if (!nextIsOpen && details.reason === 'focus-out' && isMovingFocusRef.current) return;
				setIsOpen(nextIsOpen);
				if (!nextIsOpen) setSearch('');
			}}
			onValueChange={(merchant: MerchantChoice | null) => {
				setSearch('');
				onChange(merchant);
			}}
		>
			<BaseCombobox.Trigger
				onKeyDown={startSearch}
				render={<button type="button" aria-label={`${label}: ${value?.name ?? PLACEHOLDER}`} className={inputBaseStyles({ mode: 'button', className: TRIGGER_CLASS_NAME })} />}
			>
				<span className="flex min-w-0 items-center gap-sm">
					{value ? <MerchantLogo url={value.logoUrl} /> : null}
					<span className={value ? 'min-w-0 truncate' : 'min-w-0 truncate text-input-placeholder'}>{value?.name ?? PLACEHOLDER}</span>
				</span>
				<span className="shrink-0 text-content-secondary">
					<ChevronIcon />
				</span>
			</BaseCombobox.Trigger>
			<BaseCombobox.Portal container={portalPlacement.container}>
				<BaseCombobox.Positioner positionMethod={portalPlacement.positionMethod} side="bottom" align="start" sideOffset={8} className={menuSlots.positioner()}>
					<BaseCombobox.Popup data-mds="combobox-popup" className={menuSlots.popup({ className: 'max-h-[min(20rem,var(--available-height))]' })}>
						<div data-mds="combobox-popup-input-shell" className={menuSlots.popupInputShell()}>
							<div role="group" data-mds="input-group" className={inputGroupSlots.root({ className: menuSlots.popupInputField() })}>
								<BaseCombobox.Input
									onFocus={() => {
										isMovingFocusRef.current = false;
									}}
									data-mds="combobox-popup-input"
									data-input-group-control=""
									placeholder="Search merchants"
									className={inputGroupSlots.input()}
								/>
								<div data-mds="input-group-addon" data-align="inline-start" className={inputGroupSlots.addon({ className: 'ps-xs' })}>
									<SearchIcon />
								</div>
							</div>
						</div>
						<BaseCombobox.Empty className="px-sm py-xs text-sm text-content-secondary">{searchText ? `No matches for "${search}".` : 'No merchants found.'}</BaseCombobox.Empty>
						<BaseCombobox.List data-mds="combobox-list" className={menuSlots.list()}>
							<div data-mds="combobox-scroller" className={menuSlots.scroller()}>
								{shownMerchants.map(merchant => (
									<BaseCombobox.Item key={merchant.id} value={merchant} data-mds="combobox-option" className={menuSlots.item()}>
										<span className="flex min-w-0 items-center gap-sm">
											<MerchantLogo url={merchant.logoUrl} />
											<span className="min-w-0 truncate">{merchant.name}</span>
										</span>
									</BaseCombobox.Item>
								))}
							</div>
						</BaseCombobox.List>
					</BaseCombobox.Popup>
				</BaseCombobox.Positioner>
			</BaseCombobox.Portal>
		</BaseCombobox.Root>
	);
}
