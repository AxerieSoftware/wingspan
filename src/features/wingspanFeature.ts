/** A feature on Monarch's pages: `start` subscribes, `sync` brings the page in line, disposing undoes everything. */
export interface WingspanFeature extends Disposable {
	start(): void;
	sync(): void;
	/**
	 * Cut off by an update, Wingspan stops keeping the page in step: anything that stands in for Monarch's own content
	 * is undone, so Monarch's numbers aren't left frozen. What Wingspan only added stays, greyed out.
	 */
	suspend?(): void;
}
