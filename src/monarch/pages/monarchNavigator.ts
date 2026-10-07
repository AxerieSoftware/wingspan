/** Whether the path is that page or one of its sub-pages, like /reports/spending under /reports. */
export function isUnderPath(pathname: string, rootPath: string): boolean {
	return pathname === rootPath || pathname.startsWith(`${rootPath}/`);
}

export class MonarchNavigator {
	public constructor(private readonly window: Window) {}

	public get path(): string {
		return this.window.location.pathname;
	}

	public isUnder(rootPath: string): boolean {
		return isUnderPath(this.path, rootPath);
	}

	/** Pushes the path and fires popstate so Monarch's router follows without a reload. */
	public navigateTo(path: string): void {
		this.window.history.pushState(null, '', path);
		this.window.dispatchEvent(new PopStateEvent('popstate'));
	}
}
