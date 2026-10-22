import net from 'node:net';

/** Firefox's preferences for a remote debugging server that installs add-ons without asking. */
export const FIREFOX_DEBUGGING_PREFS = {
	'devtools.debugger.remote-enabled': true,
	'devtools.debugger.prompt-connection': false,
	'devtools.chrome.enabled': true,
	// Grants the content scripts' sites at install, as a user accepting the install prompt would.
	'extensions.originControls.grantByDefault': true
};

interface DebuggerMessage {
	from: string;
	error?: string;
	message?: string;
	[key: string]: unknown;
}

/**
 * Playwright can't load extensions into Firefox, so this installs the build as a temporary add-on over Firefox's remote
 * debugging protocol, where each message is its byte length, a colon, then JSON.
 */
export async function installTemporaryAddon(port: number, addonPath: string): Promise<void> {
	const socket = await connect(port);
	const replies = new Map<string, (message: DebuggerMessage) => void>();
	let buffer = Buffer.alloc(0);
	socket.on('data', (chunk: Buffer) => {
		buffer = Buffer.concat([buffer, chunk]);
		for (let colon = buffer.indexOf(':'); colon >= 0; colon = buffer.indexOf(':')) {
			const length = Number(buffer.subarray(0, colon).toString());
			if (buffer.length < colon + 1 + length) return;
			const message: DebuggerMessage = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length).toString());
			buffer = buffer.subarray(colon + 1 + length);
			replies.get(message.from)?.(message);
			replies.delete(message.from);
		}
	});
	const reply = (actor: string) => new Promise<DebuggerMessage>(resolve => replies.set(actor, resolve));
	const send = async (actor: string, request: Record<string, unknown>) => {
		const answered = reply(actor);
		const json = JSON.stringify({ to: actor, ...request });
		socket.write(`${Buffer.byteLength(json)}:${json}`);
		const message = await answered;
		if (message.error) throw new Error(`Firefox's ${request.type} failed: ${message.error} ${message.message ?? ''}`);
		return message;
	};

	try {
		await reply('root');
		const root = await send('root', { type: 'getRoot' });
		await send(root.addonsActor as string, { type: 'installTemporaryAddon', addonPath });
	} finally {
		socket.end();
	}
}

/** The server starts with Firefox, so the first attempts can come before it's listening. */
async function connect(port: number): Promise<net.Socket> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await new Promise<net.Socket>((resolve, reject) => {
				const socket = net.connect(port, '127.0.0.1', () => resolve(socket));
				socket.once('error', reject);
			});
		} catch (error) {
			if (attempt >= 50) throw error;
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	}
}
