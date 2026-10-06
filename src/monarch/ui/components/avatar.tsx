import { savedLogoUrl } from '../savedLogoUrl';
import { BuildingIcon } from './icons';

export type AvatarIcon = { kind: 'logo'; url: string } | { kind: 'emoji'; value: string };

/** A name, and the icon shown in place of its first letter. */
export interface AvatarSource {
	name: string;
	icon?: AvatarIcon;
}

export interface AvatarProps {
	source: AvatarSource;
	/** In 4px spacing units, or "fill" to take its container's size. */
	size?: number | 'fill';
}

const SPACING_UNIT_REM = 0.25;
const MERCHANT_LOGO_SIZE = 20;

/** A recurring item's round icon: its saved logo, else its emoji, else its name's first letter. */
export function Avatar({ source, size = 8 }: AvatarProps) {
	const isFilling = size === 'fill';
	const circleClassName = `flex shrink-0 items-center justify-center overflow-hidden rounded-full${isFilling ? ' size-full' : ''}`;
	const circleSize = isFilling ? undefined : { width: `${size * SPACING_UNIT_REM}rem`, height: `${size * SPACING_UNIT_REM}rem` };
	const emojiFontSize = isFilling ? 20 : size * 2;

	const logoUrl = savedLogoUrl(source.icon?.kind === 'logo' ? source.icon.url : undefined);
	if (logoUrl) {
		return (
			<div className={`${circleClassName} bg-background-primary`} style={circleSize} aria-hidden="true">
				<img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
			</div>
		);
	}

	return (
		<div className={`${circleClassName} bg-background-tertiary`} style={circleSize} aria-hidden="true">
			{source.icon?.kind === 'emoji' ? (
				<span style={{ fontSize: emojiFontSize, lineHeight: 1 }}>{source.icon.value}</span>
			) : (
				<span className="text-sm font-medium text-content-secondary">{(source.name.trim()[0] ?? '?').toUpperCase()}</span>
			)}
		</div>
	);
}

export interface SmallAvatarProps {
	name: string;
	logoUrl?: string | null;
}

export interface MerchantLogoProps {
	url?: string;
}

/** Monarch's 20px avatar: the logo, else up to two initials. */
export function SmallAvatar({ name, logoUrl }: SmallAvatarProps) {
	const initials = name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map(word => word[0] ?? '')
		.join('');

	return (
		<span
			data-mds="avatar"
			aria-hidden="true"
			className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-round bg-background-secondary align-middle ring-1 ring-avatar-border select-none ring-inset size-5"
		>
			{logoUrl ? (
				<img alt="" data-mds="avatar-image" src={logoUrl} className="size-full object-cover" />
			) : (
				<span data-mds="avatar-fallback" className="flex size-full items-center justify-center font-medium text-content-secondary uppercase text-2xs">
					{initials}
				</span>
			)}
		</span>
	);
}

/** A merchant's round 20px logo, or a building icon when it has none. */
export function MerchantLogo({ url }: MerchantLogoProps) {
	return (
		<div
			className={`flex shrink-0 items-center justify-center rounded-full bg-cover bg-center ring-1 ring-avatar-border ring-inset ${url ? '' : 'bg-(--gray-5)'}`}
			style={{ width: MERCHANT_LOGO_SIZE, height: MERCHANT_LOGO_SIZE, backgroundImage: url ? `url(${JSON.stringify(url)})` : undefined }}
		>
			{url ? null : <BuildingIcon size={MERCHANT_LOGO_SIZE / 2} />}
		</div>
	);
}
