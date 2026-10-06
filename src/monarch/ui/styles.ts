import { type CnOptions, cnMerge, createTV } from 'tailwind-variants';

const TW_MERGE_CONFIG = {
	extend: {
		theme: {
			spacing: [
				'px',
				'3xs',
				'2xs',
				'xs',
				'sm',
				'md',
				'lg',
				'xl',
				'2xl',
				'3xl',
				'4xl',
				'gutter',
				'default',
				'container-3xs',
				'container-2xs',
				'container-xs',
				'container-sm',
				'container-md',
				'container-lg',
				'container-xl',
				'container-2xl',
				'container-3xl',
				'container-4xl',
				'container-5xl'
			],
			radius: ['0', '2xs', 'xs', 'sm', 'default', 'md', 'lg', 'round', 'pill'],
			shadow: ['none', 'sm', 'md', 'lg', 'upcast', 'inset', 'card'],
			text: ['2xs', 'xs', 'sm', 'base', 'lg', '20', 'xl', '2xl', '3xl'],
			'font-weight': ['book', 'medium', 'bold'],
			zIndex: ['hide', 'base', 'docked', 'floating', 'toast', 'tooltip']
		}
	}
};

const tv = createTV({ twMergeConfig: TW_MERGE_CONFIG });

/** Joins class names, with later ones overriding conflicting earlier ones, including Monarch's own scale names. */
export const classNames = (...classes: CnOptions): string => cnMerge(...classes)({ twMergeConfig: TW_MERGE_CONFIG }) ?? '';

const BUTTON_BASE =
	'inline-flex shrink-0 cursor-pointer items-center justify-center border-0 font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 ' +
	'focus-visible:outline-border-info focus-visible:outline-solid active:shadow-inset disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none data-pressed:shadow-inset';
const BUTTON_OUTLINE =
	'border border-border-primary bg-background-primary text-content-primary shadow-sm not-disabled:hover:border-border-primary-hover active:bg-background-secondary ' +
	'disabled:bg-background-secondary disabled:text-content-secondary disabled:opacity-100 data-pressed:border-border-primary-hover data-pressed:bg-background-secondary';
const BUTTON_PRIMARY = 'bg-background-brand text-content-white shadow-sm not-disabled:not-data-pressed:hover:bg-background-brand-hover disabled:bg-background-brand-disabled disabled:opacity-100';
const BUTTON_OVERLAY =
	'border border-overlay-primary-12 bg-overlay-primary-8 text-content-primary not-disabled:not-data-pressed:not-active:hover:shadow-sm active:bg-background-secondary ' +
	'disabled:text-content-secondary disabled:opacity-100 data-pressed:bg-background-secondary';
const MENU_ITEM_BASE =
	'mx-2xs flex cursor-pointer items-center gap-xs rounded-sm px-xs py-1.5 text-base/6 transition-colors outline-none active:shadow-inset data-disabled:cursor-not-allowed ' +
	'data-disabled:opacity-50 data-highlighted:bg-background-secondary-hover data-selected:bg-background-info data-selected:text-content-info';
const SURFACE_ANIMATION =
	'origin-(--transform-origin) scale-100 opacity-100 transition-[scale,opacity] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 ' +
	'data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none';
const FROSTED_SURFACE = 'bg-background-frosted shadow-lg [backdrop-filter:var(--background-blur-frosted)]';

