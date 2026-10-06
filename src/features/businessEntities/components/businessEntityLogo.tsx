import type { BusinessEntity } from '../../../monarch/api/models/businessEntity';
import { MonarchIcon } from '../../../monarch/ui/components/icons';
import { type MonarchTheme, useMonarchTheme } from '../../../monarch/ui/hooks/useMonarchTheme';
import { savedLogoUrl } from '../../../monarch/ui/savedLogoUrl';

type Themed = Record<MonarchTheme, string>;

/** Monarch's logo colors, keyed by a business's saved light background color: the tile background and the folder color. */
const LOGO_COLORS: Record<string, { background: Themed; icon: Themed }> = {
	'#ffc9b1': { background: { light: '#ffc9b1', dark: '#5B230D' }, icon: { light: '#D64700', dark: '#FF9B73' } },
	'#e2f0bd': { background: { light: '#e2f0bd', dark: '#29371d' }, icon: { light: '#5c7c2f', dark: '#bde56c' } },
	'#b8eae0': { background: { light: '#b8eae0', dark: '#084843' }, icon: { light: '#008573', dark: '#0BD8B6' } },
	'#b5e9f0': { background: { light: '#b5e9f0', dark: '#004558' }, icon: { light: '#107d98', dark: '#4ccce6' } },
	'#d2deff': { background: { light: '#d2deff', dark: '#253974' }, icon: { light: '#3a5bc7', dark: '#9eb1ff' } },
	'#ead5f9': { background: { light: '#ead5f9', dark: '#48295c' }, icon: { light: '#8145b5', dark: '#d19dff' } },
	'#f6cee7': { background: { light: '#f6cee7', dark: '#591c47' }, icon: { light: '#c2298a', dark: '#ff8dcc' } },
	'#ebdaca': { background: { light: '#ebdaca', dark: '#3E3128' }, icon: { light: '#815E46', dark: '#DBB594' } }
};
const HOUSEHOLD_COLORS = { background: { light: '#efece9', dark: '#222221' }, icon: { light: '#8f8c8a', dark: '#6f6d68' } };
const BORDER: Themed = { light: 'rgb(0 0 0 / 0.2)', dark: 'rgb(255 255 255 / 0.1)' };
const LOGO_SIZE = 20;
const ICON_SIZE = 12;

/** Colors follow the business's saved color and Monarch's light or dark theme. */
export interface BusinessEntityLogoProps {
	/** None for Household. */
	business: Pick<BusinessEntity, 'logoUrl' | 'color'> | null;
}

/** Monarch's small business logo, as its filter shows it: the uploaded image, or a folder on the business's color. Household gets a house. */
export function BusinessEntityLogo({ business }: BusinessEntityLogoProps) {
	const theme = useMonarchTheme();
	const colors = business ? LOGO_COLORS[business.color?.toLowerCase() ?? ''] : HOUSEHOLD_COLORS;
	const logoUrl = savedLogoUrl(business?.logoUrl ?? undefined);
	return (
		<span
			data-external-id="business-entity-logo"
			className="flex shrink-0 items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat"
			style={{
				width: LOGO_SIZE,
				borderRadius: 4,
				height: LOGO_SIZE,
				backgroundImage: logoUrl ? `url("${logoUrl}")` : undefined,
				backgroundColor: logoUrl ? undefined : (colors?.background[theme] ?? business?.color ?? undefined),
				color: colors?.icon[theme] ?? 'var(--content-primary)',
				boxShadow: `inset 0 0 0 1px ${BORDER[theme]}`
			}}
		>
			{logoUrl ? null : <MonarchIcon name={business ? 'folder-filled' : 'home-filled'} size={ICON_SIZE} />}
		</span>
	);
}
