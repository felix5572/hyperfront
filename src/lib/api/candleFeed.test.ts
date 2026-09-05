import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCandleFeed, type Candle } from './candleFeed';

const api = vi.hoisted(() => ({ candleSnapshot: vi.fn(), subscribeCandle: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('./client', () => ({ infoClient: api }));
vi.mock('./subscriptions', () => api);
const candle: Candle = { t: 1000, o: '1', h: '2', l: '1', c: '2', v: '10' };
function callbacks() { return { reset: vi.fn(), snapshot: vi.fn(), update: vi.fn(), status: vi.fn() }; }
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { resolve, promise };
}
beforeEach(() => {
	vi.resetAllMocks();
	api.candleSnapshot.mockResolvedValue([candle]);
	api.subscribeCandle.mockResolvedValue(undefined);
	api.unsubscribe.mockResolvedValue(undefined);
});

describe('candle feed lifecycle', () => {
	it('reloads on coin changes and ignores callbacks for the old coin', async () => {
		const cb = callbacks();
		const feed = createCandleFeed(cb);
		await feed.select('BTC', '15m');
		const oldCallback = api.subscribeCandle.mock.calls[0][2];
		await feed.select('xyz:GOLD', '15m');
		expect(api.unsubscribe).toHaveBeenCalledWith('candle:BTC:15m');
		expect(api.candleSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ coin: 'xyz:GOLD' }));
		oldCallback(candle);
		expect(cb.update).not.toHaveBeenCalled();
		api.subscribeCandle.mock.calls[1][2](candle);
		expect(cb.update).toHaveBeenCalledWith(candle);
	});

	it('ignores old interval requests that finish after a new interval is selected', async () => {
		const cb = callbacks();
		const feed = createCandleFeed(cb);
		const pending = deferred<Candle[]>();
		api.candleSnapshot.mockReturnValueOnce(pending.promise);
		const first = feed.select('BTC', '15m');
		await feed.select('BTC', '1h');
		pending.resolve([{ ...candle, c: '999' }]);
		await first;
		expect(cb.snapshot).toHaveBeenCalledExactlyOnceWith([candle]);
		expect(api.subscribeCandle).toHaveBeenCalledTimes(1);
		expect(api.subscribeCandle.mock.calls[0].slice(0, 2)).toEqual(['BTC', '1h']);
	});

	it('does not update or subscribe after disposal during a snapshot request', async () => {
		const cb = callbacks();
		const feed = createCandleFeed(cb);
		const pending = deferred<Candle[]>();
		api.candleSnapshot.mockReturnValue(pending.promise);
		const task = feed.select('BTC', '15m');
		await feed.dispose();
		pending.resolve([candle]);
		await task;
		expect(cb.snapshot).not.toHaveBeenCalled();
		expect(api.subscribeCandle).not.toHaveBeenCalled();
	});

	it('clears the previous chart when a new market has no candles', async () => {
		const cb = callbacks();
		const feed = createCandleFeed(cb);
		await feed.select('BTC', '15m');
		api.candleSnapshot.mockResolvedValueOnce([]);
		await feed.select('xyz:EMPTY', '15m');
		expect(cb.reset).toHaveBeenCalledTimes(2);
		expect(cb.snapshot).toHaveBeenLastCalledWith([]);
		expect(cb.status).toHaveBeenLastCalledWith('No candle data available');
	});

	it('shows request errors without an unhandled rejection and allows retry', async () => {
		const cb = callbacks();
		const feed = createCandleFeed(cb);
		api.candleSnapshot.mockRejectedValueOnce(new Error('offline'));
		await feed.select('BTC', '15m');
		expect(cb.status).toHaveBeenLastCalledWith('Candle data error: offline');
		await feed.select('BTC', '15m');
		expect(cb.snapshot).toHaveBeenCalledWith([candle]);
	});
});
