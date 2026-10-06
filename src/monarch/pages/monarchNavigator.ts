export class MonarchNavigator {
	public constructor(private readonly window: Window) {}

	public get path(): string {
		return this.window.location.pathname;
	}

	public isUnder(rootPath: string): boolean {
		return this.path === rootPath || this.path.startsWith(`${rootPath}/`);
	}

	/** Pushes the path and fires popstate so Monarch's router follows without a reload. */
	public navigateTo(path: string): void {
		this.window.history.pushState(null, '', path);
		this.window.dispatchEvent(new PopStateEvent('popstate'));
	}
}