/** The border and colors Monarch's inputs share, for a typed `input` or a `button` that opens a picker. */
export const inputBaseStyles = tv({
	base:
		'rounded-sm border border-input-default-border bg-input-default-background text-content-primary outline-0 hover:border-input-hover-border hover:bg-input-hover-background ' +
		'in-data-invalid:not-disabled:border-input-error-border in-data-invalid:not-disabled:bg-input-error-background in-data-invalid:not-disabled:text-input-error-text in-data-invalid:not-disabled:hover:border-input-error-border',
	variants: {
		mode: {
			input: 'placeholder:text-input-placeholder focus:border-input-focus-border focus:bg-input-focus-background focus:text-input-focus-text',
			button:
				'cursor-pointer transition-colors focus-visible:border-input-focus-border focus-visible:bg-input-focus-background focus-visible:text-input-focus-text disabled:cursor-not-allowed ' +
				'disabled:border-input-disabled-border disabled:bg-input-disabled-background disabled:text-input-disabled-text disabled:hover:border-input-disabled-border disabled:hover:bg-input-disabled-background ' +
				'data-invalid:not-disabled:border-input-error-border data-invalid:not-disabled:bg-input-error-background data-invalid:not-disabled:text-input-error-text data-invalid:not-disabled:hover:border-input-error-border ' +
				'data-popup-open:border-input-focus-border data-popup-open:bg-input-focus-background data-popup-open:text-input-focus-text'
		}
	}
});

export const textInputStyles = tv({
	base: inputBaseStyles({ mode: 'input', className: 'h-10 w-full px-3 py-1.5 text-base/6' })
});

export const buttonStyles = tv({
	base: `${BUTTON_BASE} gap-xs h-9 px-sm text-sm rounded-sm`,
	variants: {
		variant: { primary: BUTTON_PRIMARY, default: BUTTON_OUTLINE, danger: classNames(BUTTON_OUTLINE, 'text-content-danger') }
	},
	defaultVariants: { variant: 'default' }
});

/** Monarch's round icon button: borderless until hovered, or faintly filled as `overlay`. */
export const iconButtonStyles = tv({
	base: `${BUTTON_BASE} rounded-round p-0`,
	variants: {
		variant: {
			default: classNames(
				BUTTON_OUTLINE,
				'border-transparent bg-transparent not-hover:not-data-pressed:shadow-none not-disabled:not-data-pressed:hover:border-border-primary-hover not-disabled:not-data-pressed:hover:bg-background-primary disabled:border-border-primary-hover'
			),
			overlay: BUTTON_OVERLAY
		},
		size: { '3xs': 'size-6', '2xs': 'size-7', xs: 'size-8', sm: 'size-9', md: 'size-10', lg: 'size-12' }
	},
	defaultVariants: { variant: 'default', size: 'sm' }
});

/** A button that looks like one of Monarch's text links. */
export const LINK_BUTTON_CLASS_NAME = 'cursor-pointer border-0 bg-transparent p-0 text-left text-content-link hover:text-content-link-hover';

/** The icon buttons in a details panel's header, like its close and more buttons. */
export const PANEL_ICON_BUTTON_CLASS_NAME = iconButtonStyles({ variant: 'overlay', size: 'sm' });

/** Monarch's dropdown menu, also the popup of its selects and comboboxes. */
export const menuStyles = tv({
	slots: {
		positioner: 'z-floating outline-none',
		popup:
			'relative flex max-h-(--available-height) origin-top flex-col overflow-hidden rounded-default border border-border-primary bg-background-primary shadow-lg transition-all duration-150 ' +
			'outline-none data-closed:scale-95 data-closed:opacity-0 data-open:scale-100 data-open:opacity-100',
		list: 'flex min-h-0 flex-col outline-none',
		scroller:
			'-mt-xs min-h-0 flex-1 scroll-pt-[max(calc(var(--mds-pinned-h,0px)+var(--spacing-xs)),1.25rem)] scroll-pb-5 overflow-x-hidden overflow-y-auto py-2xs ' +
			"before:pointer-events-none before:sticky before:-top-2xs before:block before:h-xs before:bg-transparent before:content-[''] " +
			'in-data-empty:hidden has-data-[mds$=group-label]:before:bg-background-primary [&>*+*]:mt-2xs',
		item: classNames(
			MENU_ITEM_BASE,
			'text-content-primary select-none data-checked:bg-background-info data-checked:text-content-info data-checked:data-highlighted:bg-background-info data-checked:data-highlighted:text-content-info'
		),
		itemLabel: 'min-w-0 flex-1 truncate',
		popupInputShell: 'relative z-3 shrink-0 bg-linear-to-b from-background-primary from-[calc(100%-var(--spacing-xs))] to-transparent to-[calc(100%-var(--spacing-xs))] px-2xs pt-2xs',
		popupInputField: 'w-auto'
	},
	variants: {
		popupWidth: { content: { popup: 'min-w-[8rem]' }, anchor: { popup: 'w-(--anchor-width)' } },
		variant: {
			default: {},
			destructive: { item: 'text-content-danger data-highlighted:bg-background-danger data-highlighted:text-content-danger' }
		}
	},
	defaultVariants: { popupWidth: 'content', variant: 'default' }
});

