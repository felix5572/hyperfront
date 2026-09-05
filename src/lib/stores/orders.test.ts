import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fill, OpenOrder } from './orders.svelte';

const mocks = vi.hoisted(() => ({
	frontendOpenOrders: vi.fn(), userFills: vi.fn(), historicalOrders: vi.fn(),
	subscribeOpenOrders: vi.fn(), subscribeUserFills: vi.fn(), unsubscribe: vi.fn(),
	fetchPerpDexs: vi.fn(), prefetchHip3Meta: vi.fn()
}));
vi.mock('$api/client', () => ({ infoClient: mocks }));
vi.mock('$api/subscriptions', () => mocks);
vi.mock('./market.svelte', () => ({ marketStore: {
	fetchPerpDexs: mocks.fetchPerpDexs,
	prefetchHip3Meta: mocks.prefetchHip3Meta,
	allHip3Dexes: ['xyz', 'para', 'mkts', 'io', 'vntl'].map((name) => ({ name }))
} }));

const userA = '0x1111111111111111111111111111111111111111';
const userB = '0x2222222222222222222222222222222222222222';
const dexes = ['', 'xyz', 'para', 'mkts', 'io', 'vntl'];
function order(coin = 'BTC', oid = 1): OpenOrder {
	return { coin, oid, limitPx: '100', sz: '1', origSz: '1', side: 'B', timestamp: oid };
}
function fill(coin = 'BTC', tid = 1, side = 'B'): Fill {
	return { coin, tid, side, px: '100', sz: '1', time: tid, startPosition: '0', dir: 'Open Long',
		closedPnl: '0', hash: '0xabc', oid: tid, crossed: false, fee: '0', feeToken: 'USDC' };
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { resolve, promise };
}
async function loadStore() { return (await import('./orders.svelte')).ordersStore; }
function emitOrders(user: string, dex: string, orders: OpenOrder[]) {
	const call = mocks.subscribeOpenOrders.mock.calls.find(([u, , d]) => u === user && d === dex);
	expect(call).toBeDefined();
	call![1]({ user, dex, orders });
}

beforeEach(() => {
	vi.resetModules(); vi.resetAllMocks();
	mocks.frontendOpenOrders.mockResolvedValue([]);
	mocks.userFills.mockResolvedValue([]);
	mocks.historicalOrders.mockResolvedValue([]);
	mocks.fetchPerpDexs.mockResolvedValue(undefined);
	mocks.prefetchHip3Meta.mockResolvedValue(undefined);
	mocks.subscribeOpenOrders.mockResolvedValue(undefined);
	mocks.subscribeUserFills.mockResolvedValue(undefined);
	mocks.unsubscribe.mockResolvedValue(undefined);
});

