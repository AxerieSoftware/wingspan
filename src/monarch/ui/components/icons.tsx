import type { ReactNode } from 'react';

const ICON_SHAPES = {
	check: <polyline points="20 6 9 17 4 12" />,
	calendar: (
		<>
			<rect x="3" y="4" width="18" height="18" rx="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</>
	),
	alert: (
		<>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</>
	),
	mark: (
		<>
			<line x1="12" y1="7" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</>
	),
	cross: (
		<>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</>
	),
	pencil: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
} satisfies Record<string, ReactNode>;

export type IconShape = keyof typeof ICON_SHAPES;

/** An icon shape and its size in pixels. */
export interface IconProps {
	shape: IconShape;
	size: number;
	className?: string;
}

/** The icon's size in pixels. */
export interface BuildingIconProps {
	size: number;
}

/** The icon's size in pixels, 12 by default. */
export interface CheckIconProps {
	size?: number;
}

/** A simple stroked icon in the text color. Below 12px its strokes thicken to stay visible. */
export function Icon({ shape, size, className }: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth={size < 12 ? 3.5 : 2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={className}
		>
			{ICON_SHAPES[shape]}
		</svg>
	);
}

export interface TrendIconProps {
	isUp: boolean;
}

/** Monarch's trend arrow: up and to the right, or down and to the right. */
export function TrendIcon({ isUp }: TrendIconProps) {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true" className={isUp ? undefined : 'rotate-90'}>
			<path
				d="M8 6C7.44772 6 7 6.44772 7 7C7 7.55228 7.44772 8 8 8H14.5858L6.29289 16.2929C5.90237 16.6834 5.90237 17.3166 6.29289 17.7071C6.68342 18.0976 7.31658 18.0976 7.70711 17.7071L16 9.41421V16C16 16.5523 16.4477 17 17 17C17.5523 17 18 16.5523 18 16V7C18 6.44772 17.5523 6 17 6H8Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
			<path
				fill="currentColor"
				d="M18.7071 6.70711C19.0976 6.31658 19.0976 5.68342 18.7071 5.29289C18.3166 4.90237 17.6834 4.90237 17.2929 5.29289L12 10.5858L6.70711 5.29289C6.31658 4.90237 5.68342 4.90237 5.29289 5.29289C4.90237 5.68342 4.90237 6.31658 5.29289 6.70711L10.5858 12L5.29289 17.2929C4.90237 17.6834 4.90237 18.3166 5.29289 18.7071C5.68342 19.0976 6.31658 19.0976 6.70711 18.7071L12 13.4142L17.2929 18.7071C17.6834 19.0976 18.3166 19.0976 18.7071 18.7071C19.0976 18.3166 19.0976 17.6834 18.7071 17.2929L13.4142 12L18.7071 6.70711Z"
			/>
		</svg>
	);
}

/** Monarch's down chevron, for selects and menu buttons. */
export function ChevronIcon() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L12 13.5858L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289C19.0976 8.68342 19.0976 9.31658 18.7071 9.70711L12.7071 15.7071C12.3166 16.0976 11.6834 16.0976 11.2929 15.7071L5.29289 9.70711C4.90237 9.31658 4.90237 8.68342 5.29289 8.29289Z"
			/>
		</svg>
	);
}

/** Monarch's own icons, by their code in the icon font its page loads. */
const MONARCH_GLYPHS = { check: 61710, folder: 61842, 'folder-filled': 61880, 'home-filled': 61732 } as const;

/** A glyph from Monarch's icon font and its size in pixels. */
export interface MonarchIconProps {
	name: keyof typeof MONARCH_GLYPHS;
	size: number;
	className?: string;
}

/** One of Monarch's icon font glyphs. It only draws on pages where Monarch has loaded the font. */
export function MonarchIcon({ name, size, className }: MonarchIconProps) {
	return (
		<span
			aria-hidden="true"
			className={className}
			style={{ fontFamily: 'MonarchIcons, sans-serif', fontSize: size, lineHeight: `${size}px`, width: size, height: size, flexShrink: 0, WebkitFontSmoothing: 'antialiased' }}
		>
			{String.fromCharCode(MONARCH_GLYPHS[name])}
		</span>
	);
}

/** A bold check mark, as in Monarch's checkboxes. */
export function CheckIcon({ size = 12 }: CheckIconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M20 6 9 17l-5-5" />
		</svg>
	);
}