/** Monarch's select: an input-styled trigger and a menu-styled popup. */
export const selectStyles = tv({
	slots: {
		trigger: inputBaseStyles({ mode: 'button', className: 'group inline-flex w-full items-center justify-between gap-xs px-3 text-base/6' }),
		value: 'flex min-w-0 flex-1 items-center gap-xs text-left group-disabled:text-input-disabled-text data-placeholder:text-input-placeholder group-disabled:data-placeholder:text-input-disabled-text',
		valueLabel: 'min-w-0 flex-1 truncate',
		icon:
			'inline-flex shrink-0 items-center justify-center text-content-primary transition-transform duration-150 group-disabled:text-input-disabled-text ' +
			'group-data-placeholder:text-input-default-icon group-data-popup-open:rotate-180',
		positioner: 'z-floating outline-none data-anchor-hidden:invisible',
		popup: classNames(menuStyles().popup(), 'min-w-[calc(var(--anchor-width)+(2*var(--spacing-2xs)))]')
	},
	variants: {
		size: { sm: { trigger: 'h-9' }, md: { trigger: 'h-10' } },
		multiple: { true: {}, false: {} }
	},
	compoundVariants: [
		{ multiple: true, size: 'sm', class: { trigger: 'h-auto min-h-9 py-2xs' } },
		{ multiple: true, size: 'md', class: { trigger: 'h-auto min-h-10 py-2xs' } }
	],
	defaultVariants: { size: 'md', multiple: false }
});

/** A select trigger that looks like plain text in a row, without the input's border. */
export const INLINE_SELECT_TRIGGER_CLASS_NAME =
	'group -ml-1 inline-flex max-w-full cursor-pointer items-center gap-2xs rounded-sm border-0 bg-transparent px-1 py-0.5 text-sm font-book text-content-primary ' +
	'outline-none hover:bg-background-secondary-hover focus-visible:bg-background-secondary-hover';

/** Monarch's modal dialog, with a header, a scrolling body and a footer. */
export const dialogStyles = tv({
	slots: {
		backdrop: 'fixed inset-0 z-floating bg-background-modal-overlay data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0',
		viewport: 'fixed inset-0 z-floating overflow-hidden',
		viewportInner: 'flex min-h-full items-center justify-center p-gutter h-full',
		popup:
			'relative flex w-full flex-col rounded-default bg-background-primary text-content-primary shadow-md outline-none data-closed:animate-out data-closed:fade-out-0 ' +
			'data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 max-h-full min-h-0',
		header: 'flex gap-2xs border-b border-divider-primary px-xl py-default shrink-0 relative flex-row items-center justify-between border-b-border-primary bg-transparent',
		title: 'm-0 text-lg font-medium text-content-primary',
		body: 'flex min-h-0 flex-1 flex-col',
		bodyViewport: 'flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto',
		bodyContent: 'grow px-xl py-default',
		footer: 'flex items-center justify-end gap-xs border-t border-divider-primary px-xl py-default shrink-0'
	},
	variants: {
		size: { sm: { popup: 'max-w-container-sm' }, md: { popup: 'max-w-container-md' }, lg: { popup: 'max-w-container-lg' } }
	},
	defaultVariants: { size: 'lg' }
});

