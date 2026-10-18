import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CDPSession, Page } from '@playwright/test';

const JPEG_QUALITY = 92;
const FRAMES_PER_SECOND = 30;

/** The video's size in pixels, which must match the page's viewport, since Chrome's screencast captures at that size. */
export interface VideoSize {
	width: number;
	height: number;
}

interface Frame {
	path: string;
	timestamp: number;
}

/**
 * Records a page from Chrome's screencast, which keeps text sharp where Playwright's own video is soft, then encodes it
 * with ffmpeg.
 */
export class ScreencastRecorder {
	private readonly frames: Frame[] = [];
	private session: CDPSession | null = null;

	public constructor(
		private readonly framesDir: string,
		private readonly size: VideoSize
	) {}

	public async start(page: Page): Promise<void> {
		mkdirSync(this.framesDir, { recursive: true });
		const session = await page.context().newCDPSession(page);
		session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
			const path = join(this.framesDir, `${String(this.frames.length).padStart(5, '0')}.jpg`);
			writeFileSync(path, Buffer.from(data, 'base64'));
			this.frames.push({ path, timestamp: metadata.timestamp ?? Date.now() / 1000 });
			void session.send('Page.screencastFrameAck', { sessionId });
		});
		await session.send('Page.startScreencast', { format: 'jpeg', quality: JPEG_QUALITY, maxWidth: this.size.width, maxHeight: this.size.height });
		this.session = session;
	}

	/** Stops recording and writes the MP4, each frame held until the next one arrived. */
	public async save(videoPath: string): Promise<void> {
		// Chrome sends a frame only when the page changes, so the last one is held until recording stops.
		const stoppedAt = Date.now() / 1000;
		await this.session?.send('Page.stopScreencast');
		const lines = this.frames.flatMap((frame, index) => {
			const next = this.frames[index + 1];
			const seconds = (next?.timestamp ?? stoppedAt) - frame.timestamp;
			return [`file '${frame.path}'`, `duration ${seconds.toFixed(4)}`];
		});
		// ffmpeg's concat list ignores the last duration unless the last file is listed again.
		const lastFrame = this.frames.at(-1);
		if (lastFrame) lines.push(`file '${lastFrame.path}'`);
		const listPath = join(this.framesDir, 'frames.txt');
		writeFileSync(listPath, lines.join('\n'));

		const { width, height } = this.size;
		mkdirSync(dirname(videoPath), { recursive: true });
		const scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:white`;
		execFileSync('ffmpeg', [
			'-y',
			'-loglevel',
			'error',
			'-f',
			'concat',
			'-safe',
			'0',
			'-i',
			listPath,
			'-vf',
			`${scale},fps=${FRAMES_PER_SECOND}`,
			'-c:v',
			'libx264',
			'-crf',
			'16',
			'-preset',
			'slow',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'+faststart',
			videoPath
		]);
	}

	/** Saves the video's frame at `atSeconds` as a JPEG, for a player to show before it plays. */
	public savePoster(videoPath: string, posterPath: string, atSeconds: number): void {
		execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(atSeconds), '-i', videoPath, '-frames:v', '1', '-q:v', '3', posterPath]);
	}
}
