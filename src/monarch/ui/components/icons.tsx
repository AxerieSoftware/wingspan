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

/** Monarch's refresh arrows, as on its Refresh all button. */
export function RefreshIcon() {
	return (
		<svg data-mds="icon" viewBox="0 0 24 24" fill="none" width="16" height="16" className="shrink-0" aria-hidden="true">
			<g transform="translate(24 0) scale(-1 1)">
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M21 1C21.5523 1 22 1.44772 22 2V8C22 8.55228 21.5523 9 21 9H15C14.4477 9 14 8.55228 14 8C14 7.44772 14.4477 7 15 7H18.3941L17.3333 6.04534C17.3329 6.04498 17.3325 6.04462 17.3321 6.04426C16.1817 5.01572 14.7584 4.34184 13.2337 4.10388C11.7084 3.86582 10.1468 4.07415 8.73734 4.70373C7.32784 5.33331 6.13059 6.35725 5.29 7.65204C4.44942 8.94683 4.00141 10.4572 4 12.0009C3.9995 12.5532 3.55137 13.0005 2.99909 13C2.4468 12.9995 1.9995 12.5514 2 11.9991C2.00176 10.0694 2.56178 8.18149 3.61251 6.563C4.66324 4.94451 6.1598 3.66459 7.92168 2.87761C9.68356 2.09064 11.6355 1.83023 13.5421 2.1278C15.4486 2.42536 17.2284 3.26819 18.6667 4.55463L18.669 4.55669L20 5.75463V2C20 1.44772 20.4477 1 21 1Z"
					fill="currentColor"
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M21.0009 11C21.5532 11.0005 22.0005 11.4486 22 12.0009C21.9982 13.9306 21.4382 15.8185 20.3875 17.437C19.3368 19.0555 17.8402 20.3354 16.0783 21.1224C14.3164 21.9093 12.3645 22.1698 10.4579 21.8722C8.55136 21.5746 6.77161 20.7318 5.33333 19.4454L5.33103 19.4433L4 18.2454V22C4 22.5523 3.55228 23 3 23C2.44772 23 2 22.5523 2 22V16C2 15.4477 2.44772 15 3 15H9C9.55228 15 10 15.4477 10 16C10 16.5523 9.55228 17 9 17H5.60596L6.66667 17.9546C6.66704 17.955 6.66742 17.9553 6.6678 17.9557C7.81822 18.9842 9.24159 19.6581 10.7663 19.8961C12.2916 20.1342 13.8532 19.9258 15.2627 19.2963C16.6722 18.6667 17.8694 17.6427 18.71 16.3479C19.5506 15.0532 19.9986 13.5428 20 11.9991C20.0005 11.4468 20.4486 10.9995 21.0009 11Z"
					fill="currentColor"
				/>
			</g>
		</svg>
	);
}