/** Monarch's small centered dialog for confirming an action. */
export const alertDialogStyles = tv({
	slots: {
		backdrop: 'fixed inset-0 z-floating bg-background-modal-overlay data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0',
		popup:
			'fixed top-1/2 left-1/2 z-floating flex w-full -translate-1/2 flex-col rounded-default bg-background-primary text-content-primary shadow-md outline-none ' +
			'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 max-w-container-sm',
		header: 'flex flex-col gap-2xs px-lg pt-lg pb-default',
		body: 'flex flex-col gap-xs px-lg pb-default',
		footer: 'flex items-center justify-end gap-xs px-lg pt-default pb-lg',
		title: 'm-0 text-lg font-medium text-content-primary',
		description: 'm-0 text-sm text-content-secondary'
	}
});

export const switchStyles = tv({
	slots: {
		root:
			'relative inline-flex shrink-0 cursor-pointer items-center rounded-pill border-none bg-toggle-off-background p-0.75 align-middle transition-colors outline-none ' +
			'not-data-disabled:group-active/mds-switch:shadow-inset not-data-disabled:hover:bg-toggle-off-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 ' +
			'focus-visible:outline-border-info focus-visible:outline-solid not-data-disabled:active:shadow-inset data-checked:bg-toggle-on-background ' +
			'not-data-disabled:data-checked:hover:bg-toggle-on-background-hover data-disabled:cursor-not-allowed data-disabled:opacity-50 h-5 w-10',
		thumb: 'pointer-events-none block rounded-full bg-background-primary shadow-sm transition-transform size-3.5 data-checked:translate-x-5'
	}
});

/** A form field with its label above the control. */
export const fieldStyles = tv({
	slots: {
		root: 'flex flex-col gap-xs min-w-0',
		label: 'inline-flex items-center gap-2xs text-sm/5 font-medium text-content-primary'
	}
});

export const fieldsetStyles = tv({
	slots: {
		root: 'm-0 flex min-w-0 flex-col gap-xs border-0 p-0',
		legend: 'text-base font-medium text-content-primary',
		items: 'flex flex-col gap-sm'
	}
});

/** An input box with addons inside it, like a search icon. */
export const inputGroupStyles = tv({
	slots: {
		root: [
			inputBaseStyles({ className: 'relative flex w-full items-center cursor-text' }),
			'has-[[data-input-group-control]:focus]:border-input-focus-border',
			'has-[[data-input-group-control]:focus]:bg-input-focus-background',
			'has-[[data-input-group-control]:placeholder-shown]:text-input-placeholder',
			'has-data-[align=content-start]:**:data-input-group-control:field-sizing-content',
			'has-data-[align=content-start]:**:data-input-group-control:w-auto',
			'has-data-[align=content-start]:**:data-input-group-control:grow-0',
			'has-data-[align=content-start]:**:data-input-group-control:min-w-[2ch]',
			'has-data-[align=content-start]:**:data-input-group-control:max-w-full',
			'has-data-[align=content-start]:**:data-input-group-control:ps-0',
			'has-data-[align=content-start]:overflow-hidden',
			'has-data-[align=inline-start]:**:data-input-group-control:ps-1.5'
		],
		addon: 'flex shrink-0 cursor-text items-center gap-2xs text-content-secondary select-none order-first ps-3',
		input:
			'min-w-0 grow self-stretch border-0 bg-transparent px-3 py-1.5 text-content-primary outline-0 placeholder:text-input-placeholder ' +
			'in-data-invalid:not-disabled:text-input-error-text in-data-invalid:not-disabled:placeholder:text-input-error-text'
	},
	variants: {
		size: { sm: { root: 'h-9 text-sm', input: 'text-sm' }, md: { root: 'h-10 text-base/6', input: 'text-base/6' } }
	},
	defaultVariants: { size: 'md' }
});

export const checkboxStyles = tv({
	slots: {
		box:
			'relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xs border border-border-secondary bg-background-primary align-middle text-content-white ' +
			'transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-info focus-visible:outline-solid ' +
			'not-data-disabled:active:shadow-inset data-checked:border-background-brand data-checked:bg-background-brand not-data-disabled:data-checked:hover:border-background-brand-hover ' +
			'not-data-disabled:data-checked:hover:bg-background-brand-hover not-data-disabled:data-unchecked:hover:bg-background-primary-hover data-disabled:cursor-not-allowed',
		indicator: 'inline-flex items-center justify-center data-unchecked:invisible'
	},
	variants: { size: { sm: { box: 'size-4' }, md: { box: 'size-5' } } },
	defaultVariants: { size: 'md' }
});

