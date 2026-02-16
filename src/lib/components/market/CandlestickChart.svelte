<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { infoClient } from '$api/client';
	import { subscribeCandle, unsubscribe } from '$api/subscriptions';
	import { CANDLE_INTERVALS, type CandleInterval } from '$utils/constants';

	let { coin }: { coin: string } = $props();

	let chartContainer: HTMLDivElement;
	let chart: any;
	let candleSeries: any;
	let volumeSeries: any;
	let resizeObserver: ResizeObserver;
	let currentInterval = $state<CandleInterval>('15m');
	let status = $state('Loading chart...');

	async function loadCandles(c: string, interval: string) {
		try {
			status = 'Fetching candles...';
			const now = Date.now();
			const durations: Record<string, number> = {
				'1m': 6 * 3600_000,
				'5m': 24 * 3600_000,
				'15m': 3 * 24 * 3600_000,
				'1h': 7 * 24 * 3600_000,
				'4h': 30 * 24 * 3600_000,
				'1d': 180 * 24 * 3600_000
			};
			const startTime = now - (durations[interval] ?? 7 * 24 * 3600_000);

			const result = await infoClient.candleSnapshot({
				coin: c,
				interval: interval as "1m" | "5m" | "15m" | "1h" | "4h" | "1d",
				startTime,
				endTime: now
			});

			const candles = (result as any[])
				.map((candle: any) => ({
					time: Math.floor(candle.t / 1000) as number,
					open: parseFloat(candle.o),
					high: parseFloat(candle.h),
					low: parseFloat(candle.l),
					close: parseFloat(candle.c),
					volume: parseFloat(candle.v)
				}))
				.sort((a, b) => a.time - b.time);

			if (!candleSeries) {
				status = 'Chart series not ready';
				return;
			}

			if (candles.length === 0) {
				status = 'No candle data available';
				return;
			}

			candleSeries.setData(candles.map(({ volume, ...rest }) => rest));
			volumeSeries?.setData(candles.map((c) => ({
				time: c.time,
				value: c.volume,
				color: c.close >= c.open ? '#16a34a30' : '#dc262630'
			})));
			chart?.timeScale().fitContent();
			status = '';
		} catch (e) {
			status = `Candle snapshot error: ${e instanceof Error ? e.message : String(e)}`;
			throw e;
		}
	}

	async function subscribeToCandles(c: string, interval: string) {
		try {
			await subscribeCandle(c, interval, (data: unknown) => {
				// SDK candle WS: single CandleEvent object, not array
				const candle = data as any;
				if (!candle?.t) return;

				const point = {
					time: Math.floor(candle.t / 1000),
					open: parseFloat(candle.o),
					high: parseFloat(candle.h),
					low: parseFloat(candle.l),
					close: parseFloat(candle.c)
				};
				candleSeries?.update(point);
				volumeSeries?.update({
					time: point.time,
					value: parseFloat(candle.v),
					color: point.close >= point.open ? '#16a34a30' : '#dc262630'
				});
			});
		} catch (e) {
			status = `Candle stream error: ${e instanceof Error ? e.message : String(e)}`;
			throw e;
		}
	}

	async function changeInterval(interval: CandleInterval) {
		await unsubscribe(`candle:${coin}:${currentInterval}`);
		currentInterval = interval;
		await loadCandles(coin, interval);
		await subscribeToCandles(coin, interval);
	}

	onMount(async () => {
		// lightweight-charts v5: use addSeries(CandlestickSeries, opts)
		const {
			createChart,
			ColorType,
			CrosshairMode,
			CandlestickSeries,
			HistogramSeries
		} = await import('lightweight-charts');

		const width = chartContainer.clientWidth || 300;
		const height = chartContainer.clientHeight || 250;

		chart = createChart(chartContainer, {
			width,
			height,
			layout: {
				background: { type: ColorType.Solid, color: '#ffffff' },
				textColor: '#6b7280',
				fontSize: 11
			},
			grid: {
				vertLines: { color: '#f0f0f0' },
				horzLines: { color: '#f0f0f0' }
			},
			crosshair: { mode: CrosshairMode.Normal },
			rightPriceScale: { borderColor: '#e5e7eb' },
			timeScale: {
				borderColor: '#e5e7eb',
				timeVisible: true,
				secondsVisible: false
			}
		});

		// v5 API: chart.addSeries(SeriesDefinition, options)
		candleSeries = chart.addSeries(CandlestickSeries, {
			upColor: '#16a34a',
			downColor: '#dc2626',
			borderUpColor: '#16a34a',
			borderDownColor: '#dc2626',
			wickUpColor: '#16a34a99',
			wickDownColor: '#dc262699'
		});

		volumeSeries = chart.addSeries(HistogramSeries, {
			priceFormat: { type: 'volume' },
			priceScaleId: 'volume'
		});
		chart.priceScale('volume').applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 }
		});

		resizeObserver = new ResizeObserver(() => {
			if (chart && chartContainer) {
				chart.applyOptions({
					width: chartContainer.clientWidth,
					height: chartContainer.clientHeight
				});
			}
		});
		resizeObserver.observe(chartContainer);

		await loadCandles(coin, currentInterval);
		await subscribeToCandles(coin, currentInterval);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		chart?.remove();
		unsubscribe(`candle:${coin}:${currentInterval}`);
	});
</script>

<div class="flex flex-col">
	<!-- Interval selector -->
	<div class="flex gap-1 px-3 py-1.5 border-b border-border-secondary overflow-x-auto">
		{#each CANDLE_INTERVALS as interval}
			<button
				class="px-2.5 py-1 text-xs rounded font-medium transition-colors shrink-0 {currentInterval === interval.value ? 'bg-accent/15 text-accent' : 'text-gray-400 hover:text-gray-600'}"
				onclick={() => changeInterval(interval.value)}
			>
				{interval.label}
			</button>
		{/each}
	</div>

	<!-- Chart -->
	<div class="relative w-full h-[35vh] min-h-[200px]" bind:this={chartContainer}>
		{#if status}
			<div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none z-10">
				{status}
			</div>
		{/if}
	</div>
</div>