/** Monarch's bell, which leads a toast about an update. */
export function BellIcon() {
	return (
		<svg data-mds="icon" viewBox="0 0 24 24" fill="none" width="16" height="16" className="shrink-0" aria-hidden="true">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.05025 3.05025C8.36301 1.7375 10.1435 1 12 1C13.8565 1 15.637 1.7375 16.9497 3.05025C18.2625 4.36301 19 6.14349 19 8C19 11.3527 19.7171 13.4346 20.3779 14.6461C20.7097 15.2544 21.0328 15.6535 21.2572 15.8904C21.3697 16.0091 21.4581 16.0878 21.5113 16.1322C21.5379 16.1544 21.5558 16.168 21.5635 16.1737C21.5647 16.1746 21.5656 16.1753 21.5663 16.1758C21.9248 16.4221 22.0834 16.8725 21.9571 17.2898C21.8294 17.7115 21.4407 18 21 18H3C2.55933 18 2.17061 17.7115 2.04291 17.2898C1.91657 16.8725 2.07521 16.4221 2.43369 16.1758C2.43439 16.1753 2.43535 16.1746 2.43655 16.1737C2.44425 16.168 2.4621 16.1544 2.48872 16.1322C2.54194 16.0878 2.63032 16.0091 2.7428 15.8904C2.96723 15.6535 3.29031 15.2544 3.62211 14.6461C4.28293 13.4346 5 11.3527 5 8C5 6.14348 5.7375 4.36301 7.05025 3.05025ZM2.4438 16.169C2.44388 16.1689 2.44396 16.1688 2.44404 16.1688C2.44403 16.1688 2.44403 16.1688 2.44402 16.1688L2.4438 16.169ZM5.14933 16H18.8507C18.7746 15.8753 18.6982 15.7434 18.6221 15.6039C17.7829 14.0654 17 11.6473 17 8C17 6.67392 16.4732 5.40215 15.5355 4.46447C14.5979 3.52678 13.3261 3 12 3C10.6739 3 9.40215 3.52678 8.46447 4.46447C7.52679 5.40215 7 6.67392 7 8C7 11.6473 6.21707 14.0654 5.3779 15.6039C5.3018 15.7434 5.22541 15.8753 5.14933 16ZM9.76823 20.135C10.246 19.8579 10.8579 20.0205 11.135 20.4982C11.2229 20.6498 11.3491 20.7756 11.5009 20.863C11.6527 20.9504 11.8248 20.9965 12 20.9965C12.1752 20.9965 12.3473 20.9504 12.4991 20.863C12.6509 20.7756 12.7771 20.6498 12.865 20.4982C13.1421 20.0205 13.754 19.8579 14.2318 20.135C14.7095 20.4121 14.8721 21.024 14.595 21.5018C14.3313 21.9564 13.9528 22.3337 13.4973 22.5961C13.0419 22.8584 12.5256 22.9965 12 22.9965C11.4744 22.9965 10.9581 22.8584 10.5027 22.5961C10.0472 22.3337 9.66872 21.9564 9.405 21.5018C9.12788 21.024 9.2905 20.4121 9.76823 20.135Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Monarch's circled question mark, which leads a toast that asks for an action. */
export function HelpCircleIcon() {
	return (
		<svg data-mds="icon" viewBox="0 0 24 24" fill="none" width="16" height="16" className="shrink-0" aria-hidden="true">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3ZM1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12ZM12.2581 8.02428C11.7926 7.94443 11.3138 8.03191 10.9066 8.27123C10.4994 8.51054 10.1901 8.88625 10.0333 9.33181C9.85006 9.85279 9.27914 10.1266 8.75815 9.9433C8.23716 9.76002 7.96339 9.18911 8.14666 8.66812C8.46013 7.77701 9.07886 7.02559 9.89327 6.54696C10.7077 6.06833 11.6652 5.89337 12.5962 6.05307C13.5273 6.21277 14.3717 6.69682 14.9801 7.41949C15.5883 8.14201 15.9213 9.05644 15.92 10.0009C15.9195 11.5312 14.7849 12.5419 13.9747 13.082C13.5391 13.3724 13.1105 13.586 12.7949 13.7263C12.6356 13.7971 12.5015 13.8508 12.4049 13.8876C12.3565 13.906 12.3173 13.9203 12.2887 13.9305L12.254 13.9426L12.2429 13.9464L12.239 13.9477L12.2375 13.9482C12.2372 13.9483 12.2362 13.9486 12.2362 13.9486C11.7123 14.1233 11.146 13.8401 10.9713 13.3162C10.7968 12.7926 11.0794 12.2267 11.6027 12.0516L11.6187 12.046C11.6341 12.0406 11.6593 12.0314 11.6929 12.0186C11.7603 11.9929 11.8606 11.9529 11.9826 11.8986C12.2294 11.7889 12.5509 11.6275 12.8653 11.4179C13.5549 10.9582 13.92 10.4691 13.92 9.99996L13.92 9.99847C13.9207 9.52615 13.7542 9.06883 13.45 8.70749C13.1459 8.34615 12.7236 8.10413 12.2581 8.02428ZM12 16C11.4477 16 11 16.4477 11 17C11 17.5523 11.4477 18 12 18H12.01C12.5623 18 13.01 17.5523 13.01 17C13.01 16.4477 12.5623 16 12.01 16H12Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Monarch's circled "i": small beside a label, or 16 pixels at the start of an info banner. */
export function InfoIcon({ size = 12 }: { size?: number }) {
	return (
		<svg data-mds="icon" viewBox="0 0 24 24" fill="none" width={size} height={size} className="shrink-0" aria-hidden="true">
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
