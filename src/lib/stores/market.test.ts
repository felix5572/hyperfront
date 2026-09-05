import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetCtx, AssetMeta } from './market.svelte';

const api = vi.hoisted(() => ({
	perpDexs: vi.fn(),
	metaAndAssetCtxs: vi.fn(),
	spotMetaAndAssetCtxs: vi.fn()
}));

vi.mock('$api/client', () => ({ infoClient: api }));
vi.mock('$api/subscriptions', () => ({
	subscribeL2Book: vi.fn(),
	subscribeTrades: vi.fn(),
	subscribeAllMids: vi.fn(),
	unsubscribe: vi.fn()
}));

function dex(name: string) {
	return { name, fullName: name, deployer: '0x1111111111111111111111111111111111111111' };
}

// Hidden DEXes and null slots deliberately precede/interleave the visible ones.
// The display order also differs from the protocol order.
const registry = [null, dex('vntl'), dex('io'), null, dex('xyz'), dex('felix'), dex('para'), dex('mkts'), dex('other')];
type MetaResponse = [{ universe: AssetMeta[]; collateralToken: number }, AssetCtx[]];

function metadata(name: string, collateralToken = 0): MetaResponse {
	return [{
		universe: [
			{ name: `${name}:OLD`, szDecimals: 2, maxLeverage: 10, isDelisted: true },
			{ name: `${name}:LOW`, szDecimals: 3, maxLeverage: 20 },
			{ name: `${name}:HIGH`, szDecimals: 4, maxLeverage: 10 }
		],
		collateralToken
	}, ['9999', '10', '100'].map((dayNtlVlm) => ({
		dayNtlVlm, markPx: '123', midPx: '122', prevDayPx: '120',
		funding: '0', openInterest: '10', premium: '0', oraclePx: '123'
	}))];
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

async function loadStore() {
	return (await import('./market.svelte')).marketStore;
}

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	api.perpDexs.mockResolvedValue(registry);
	api.metaAndAssetCtxs.mockImplementation(async ({ dex: name = 'main' } = {}) => metadata(name));
	api.spotMetaAndAssetCtxs.mockResolvedValue([{ tokens: [], universe: [] }, []]);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('HIP-3 market visibility and asset resolution', () => {
	it('lists only the four curated DEXes, preserving original API indices', async () => {
		const store = await loadStore();
		await store.fetchPerpDexs();
		expect(store.hip3Dexes.map(({ name, perpDexIndex }) => [name, perpDexIndex])).toEqual([
			['xyz', 4], ['para', 6], ['mkts', 7], ['io', 2]
		]);
		expect(api.metaAndAssetCtxs).not.toHaveBeenCalled();
	});

	it('All fetches only visible DEXes, without renumbering delisted assets', async () => {
		const store = await loadStore();
		await store.selectHip3Dex('__all__');
		expect(api.metaAndAssetCtxs.mock.calls.map(([request]) => request.dex)).toEqual(['xyz', 'para', 'mkts', 'io']);
		expect(store.filteredHip3Assets).toHaveLength(8);
		expect(store.filteredHip3Assets.some((a) => a.meta.isDelisted)).toBe(false);
		for (const [name, index] of [['xyz', 4], ['para', 6], ['mkts', 7], ['io', 2]] as const) {
			expect(store.getAssetId(`${name}:HIGH`)).toBe(100000 + index * 10000 + 2);
			expect(store.getAssetId(`${name}:LOW`)).toBe(100000 + index * 10000 + 1);
		}
		store.setSearch('vntl');
		expect(store.filteredHip3Assets).toEqual([]);
	});

	it('shares All metadata with individual DEX tabs and keeps volume sorting', async () => {
		const store = await loadStore();
		await store.selectHip3Dex('__all__');
		await store.selectHip3Dex('xyz');
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(4);
		expect(store.hip3Assets.map((a) => [a.meta.name, a.assetId])).toEqual([
			['xyz:HIGH', 140002], ['xyz:LOW', 140001]
		]);
		expect(store.hip3Loading).toBe(false);
	});

	it('resolves archived order/history assets without showing them in All or search', async () => {
		const store = await loadStore();
		expect(await store.resolveAssetId('vntl:HIGH')).toBe(110002);
		expect(store.getCoinPriceParams('vntl:HIGH')).toEqual({ szDecimals: 4, isSpot: false });
		expect(await store.resolveAssetId('vntl:OLD')).toBe(110000);
		expect(store.activeHip3Dex).toBe('__all__');
		expect(store.filteredHip3Assets).toEqual([]);
		await store.selectHip3Dex('__all__');
		expect(store.filteredHip3Assets).toHaveLength(8);
		store.setSearch('vntl');
		expect(store.filteredHip3Assets).toEqual([]);
	});

	it('does not select archived or unknown DEXes or invent asset IDs for them', async () => {
		const store = await loadStore();
		await store.selectHip3Dex('xyz');
		await store.selectHip3Dex('felix');
		await store.selectHip3Dex('missing');
		expect(store.activeHip3Dex).toBe('xyz');
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
		expect(await store.resolveAssetId('missing:HIGH')).toBeNull();
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
	});

	it('does not mix metadata, asset IDs, or loading state when requests finish out of order', async () => {
		const store = await loadStore();
		await store.fetchPerpDexs();
		const xyz = deferred<MetaResponse>();
		const para = deferred<MetaResponse>();
		api.metaAndAssetCtxs.mockImplementation(({ dex }) => dex === 'xyz' ? xyz.promise : para.promise);
		const first = store.selectHip3Dex('xyz');
		expect(store.hip3Loading).toBe(true);
		const second = store.selectHip3Dex('para');
		expect(store.hip3Assets).toEqual([]);
		para.resolve(metadata('para'));
		await second;
		expect(store.hip3Loading).toBe(false);
		expect(store.hip3Assets[0].assetId).toBe(160002);
		xyz.resolve(metadata('xyz'));
		await first;
		expect(store.activeHip3Dex).toBe('para');
		expect(store.hip3Assets.map((a) => a.meta.name)).toEqual(['para:HIGH', 'para:LOW']);
		expect(store.getAssetId('xyz:HIGH')).toBe(140002);
	});

	it('keeps a selected DEX intact while archived metadata is prefetched', async () => {
		const store = await loadStore();
		await store.selectHip3Dex('xyz');
		const archived = deferred<MetaResponse>();
		api.metaAndAssetCtxs.mockReturnValueOnce(archived.promise);
		const prefetch = store.prefetchHip3Meta(['vntl:HIGH', 'vntl:LOW']);
		await vi.waitFor(() => expect(api.metaAndAssetCtxs).toHaveBeenCalledWith({ dex: 'vntl' }));
		expect(store.hip3Loading).toBe(false);
		archived.resolve(metadata('vntl'));
		await prefetch;
		expect(store.activeHip3Dex).toBe('xyz');
		expect(store.hip3Assets[0]).toMatchObject({ meta: { name: 'xyz:HIGH' }, assetId: 140002 });
		expect(store.getAssetId('vntl:HIGH')).toBe(110002);
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(2);
	});

	it('deduplicates in-flight requests and refreshes only after cache expiry or force', async () => {
		const store = await loadStore();
		await store.fetchPerpDexs();
		const pending = deferred<MetaResponse>();
		api.metaAndAssetCtxs.mockReturnValueOnce(pending.promise);
		const first = store.selectHip3Dex('xyz');
		const second = store.selectHip3Dex('xyz', true);
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
		pending.resolve(metadata('xyz'));
		await Promise.all([first, second]);
		await store.selectHip3Dex('xyz');
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
		await store.selectHip3Dex('xyz', true);
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(2);
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);
		await store.selectHip3Dex('xyz');
		expect(api.metaAndAssetCtxs).toHaveBeenCalledTimes(3);
	});

	it('updates quote currency if spot tokens load after HIP-3 metadata', async () => {
		const store = await loadStore();
		api.metaAndAssetCtxs.mockImplementation(async ({ dex }) => metadata(dex, 7));
		await store.selectHip3Dex('__all__');
		api.spotMetaAndAssetCtxs.mockResolvedValueOnce([{
			tokens: [{ name: 'USDH', index: 7 }], universe: []
		}, []]);
		await store.fetchSpotMeta();
		expect(store.filteredHip3Assets.every((a) => a.quoteCurrency === 'USDH')).toBe(true);
		await store.selectHip3Dex('xyz');
		expect(store.hip3Quote).toBe('USDH');
	});

	it('clears loading after a failed request and lets the same DEX retry', async () => {
		const store = await loadStore();
		api.metaAndAssetCtxs.mockRejectedValueOnce(new Error('unavailable'));
		await expect(store.selectHip3Dex('xyz')).rejects.toThrow('unavailable');
		expect(store.hip3Loading).toBe(false);
		expect(store.hip3Assets).toEqual([]);
		await store.selectHip3Dex('xyz');
		expect(store.getAssetId('xyz:HIGH')).toBe(140002);
	});
});
