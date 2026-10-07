import { isUnderPath } from '../../../monarch/pages/monarchNavigator';

/** Monarch's pages without a business filter of their own, which always show the household and every business. */
const UNFILTERED_PATHS: readonly string[] = ['/dashboard', '/plan', '/recurring', '/goals', '/investments', '/forecast'];

export function isUnfilteredPage(pathname: string): boolean {
	return UNFILTERED_PATHS.some(path => isUnderPath(pathname, path));
}
