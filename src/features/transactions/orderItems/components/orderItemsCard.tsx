import type { TransactionCategory } from '../../../../monarch/api/models/transaction';
import { Button } from '../../../../monarch/ui/components/button';
import { CloseIcon } from '../../../../monarch/ui/components/icons';
import { Select } from '../../../../monarch/ui/components/select';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { iconButtonStyles, LINK_BUTTON_CLASS_NAME } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import { NOT_IN_CHARGE } from '../models/itemSplits';
import type { OrderItem } from '../models/orderNotes';

/** Where saving the rebuilt splits stands. */
export type SaveStatus = { status: 'idle' } | { status: 'saving' } | { status: 'failed'; message: string };

export interface OrderItemsCardProps {
	items: OrderItem[];
	/** Each item's category, in the items' order, or `NOT_IN_CHARGE` for one taken out. */
	categoryIds: string[];
	categories: TransactionCategory[];
	/** How many splits saving makes. */
	splitCount: number;
	isChanged: boolean;
	saveStatus: SaveStatus;
	formatter: Formatter;
	onChangeCategory(itemIndex: number, categoryId: string): void;
	onRemove(itemIndex: number): void;
	onAddBack(itemIndex: number): void;
	onReset(): void;
	onSave(): void;
}

/** A synced order's items, each with a category, saved as one split per category. An item taken out is crossed out. */
export function OrderItemsCard({ items, categoryIds, categories, splitCount, isChanged, saveStatus, formatter, onChangeCategory, onRemove, onAddBack, onReset, onSave }: OrderItemsCardProps) {
	// Like Monarch's category pickers: the emoji, then the name.
	const options = categories.map(category => [category.id, category.icon ? `${category.icon} ${category.name}` : category.name] as const);
	const removedCount = categoryIds.filter(categoryId => categoryId === NOT_IN_CHARGE).length;
	return (
		<section role="group" aria-label="Items in this order" className="flex flex-col rounded-lg border border-border-primary bg-background-primary">
			<div className="flex items-center gap-2xs border-b border-b-divider-primary px-default py-sm">
				<span className="text-base font-medium text-content-primary">Items in this order</span>
				<WingspanMark />
			</div>
			<ul className="m-0 flex list-none flex-col p-0" aria-label="Items">
				{items.map((item, index) => {
					const categoryId = categoryIds[index] ?? NOT_IN_CHARGE;
					const isRemoved = categoryId === NOT_IN_CHARGE;
					return (
						// Two of the same item can sit in different categories, so items are keyed by their place in the order.
						// biome-ignore lint/suspicious/noArrayIndexKey: an order's items never reorder.
						<li key={index} className="flex flex-col gap-2xs border-t border-t-divider-primary px-default py-xs first:border-t-0">
							<div className="flex min-w-0 items-start justify-between gap-sm">
								<span className={`min-w-0 text-sm font-book ${isRemoved ? 'text-content-secondary line-through' : 'text-content-primary'}`}>{item.name}</span>
								<span className={`shrink-0 text-sm text-content-secondary ${isRemoved ? 'line-through' : ''}`}>
									{item.quantity > 1 ? `${item.quantity} × ${formatter.money(item.unitPrice)}` : formatter.money(item.unitPrice)}
								</span>
							</div>
							{isRemoved ? (
								<button type="button" className={`${LINK_BUTTON_CLASS_NAME} self-start text-sm`} aria-label={`Add back ${item.name}`} onClick={() => onAddBack(index)}>
									Add back
								</button>
							) : (
								<div className="flex min-w-0 items-center gap-2xs">
									<div className="min-w-0 flex-1">
										<Select options={options} value={categoryId} label={`${item.name}, category`} onChange={chosenId => onChangeCategory(index, chosenId)} />
									</div>
									<button type="button" className={iconButtonStyles({ variant: 'ghost', size: '3xs', className: 'shrink-0' })} aria-label={`Remove ${item.name}`} onClick={() => onRemove(index)}>
										<CloseIcon />
									</button>
								</div>
							)}
						</li>
					);
				})}
			</ul>
			<div className="flex flex-wrap items-center justify-between gap-xs border-t border-t-divider-primary px-default py-sm">
				<span aria-live="polite" className={`text-xs ${saveStatus.status === 'failed' ? 'text-content-warning' : 'text-content-secondary'}`}>
					{noteOf(splitCount, removedCount, isChanged, saveStatus)}
				</span>
				<div className="flex items-center gap-xs">
					<Button disabled={!isChanged || saveStatus.status === 'saving'} onClick={onReset}>
						Reset
					</Button>
					<Button variant="primary" disabled={!isChanged || splitCount < 2} loading={saveStatus.status === 'saving'} onClick={onSave}>
						Save splits
					</Button>
				</div>
			</div>
		</section>
	);
}

function noteOf(splitCount: number, removedCount: number, isChanged: boolean, saveStatus: SaveStatus): string {
	if (saveStatus.status === 'failed') return saveStatus.message;
	if (!isChanged) return "Pick a category for an item to move it, or remove one you didn't get.";
	if (splitCount < 2) return 'Use at least two categories, or unsplit it in Monarch.';
	const removed = removedCount ? `, without ${removedCount === 1 ? 'the item' : `the ${removedCount} items`} you removed` : '';
	return `Saves as ${splitCount} splits, shared out by price${removed}.`;
}
