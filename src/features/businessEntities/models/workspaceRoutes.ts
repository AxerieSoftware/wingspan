import { isUnderPath } from '../../../monarch/pages/monarchNavigator';
import { HOUSEHOLD_ENTITY_ID } from './entityScope';

/** Monarch's query parameter for its business filter, as its own links set it. */
const FILTER_PARAM = 'businessEntitySet';

interface WorkspaceRoute {
	path: string;
	/** Accounts takes the filter from router state, as Monarch's P&L link passes it, and only for businesses, not Household. */
	carrier: 'query' | 'state';
	/** Whether the page follows a filter change after it has mounted. Cash Flow and Accounts read it only as they mount. */
	isLive: boolean;
}

/** The Monarch pages that have a business filter of their own. */
const ROUTES: readonly WorkspaceRoute[] = [
	{ path: '/transactions', carrier: 'query', isLive: true },
	{ path: '/reports', carrier: 'query', isLive: true },
	{ path: '/cash-flow', carrier: 'query', isLive: false },
	{ path: '/accounts', carrier: 'state', isLive: false }
];

/** A location in Monarch's app, with the router state react-router keeps in `history.state`. */
export interface RouterLocation {
	url: URL;
	state: unknown;
}

interface WorkspaceRedirect extends RouterLocation {
	isLive: boolean;
}

/**
 * The same location with Monarch's business filter set to the workspace. Null when the page has no business filter,
 * or the location already names one: a link or URL that picks a business on purpose is left as it is.
 */
export function workspaceRedirect(location: RouterLocation, entityId: string): WorkspaceRedirect | null {
	const route = ROUTES.find(candidate => isUnderPath(location.url.pathname, candidate.path));
	if (!route) return null;
	if (route.carrier === 'query') {
		if (location.url.searchParams.has(FILTER_PARAM)) return null;
		const url = new URL(location.url);
		url.searchParams.set(FILTER_PARAM, entityId);
		return { url, state: location.state, isLive: route.isLive };
	}

	if (entityId === HOUSEHOLD_ENTITY_ID) return null;
	const routerState = isRecord(location.state) ? location.state : {};
	const userState = isRecord(routerState.usr) ? routerState.usr : {};
	if ('businessEntityIds' in userState) return null;
	return { url: location.url, state: { ...routerState, usr: { ...userState, businessEntityIds: [entityId] } }, isLive: route.isLive };
}

/** The same location with no business filter of its own, so the workspace's is applied again. */
export function withoutBusinessFilter(location: RouterLocation): RouterLocation {
	const url = new URL(location.url);
	url.searchParams.delete(FILTER_PARAM);
	if (!isRecord(location.state) || !isRecord(location.state.usr)) return { url, state: location.state };
	const { businessEntityIds: _, ...userState } = location.state.usr;
	return { url, state: { ...location.state, usr: userState } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
