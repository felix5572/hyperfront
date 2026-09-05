import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const sdk = vi.hoisted(() => ({ openOrders: vi.fn() }));
vi.mock('./client', () => ({ subscriptionClient: sdk }));
const user = '0x1111111111111111111111111111111111111111';
const key = `openOrders:${user}:xyz`;

function handle() {
	const controller = new AbortController();
	return { unsubscribe: vi.fn(async () => {}), failureSignal: controller.signal, controller };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { resolve, promise };
}

beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); });

describe('subscription lifecycle', () => {
	it('disposes a handle that arrives after unsubscribe', async () => {
		const api = await import('./subscriptions');
		const pending = deferred<ReturnType<typeof handle>>();
		sdk.openOrders.mockReturnValue(pending.promise);
		const task = api.subscribeOpenOrders(user, vi.fn(), 'xyz');
		await api.unsubscribe(key);
		const sub = handle();
		pending.resolve(sub);
		await task;
		expect(sub.unsubscribe).toHaveBeenCalledOnce();
		expect(get(api.subscriptionStatus).activeCount).toBe(0);
	});

	it('keeps only the latest same-key subscription when setup completes in reverse order', async () => {
		const api = await import('./subscriptions');
		const pending = deferred<ReturnType<typeof handle>>();
		const old = handle();
		const latest = handle();
		sdk.openOrders.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(latest);
		const first = api.subscribeOpenOrders(user, vi.fn(), 'xyz');
		await api.subscribeOpenOrders(user, vi.fn(), 'xyz');
		pending.resolve(old);
		await first;
		expect(old.unsubscribe).toHaveBeenCalledOnce();
		expect(latest.unsubscribe).not.toHaveBeenCalled();
		expect(get(api.subscriptionStatus).activeKeys).toEqual([key]);
		await api.unsubscribe(key);
		expect(latest.unsubscribe).toHaveBeenCalledOnce();
	});

	it('ignores a replaced handle aborting after its successor becomes active', async () => {
		const api = await import('./subscriptions');
		const old = handle();
		const latest = handle();
		sdk.openOrders.mockResolvedValueOnce(old).mockResolvedValueOnce(latest);
		await api.subscribeOpenOrders(user, vi.fn(), 'xyz');
		await api.subscribeOpenOrders(user, vi.fn(), 'xyz');
		old.controller.abort(new Error('late abort'));
		expect(get(api.subscriptionStatus).activeKeys).toEqual([key]);
		expect(get(api.subscriptionError)).toBeNull();
	});

	it('unsubscribeAll invalidates pending handles as well as active ones', async () => {
		const api = await import('./subscriptions');
		const pending = deferred<ReturnType<typeof handle>>();
		const active = handle();
		const late = handle();
		sdk.openOrders.mockResolvedValueOnce(active).mockReturnValueOnce(pending.promise);
		await api.subscribeOpenOrders(user, vi.fn(), 'xyz');
		const task = api.subscribeOpenOrders(user, vi.fn(), 'para');
		await api.unsubscribeAll();
		pending.resolve(late);
		await task;
		expect(active.unsubscribe).toHaveBeenCalledOnce();
		expect(late.unsubscribe).toHaveBeenCalledOnce();
		expect(get(api.subscriptionStatus).activeCount).toBe(0);
	});
});
