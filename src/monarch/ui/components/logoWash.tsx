import { useEffect, useState } from 'react';

const NEUTRAL_RGB = '26, 22, 22';
const SAMPLE_SIZE = 16;
const OPAQUE_ALPHA = 128;
/** Cached per logo, since the details panel shows the same logos repeatedly. */
const washRgbByLogoUrl = new Map<string, Promise<string>>();

/** With no logo, the gradient uses a neutral color. */
export interface LogoWashProps {
	logoUrl: string | null;
}

/** The gradient across the top of Monarch's recurring details panel, tinted with the logo's average color. */
export function LogoWash({ logoUrl }: LogoWashProps) {
	const [washRgb, setWashRgb] = useState(NEUTRAL_RGB);

	useEffect(() => {
		let isCurrent = true;
		if (logoUrl) {
			const washRgbOfLogo = washRgbByLogoUrl.get(logoUrl) ?? averageLogoColor(logoUrl);
			washRgbByLogoUrl.set(logoUrl, washRgbOfLogo);
			washRgbOfLogo.then(
				averageRgb => isCurrent && setWashRgb(averageRgb),
				() => isCurrent && setWashRgb(NEUTRAL_RGB)
			);
		} else {
			setWashRgb(NEUTRAL_RGB);
		}

		return () => {
			isCurrent = false;
		};
	}, [logoUrl]);

	return (
		<div
			aria-hidden="true"
			data-external-id="recurrence-group-gradient-backdrop"
			className="pointer-events-none absolute inset-x-0 top-0 h-32.5"
			style={{ backgroundImage: `linear-gradient(rgba(${washRgb}, 0.14), rgba(${washRgb}, 0))` }}
		/>
	);
}

function averageLogoColor(logoUrl: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const logoImage = new Image();
		logoImage.crossOrigin = 'anonymous';
		logoImage.onerror = reject;
		logoImage.onload = () => {
			const canvasEl = document.createElement('canvas');
			canvasEl.width = canvasEl.height = SAMPLE_SIZE;

			const canvasContext = canvasEl.getContext('2d');
			if (!canvasContext) return reject(new Error('Canvas is unavailable.'));

			canvasContext.drawImage(logoImage, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
			const pixelData = canvasContext.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

			let red = 0;
			let green = 0;
			let blue = 0;
			let opaquePixels = 0;
			for (let offset = 0; offset < pixelData.length; offset += 4) {
				if ((pixelData[offset + 3] ?? 0) < OPAQUE_ALPHA) continue;

				red += pixelData[offset] ?? 0;
				green += pixelData[offset + 1] ?? 0;
				blue += pixelData[offset + 2] ?? 0;
				opaquePixels += 1;
			}

			if (!opaquePixels) return reject(new Error('Logo is transparent.'));
			resolve(`${Math.round(red / opaquePixels)}, ${Math.round(green / opaquePixels)}, ${Math.round(blue / opaquePixels)}`);
		};
		logoImage.src = logoUrl;
	});
}