/** Monarch's frosted tooltip. */
export const tooltipStyles = tv({
	slots: {
		positioner: 'z-tooltip outline-none data-anchor-hidden:invisible',
		content: ['relative max-w-container-2xs rounded-default px-sm py-xs text-center text-xs/normal font-medium text-content-primary outline-none', SURFACE_ANIMATION, FROSTED_SURFACE]
	}
});

/** Monarch's popover, a bordered card that opens from a trigger. */
export const popoverStyles = tv({
	slots: {
		positioner: 'z-floating outline-none data-anchor-hidden:invisible',
		content: [
			'relative flex w-full flex-col gap-xs rounded-default text-content-primary outline-none',
			SURFACE_ANIMATION,
			'border border-border-primary-hover bg-background-primary p-default shadow-lg'
		]
	}
});

/** A label and value row in a details panel, the labels in a fixed-width column. */
export const metaRowStyles = tv({
	slots: {
		root: 'flex h-8 min-w-0 items-center gap-sm',
		label: 'text-xs font-bold text-content-secondary w-24 shrink-0',
		value: 'min-w-0 flex-1',
		text: 'block truncate text-sm font-book text-content-primary'
	}
});

/** Monarch's pill-shaped toast at the bottom of the page, with its action buttons. */
export const actionToastStyles = tv({
	slots: {
		viewport: 'pointer-events-none fixed inset-x-0 bottom-default z-toast flex flex-col items-center px-default outline-none',
		root: [
			'pointer-events-auto flex w-fit max-w-container-2xl items-center gap-default rounded-pill bg-background-frosted py-xs text-content-primary shadow-lg',
			'[backdrop-filter:var(--background-blur-frosted)] transition-[opacity,translate] duration-200 ease-out',
			'data-ending-style:pointer-events-none data-ending-style:translate-y-xs data-ending-style:opacity-0 data-limited:hidden',
			'data-starting-style:pointer-events-none data-starting-style:translate-y-xs data-starting-style:opacity-0',
			'[body:has([data-mds=dialog-backdrop],[data-mds=alert-dialog-backdrop],[data-mds=drawer-backdrop])_&]:[backdrop-filter:none]'
		],
		message: 'm-0 min-w-0 text-sm/snug font-medium text-pretty text-content-primary',
		actions: 'flex shrink-0 items-center gap-2xs',
		action: [
			'flex cursor-pointer items-center justify-center rounded-pill border-0 bg-content-primary/10 px-sm py-2xs text-sm font-medium whitespace-nowrap text-content-primary outline-none',
			'hover:bg-content-primary/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-info focus-visible:outline-solid active:bg-content-primary/25'
		]
	},
	variants: { hasActions: { true: { root: 'pr-xs pl-lg' }, false: { root: 'px-lg' } } }
});

/** The shimmering placeholder Monarch shows while data loads. */
export const skeletonStyles = tv({
	base: [
		'rounded-default bg-clip-padding shadow-none',
		'pointer-events-none shrink-0 cursor-default text-transparent select-none',
		'**:invisible before:invisible after:invisible',
		'animate-skeleton-shimmer bg-background-secondary bg-size-[200%_100%] bg-no-repeat',
		'bg-linear-to-r from-background-secondary from-0% via-background-secondary-hover via-20% to-background-secondary to-40%'
	]
});

export const spinnerStyles = tv({
	base: 'shrink-0 animation-duration-700 motion-safe:animate-spin',
	variants: {
		size: { '2xs': 'size-3.5', xs: 'size-4', sm: 'size-5', md: 'size-6', lg: 'size-8', xl: 'size-10' },
		color: { blue: 'text-tag-blue', neutral: 'text-content-secondary', inverse: 'text-background-primary' }
	},
	defaultVariants: { size: 'xl', color: 'blue' }
});
