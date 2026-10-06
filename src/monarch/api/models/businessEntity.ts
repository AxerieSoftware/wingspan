export interface BusinessEntity {
	id: string;
	name: string;
	/** A picture the household uploaded, shown in place of the colored folder. */
	logoUrl: string | null;
	/** One of Monarch's logo colors, given as its light background color, e.g. "#ffc9b1". */
	color: string | null;
}