/** Three dots in a row, for a more-options menu. */
export function MoreIcon() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true" className="shrink-0">
			<circle cx="5" cy="12" r="2" fill="currentColor" />
			<circle cx="12" cy="12" r="2" fill="currentColor" />
			<circle cx="19" cy="12" r="2" fill="currentColor" />
		</svg>
	);
}

/** Monarch's filter icon: three lines, each shorter than the last. */
export function FilterIcon() {
	return (
		<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true" className="shrink-0 text-content-secondary">
			<path fill="currentColor" d="M2 6C2 5.44772 2.44772 5 3 5H21C21.5523 5 22 5.44772 22 6C22 6.55228 21.5523 7 21 7H3C2.44772 7 2 6.55228 2 6Z" />
			<path fill="currentColor" d="M6 12C6 11.4477 6.44772 11 7 11H17C17.5523 11 18 11.4477 18 12C18 12.5523 17.5523 13 17 13H7C6.44772 13 6 12.5523 6 12Z" />
			<path fill="currentColor" d="M10 17C9.44772 17 9 17.4477 9 18C9 18.5523 9.44772 19 10 19H14C14.5523 19 15 18.5523 15 18C15 17.4477 14.5523 17 14 17H10Z" />
		</svg>
	);
}

/** A large green filled check circle, for something done. */
export function CheckCircleFilledIcon() {
	return (
		<svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true" className="shrink-0 text-content-success">
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23ZM15.7071 9.29289C16.0976 9.68342 16.0976 10.3166 15.7071 10.7071L11.7071 14.7071C11.3166 15.0976 10.6834 15.0976 10.2929 14.7071L8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929C8.68342 10.9024 9.31658 10.9024 9.70711 11.2929L11 12.5858L14.2929 9.29289C14.6834 8.90237 15.3166 8.90237 15.7071 9.29289Z"
			/>
		</svg>
	);
}

/** Monarch's building icon, the fallback for a merchant with no logo. */
export function BuildingIcon({ size }: BuildingIconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" className="shrink-0 text-content-secondary">
			<path fill="currentColor" d="M8 5C7.44772 5 7 5.44772 7 6C7 6.55228 7.44772 7 8 7H8.01C8.56228 7 9.01 6.55228 9.01 6C9.01 5.44772 8.56228 5 8.01 5H8Z" />
			<path fill="currentColor" d="M15 6C15 5.44772 15.4477 5 16 5H16.01C16.5623 5 17.01 5.44772 17.01 6C17.01 6.55228 16.5623 7 16.01 7H16C15.4477 7 15 6.55228 15 6Z" />
			<path fill="currentColor" d="M12 5C11.4477 5 11 5.44772 11 6C11 6.55228 11.4477 7 12 7H12.01C12.5623 7 13.01 6.55228 13.01 6C13.01 5.44772 12.5623 5 12.01 5H12Z" />
			<path fill="currentColor" d="M11 10C11 9.44771 11.4477 9 12 9H12.01C12.5623 9 13.01 9.44771 13.01 10C13.01 10.5523 12.5623 11 12.01 11H12C11.4477 11 11 10.5523 11 10Z" />
			<path fill="currentColor" d="M12 13C11.4477 13 11 13.4477 11 14C11 14.5523 11.4477 15 12 15H12.01C12.5623 15 13.01 14.5523 13.01 14C13.01 13.4477 12.5623 13 12.01 13H12Z" />
			<path fill="currentColor" d="M15 10C15 9.44771 15.4477 9 16 9H16.01C16.5623 9 17.01 9.44771 17.01 10C17.01 10.5523 16.5623 11 16.01 11H16C15.4477 11 15 10.5523 15 10Z" />
			<path fill="currentColor" d="M16 13C15.4477 13 15 13.4477 15 14C15 14.5523 15.4477 15 16 15H16.01C16.5623 15 17.01 14.5523 17.01 14C17.01 13.4477 16.5623 13 16.01 13H16Z" />
			<path fill="currentColor" d="M7 10C7 9.44771 7.44772 9 8 9H8.01C8.56228 9 9.01 9.44771 9.01 10C9.01 10.5523 8.56228 11 8.01 11H8C7.44772 11 7 10.5523 7 10Z" />
			<path fill="currentColor" d="M8 13C7.44772 13 7 13.4477 7 14C7 14.5523 7.44772 15 8 15H8.01C8.56228 15 9.01 14.5523 9.01 14C9.01 13.4477 8.56228 13 8.01 13H8Z" />
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M18 23H6C4.34315 23 3 21.6569 3 20V4C3 2.34315 4.34315 1 6 1H18C19.6569 1 21 2.34315 21 4V20C21 21.6569 19.6569 23 18 23ZM6 3C5.44772 3 5 3.44772 5 4V20C5 20.5523 5.44772 21 6 21H8V18C8 17.4477 8.44772 17 9 17H15C15.5523 17 16 17.4477 16 18V21H18C18.5523 21 19 20.5523 19 20V4C19 3.44772 18.5523 3 18 3H6ZM14 21V19H10V21H14Z"
			/>
		</svg>
	);
}

