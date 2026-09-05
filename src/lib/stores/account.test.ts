import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClearinghouseState } from './account.svelte';

const mocks = vi.hoisted(() => ({
	clearinghouseState: vi.fn(), spotClearinghouseState: vi.fn(),
	subscribeAllDexsClearinghouseState: vi.fn(), subscribeWebData3: vi.fn(), unsubscribe: vi.fn()
}));
vi.mock('$api/client', () => ({ infoClient: mocks }));
vi.mock('$api/subscriptions', () => mocks);
const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function state(value: string, coin = 'BTC'): ClearinghouseState {
	const margin = { accountValue: value, totalNtlPos: value, totalRawUsd: value, totalMarginUsed: '1' };
	return { marginSummary: margin, crossMarginSummary: margin, withdrawable: value,
		assetPositions: [{ type: 'oneWay', position: { coin, szi: value, entryPx: '1', positionValue: value,
			returnOnEquity: '0', unrealizedPnl: '0', liquidationPx: null, marginUsed: '1', leverage: { type: 'isolated', value: 2 } } }] };
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { resolve, promise };
}
async function loadStore() { return (await import('./account.svelte')).accountStore; }
function emit(user: string, entries: [string, ClearinghouseState][]) {
	const call = mocks.subscribeAllDexsClearinghouseState.mock.calls.filter(([owner]) => owner === user).at(-1);
	expect(call).toBeDefined();
	call![1]({ user, clearinghouseStates: entries });
}
beforeEach(() => {
	vi.resetModules(); vi.resetAllMocks();
	mocks.clearinghouseState.mockImplementation(async ({ user, dex }) => state(user === A ? '10' : '20', dex ? `${dex}:COIN` : 'BTC'));
	mocks.spotClearinghouseState.mockImplementation(async ({ user }) => ({ balances: [{ coin: 'USDC', token: 0, total: user === A ? '100' : '200', hold: '0', entryNtl: '0' }] }));
	mocks.subscribeAllDexsClearinghouseState.mockResolvedValue(undefined);
	mocks.subscribeWebData3.mockResolvedValue(undefined);
	mocks.unsubscribe.mockResolvedValue(undefined);
});

describe('address-scoped account snapshots', () => {
	it('keeps trading wallet A separate while viewing B, including same-named DEX balances', async () => {
		const store = await loadStore();
		await store.loadAddress(B);
		await Promise.all([store.fetchAccountState(A), store.fetchSpotState(A), store.fetchDexState(A, 'xyz'), store.fetchDexState(B, 'xyz')]);
		expect(store.viewAddress).toBe(B);
		expect(store.withdrawable).toBe('20');
		expect(store.spotBalancesFull[0].total).toBe('200');
		expect(store.forAddress(A).withdrawable).toBe('10');
		expect(store.forAddress(A).spotBalancesFull[0].total).toBe('100');
		expect(store.forAddress(A).dexClearinghouse.xyz.withdrawable).toBe('10');
		expect(store.forAddress(B).dexClearinghouse.xyz.withdrawable).toBe('20');
		expect(store.forAddress(null).positions).toEqual([]);
		expect(store.forAddress(null).spotBalancesFull).toEqual([]);
	});

	it('loads wallet data on a cold detail page without setting a viewed address', async () => {
		const store = await loadStore();
		await store.fetchDexState(A, 'xyz');
		expect(store.viewAddress).toBeNull();
		expect(store.forAddress(A).positions[0].coin).toBe('xyz:COIN');
		expect(store.positions).toEqual([]);
	});

	it('clears prior data immediately and ignores a previous view session finishing late', async () => {
		const store = await loadStore();
		const pending = deferred<ClearinghouseState>();
		mocks.clearinghouseState.mockReturnValueOnce(pending.promise);
		const first = store.loadAddress(A);
		emit(A, [['xyz', state('99', 'xyz:COIN')]]);
		const second = store.loadAddress(B);
		expect(store.viewAddress).toBe(B);
		expect(store.positions).toEqual([]);
		expect(store.spotBalancesFull).toEqual([]);
		expect(store.webData3Raw).toBeNull();
		emit(A, [['', state('999')]]);
		pending.resolve(state('999'));
		await Promise.all([first, second]);
		expect(store.withdrawable).toBe('20');
		expect(store.forAddress(A).withdrawable).toBe('0');
		expect(mocks.unsubscribe).toHaveBeenCalledWith(`allDexsClearinghouseState:${A}`);
	});

	it('protects a newer view of A from an older A request across A→B→A', async () => {
		const store = await loadStore();
		const pending = deferred<ClearinghouseState>();
		mocks.clearinghouseState.mockReturnValueOnce(pending.promise);
		const first = store.loadAddress(A);
		await store.loadAddress(B);
		await store.loadAddress(A);
		pending.resolve(state('999'));
		await first;
		expect(store.withdrawable).toBe('10');
	});

	it('does not let older same-address REST refreshes overwrite newer results', async () => {
		const store = await loadStore();
		const pending = deferred<ClearinghouseState>();
		mocks.clearinghouseState.mockReturnValueOnce(pending.promise);
		const first = store.fetchAccountState(A);
		await store.fetchAccountState(A);
		pending.resolve(state('999'));
		await first;
		expect(store.forAddress(A).withdrawable).toBe('10');
	});

	it('keeps a full WS snapshot ahead of in-flight REST, including empty snapshots', async () => {
		const store = await loadStore();
		await store.loadAddress(A);
		await store.fetchDexState(A, 'xyz');
		const pending = deferred<ClearinghouseState>();
		mocks.clearinghouseState.mockReturnValueOnce(pending.promise);
		const task = store.fetchAccountState(A);
		emit(A, []);
		pending.resolve(state('999'));
		await task;
		expect(store.positions).toEqual([]);
		expect(store.clearinghouse).toBeNull();
		expect(store.dexClearinghouse).toEqual({});
	});

	it('reports REST failures without hanging loading or blocking live updates', async () => {
		const store = await loadStore();
		mocks.clearinghouseState.mockRejectedValueOnce(new Error('offline'));
		mocks.spotClearinghouseState.mockRejectedValueOnce(new Error('offline'));
		await store.loadAddress(A);
		expect(store.loading).toBe(false);
		expect(store.errors).toHaveLength(2);
		emit(A, [['', state('15')]]);
		expect(store.withdrawable).toBe('15');
		expect(store.errors).toEqual(['Spot balances: offline']);
	});

	it('invalidates pending work on reset and cleans pending subscriptions on leaving', async () => {
		const store = await loadStore();
		const pending = deferred<ClearinghouseState>();
		mocks.clearinghouseState.mockReturnValueOnce(pending.promise);
		const task = store.loadAddress(A);
		await store.unsubscribeAccount(A);
		emit(A, [['', state('999')]]);
		store.reset();
		pending.resolve(state('999'));
		await task;
		expect(store.forAddress(A).withdrawable).toBe('0');
		expect(store.viewAddress).toBeNull();
		expect(mocks.unsubscribe).toHaveBeenCalledWith(`webData3:${A}`);
	});

	it('normalizes address casing and ignores mismatched webData3 owners', async () => {
		const store = await loadStore();
		await store.loadAddress(A.toUpperCase().replace('0X', '0x') as `0x${string}`);
		expect(store.viewAddress).toBe(A);
		const callback = mocks.subscribeWebData3.mock.calls[0][1];
		callback({ userState: { user: B } });
		expect(store.webData3Raw).toBeNull();
		callback({ userState: { user: A } });
		expect(store.webData3Raw).toEqual({ userState: { user: A } });
	});
});
