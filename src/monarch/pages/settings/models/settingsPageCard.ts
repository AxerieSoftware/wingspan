/** A Wingspan settings page: its card title, and a render function for the card body that returns an unmount function. */
export interface SettingsPageCard {
	title: string;
	render(bodyEl: HTMLElement): () => void;
}
