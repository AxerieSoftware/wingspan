import type { BusinessEntityView } from '../services/businessEntityView';
import type { EntityMembership } from '../services/entityMembership';

/** Which entities the pages show, and which accounts, items and flows belong to them. */
export interface BusinessFilter {
	readonly view: BusinessEntityView;
	readonly membership: EntityMembership;
}