describe('multi-DEX orders and account isolation', () => {
	it('loads main, the four visible DEXes, and archived DEX orders', async () => {
		const store = await loadStore();
		mocks.frontendOpenOrders.mockImplementation(async ({ dex }) => [order(dex ? `${dex}:COIN` : 'BTC')]);
		await store.subscribeOrders(userA);
		expect(mocks.frontendOpenOrders.mock.calls.map(([r]) => r.dex)).toEqual(dexes);
		expect(mocks.subscribeOpenOrders.mock.calls.map(([, , dex]) => dex)).toEqual(dexes);
		expect(store.openOrders).toHaveLength(6);
		expect(store.openOrders.some((o) => o.coin === 'vntl:COIN')).toBe(true);
		expect(store.loading).toBe(false);
		expect(store.errors).toEqual([]);
	});

	it('replaces only the matching DEX bucket on WS snapshots, including empty snapshots', async () => {
		const store = await loadStore();
		await store.subscribeOrders(userA);
		emitOrders(userA, '', [order('BTC', 1)]);
		emitOrders(userA, 'xyz', [order('xyz:GOLD', 2)]);
		emitOrders(userA, 'para', [order('para:SILVER', 3)]);
		emitOrders(userA, 'xyz', []);
		expect(store.openOrders.map((o) => o.coin)).toEqual(['para:SILVER', 'BTC']);
	});

	it('refreshes all DEXes after an order action, while explicit refreshes preserve other buckets', async () => {
		const store = await loadStore();
		await store.subscribeOrders(userA);
		emitOrders(userA, '', [order()]);
		emitOrders(userA, 'xyz', [order('xyz:GOLD')]);
		await store.fetchOpenOrders(userA, 'xyz');
		expect(store.openOrders.map((o) => o.coin)).toEqual(['BTC']);
		mocks.frontendOpenOrders.mockClear();
		await store.fetchOpenOrders(userA);
		expect(mocks.frontendOpenOrders.mock.calls.map(([r]) => r.dex)).toEqual(dexes);
	});

	it('does not overwrite a newer WS snapshot with a delayed REST response', async () => {
		const store = await loadStore();
		await store.subscribeOrders(userA);
		const pending = deferred<OpenOrder[]>();
		mocks.frontendOpenOrders.mockReturnValueOnce(pending.promise);
		const task = store.fetchOpenOrders(userA, 'xyz');
		emitOrders(userA, 'xyz', []);
		pending.resolve([order('xyz:GOLD')]);
		await task;
		expect(store.openOrders).toEqual([]);
	});

	it('uses the latest refresh when two REST requests complete in reverse order', async () => {
		const store = await loadStore();
		const pending = deferred<OpenOrder[]>();
		mocks.frontendOpenOrders.mockReturnValueOnce(pending.promise);
		const first = store.fetchOpenOrders(userA, 'xyz');
		await store.fetchOpenOrders(userA, 'xyz');
		pending.resolve([order('xyz:GOLD')]);
		await first;
		expect(store.openOrders).toEqual([]);
	});

	it('clears old account data immediately and ignores its late REST and WS data', async () => {
		const store = await loadStore();
		await store.subscribeOrders(userA);
		emitOrders(userA, '', [order()]);
		const pending = deferred<OpenOrder[]>();
		mocks.frontendOpenOrders.mockReturnValueOnce(pending.promise);
		const refreshA = store.fetchOpenOrders(userA, '');
		const switchB = store.subscribeOrders(userB);
		expect(store.viewAddress).toBe(userB);
		expect(store.openOrders).toEqual([]);
		emitOrders(userA, 'xyz', [order('xyz:GOLD')]);
		pending.resolve([order()]);
		await Promise.all([refreshA, switchB]);
		expect(store.openOrders).toEqual([]);
		for (const dex of dexes) expect(mocks.unsubscribe).toHaveBeenCalledWith(`openOrders:${userA}:${dex}`);
		expect(mocks.unsubscribe).toHaveBeenCalledWith(`userFills:${userA}`);
	});

	it('continues other DEXes and realtime subscriptions when one REST endpoint fails', async () => {
		const store = await loadStore();
		mocks.frontendOpenOrders.mockImplementation(async ({ dex }) => {
			if (dex === 'xyz') throw new Error('offline');
			return dex === '' ? [order()] : [];
		});
		await store.subscribeOrders(userA);
		expect(store.openOrders).toHaveLength(1);
		expect(store.errors).toEqual(['Orders (xyz): offline']);
		expect(store.loading).toBe(false);
		expect(mocks.subscribeOpenOrders).toHaveBeenCalledTimes(6);
		emitOrders(userA, 'xyz', []);
		expect(store.errors).toEqual([]);
	});

	it('falls back to main and visible DEXes with an explicit discovery warning', async () => {
		const store = await loadStore();
		mocks.fetchPerpDexs.mockRejectedValueOnce(new Error('offline'));
		await store.loadByAddress(userA);
		expect(mocks.frontendOpenOrders.mock.calls.map(([r]) => r.dex)).toEqual(['', 'xyz', 'para', 'mkts', 'io']);
		expect(store.errors[0]).toContain('legacy orders may be missing');
		expect(store.loading).toBe(false);
	});

	it('cleans every pending subscription on unsubscribe and ignores callbacks afterwards', async () => {
		const store = await loadStore();
		const pending = deferred<void>();
		mocks.subscribeOpenOrders.mockReturnValue(pending.promise);
		const task = store.subscribeOrders(userA);
		await vi.waitFor(() => expect(mocks.subscribeOpenOrders).toHaveBeenCalledTimes(6));
		await store.unsubscribeOrders(userA);
		pending.resolve();
		await task;
		emitOrders(userA, 'xyz', [order('xyz:GOLD')]);
		expect(store.openOrders).toEqual([]);
		for (const dex of dexes) expect(mocks.unsubscribe).toHaveBeenCalledWith(`openOrders:${userA}:${dex}`);
	});

	it('deduplicates repeated same-address initialization', async () => {
		const store = await loadStore();
		await Promise.all([store.subscribeOrders(userA), store.subscribeOrders(userA)]);
		expect(mocks.frontendOpenOrders).toHaveBeenCalledTimes(6);
		expect(mocks.subscribeOpenOrders).toHaveBeenCalledTimes(6);
	});

	it('reports runtime stream failures and retries discovery, REST, and streams on Refresh', async () => {
		const store = await loadStore();
		mocks.fetchPerpDexs.mockRejectedValueOnce(new Error('offline'));
		await store.subscribeOrders(userA);
		mocks.subscribeOpenOrders.mock.calls[1][3](new Error('stream closed'));
		expect(store.errors.some((error) => error.includes('Live orders (xyz): stream closed'))).toBe(true);
		await store.refresh(userA);
		expect(mocks.fetchPerpDexs).toHaveBeenCalledTimes(2);
		expect(store.errors).toEqual([]);
		expect(mocks.subscribeOpenOrders).toHaveBeenCalledTimes(11);
		expect(mocks.unsubscribe).toHaveBeenCalledWith(`openOrders:${userA}:xyz`);
	});

	it('does not clear loading when an older same-account load finishes first', async () => {
		const store = await loadStore();
		const old = deferred<Fill[]>();
		const latest = deferred<Fill[]>();
		mocks.userFills.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
		const first = store.loadByAddress(userA);
		const second = store.loadByAddress(userA);
		old.resolve([]);
		await first;
		expect(store.loading).toBe(true);
		latest.resolve([]);
		await second;
		expect(store.loading).toBe(false);
	});

	it('merges delayed REST fill history with new WS fills and preserves self-cross sides', async () => {
		const store = await loadStore();
		const pending = deferred<Fill[]>();
		mocks.userFills.mockReturnValueOnce(pending.promise);
		const task = store.subscribeOrders(userA);
		await vi.waitFor(() => expect(mocks.subscribeUserFills).toHaveBeenCalledOnce());
		const callback = mocks.subscribeUserFills.mock.calls[0][1];
		callback({ user: userA, fills: [{ ...fill(), px: '200' }, fill('BTC', 1, 'A'), fill('BTC', 2)] });
		pending.resolve([fill(), fill('BTC', 0)]);
		await task;
		expect(store.fills).toHaveLength(4);
		expect(store.fills.find((f) => f.tid === 1 && f.side === 'B')?.px).toBe('200');
		await store.subscribeOrders(userB);
		callback({ user: userA, fills: [fill()] });
		expect(store.fills).toEqual([]);
	});
});
