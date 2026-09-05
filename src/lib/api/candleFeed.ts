import { infoClient } from './client';
import { subscribeCandle, unsubscribe } from './subscriptions';
import type { CandleInterval } from '$utils/constants';

export interface Candle {
	t: number;
	o: string;
	h: string;
	l: string;
	c: string;
	v: string;
}

const durations: Record<CandleInterval, number> = {
	'1m': 6 * 3600_000, '5m': 24 * 3600_000, '15m': 3 * 24 * 3600_000,
	'1h': 7 * 24 * 3600_000, '4h': 30 * 24 * 3600_000, '1d': 180 * 24 * 3600_000
};

/** One chart's lifecycle, independent of the chart renderer. Latest selection wins. */
export function createCandleFeed(callbacks: {
	reset: () => void;
	snapshot: (candles: Candle[]) => void;
	update: (candle: Candle) => void;
	status: (message: string) => void;
}) {
	let generation = 0;
	let activeKey: string | null = null;

	async function select(coin: string, interval: CandleInterval) {
		const version = ++generation;
		const previous = activeKey;
		activeKey = `candle:${coin}:${interval}`;
		callbacks.reset();
		callbacks.status('Fetching candles...');
		try {
			if (previous) await unsubscribe(previous);
			if (version !== generation) return;
			const endTime = Date.now();
			const result = await infoClient.candleSnapshot({
				coin, interval, startTime: endTime - durations[interval], endTime
			});
			if (version !== generation) return;
			callbacks.snapshot(result);
			callbacks.status(result.length === 0 ? 'No candle data available' : '');
			await subscribeCandle(coin, interval, (data) => {
				if (version !== generation) return;
				const candle = data as Candle;
				if (!candle?.t) return;
				callbacks.update(candle);
				callbacks.status('');
			});
		} catch (error) {
			if (version === generation) {
				callbacks.status(`Candle data error: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	async function dispose() {
		++generation;
		const previous = activeKey;
		activeKey = null;
		if (previous) await unsubscribe(previous);
	}

	return { select, dispose };
}