export function SearchIcon() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true" className="shrink-0">
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M16.6176 18.032C15.078 19.2635 13.125 20 11 20C6.02944 20 2 15.9706 2 11C2 6.02944 6.02944 2 11 2C15.9706 2 20 6.02944 20 11C20 13.125 19.2635 15.0781 18.0318 16.6178L21.707 20.2929C22.0975 20.6834 22.0975 21.3166 21.707 21.7071C21.3165 22.0977 20.6833 22.0977 20.2928 21.7071L16.6176 18.032ZM4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11C18 12.8858 17.2543 14.5975 16.0416 15.8562C16.0072 15.8826 15.9742 15.9115 15.9428 15.9429C15.9114 15.9744 15.8825 16.0074 15.8561 16.0417C14.5974 17.2543 12.8858 18 11 18C7.13401 18 4 14.866 4 11Z"
			/>
		</svg>
	);
}

/** Monarch's small circled "i", for a hint beside a label. */
export function InfoIcon() {
	return (
		<svg data-mds="icon" viewBox="0 0 24 24" fill="none" width="12" height="12" className="shrink-0" aria-hidden="true">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3ZM1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12ZM12 11C12.5523 11 13 11.4477 13 12V16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16V12C11 11.4477 11.4477 11 12 11ZM12 7C11.4477 7 11 7.44772 11 8C11 8.55228 11.4477 9 12 9H12.01C12.5623 9 13.01 8.55228 13.01 8C13.01 7.44772 12.5623 7 12.01 7H12Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export function EditIcon() {
	return (
		<svg data-mds="icon" viewBox="0 0 24 24" fill="none" width="16" height="16" className="shrink-0" aria-hidden="true">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M18 4.17163C17.7599 4.17163 17.5221 4.21892 17.3003 4.31081C17.0785 4.4027 16.8769 4.53738 16.7071 4.70716L5.39491 16.0194L4.42524 19.5748L7.9807 18.6052L19.2929 7.29295C19.4627 7.12317 19.5974 6.9216 19.6893 6.69977C19.7812 6.47793 19.8284 6.24017 19.8284 6.00006C19.8284 5.75994 19.7812 5.52218 19.6893 5.30035C19.5974 5.07852 19.4627 4.87695 19.2929 4.70716C19.1231 4.53738 18.9216 4.4027 18.6997 4.31081C18.4779 4.21892 18.2401 4.17163 18 4.17163ZM16.5349 2.46305C16.9994 2.27066 17.4973 2.17163 18 2.17163C18.5028 2.17163 19.0006 2.27066 19.4651 2.46305C19.9296 2.65545 20.3516 2.93745 20.7071 3.29295C21.0626 3.64845 21.3446 4.07049 21.537 4.53498C21.7294 4.99947 21.8284 5.4973 21.8284 6.00006C21.8284 6.50281 21.7294 7.00064 21.537 7.46513C21.3446 7.92962 21.0626 8.35166 20.7071 8.70716L9.20713 20.2072C9.08407 20.3302 8.93104 20.419 8.76314 20.4648L3.26314 21.9648C2.91693 22.0592 2.54667 21.9609 2.29292 21.7072C2.03917 21.4534 1.94084 21.0832 2.03526 20.7369L3.53526 15.2369C3.58105 15.069 3.66986 14.916 3.79292 14.793L15.2929 3.29295C15.6484 2.93745 16.0705 2.65545 16.5349 2.46305Z"
				fill="currentColor"
			/>
		</svg>
	);
}
