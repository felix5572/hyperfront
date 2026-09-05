import { beforeEach, describe, expect, it, vi } from 'vitest';

const sockets = vi.hoisted(() => ({ socket: null as (EventTarget & { readyState: number }) | null }));
vi.mock('@nktkas/hyperliquid', () => ({
	HttpTransport: class {}, InfoClient: class {}, SubscriptionClient: class {},
	WebSocketTransport: class { socket = sockets.socket; }
}));
beforeEach(() => {
	vi.resetModules();
	sockets.socket = Object.assign(new EventTarget(), { readyState: 1 });
});

describe('transport connection observation', () => {
	it('reports current/open/closed/error states and removes listeners on disposal', async () => {
		const { observeConnection } = await import('./client');
		const callback = vi.fn();
		const dispose = observeConnection(callback);
		expect(callback).toHaveBeenLastCalledWith(true);
		sockets.socket!.dispatchEvent(new Event('close'));
		expect(callback).toHaveBeenLastCalledWith(false);
		sockets.socket!.dispatchEvent(new Event('open'));
		expect(callback).toHaveBeenLastCalledWith(true);
		sockets.socket!.dispatchEvent(new Event('error'));
		expect(callback).toHaveBeenLastCalledWith(false);
		dispose();
		sockets.socket!.dispatchEvent(new Event('open'));
		expect(callback).toHaveBeenCalledTimes(4);
	});
});
