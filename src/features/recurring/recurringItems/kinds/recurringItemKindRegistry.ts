import type { RecurringItem } from '../models/recurringItem';
import type { RecurringItemKind } from './recurringItemKind';

/** The kinds of item Wingspan knows, by the `kind` saved on each item. */
export class RecurringItemKindRegistry {
	private readonly kindsByName: ReadonlyMap<string, RecurringItemKind>;

	public constructor(private readonly kinds: RecurringItemKind[]) {
		this.kindsByName = new Map(kinds.map(itemKind => [itemKind.kind, itemKind]));
	}

	/** In the order Add recurring lists them. */
	public get all(): RecurringItemKind[] {
		return this.kinds;
	}

	/** False for an item whose kind is no longer registered. */
	public supports(item: RecurringItem): boolean {
		return this.kindsByName.has(item.kind);
	}

	/** Throws for an item of an unregistered kind, so check `supports` first. */
	public of(item: RecurringItem): RecurringItemKind {
		return this.named(item.kind);
	}

	/** The Monarch account the item tracks, like a card payment's card. Throws for an unregistered kind. */
	public linkedAccountId(item: RecurringItem): string | undefined {
		return this.of(item).linkedAccountId(item);
	}

	/** Whether the item tracks a Monarch account, like a card payment linked to its card. */
	public isLinked(item: RecurringItem): boolean {
		return this.linkedAccountId(item) !== undefined;
	}

	/** Throws when no kind has that name. */
	public named(kind: string): RecurringItemKind {
		const itemKind = this.kindsByName.get(kind);
		if (!itemKind) throw new Error(`No recurring item kind "${kind}" is registered.`);
		return itemKind;
	}
}
