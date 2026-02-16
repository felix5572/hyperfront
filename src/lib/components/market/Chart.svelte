<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { marketStore } from '$stores/market.svelte';

	let chartContainer: HTMLDivElement;
	let chart: any;
	let lineSeries: any;
	let resizeObserver: ResizeObserver;

	// Track mid prices for line chart
	let priceHistory: Array<{ time: number; value: number }> = [];

	onMount(async () => {
		const { createChart, ColorType, LineStyle } = await import('lightweight-charts');

		chart = createChart(chartContainer, {
			layout: {
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: '#6b7280',
				fontSize: 11
			},
			grid: {
				vertLines: { color: '#1e1e2e' },
				horzLines: { color: '#1e1e2e' }
			},
			crosshair: {
				vertLine: { color: '#6366f1', style: LineStyle.Dashed, width: 1 },
				horzLine: { color: '#6366f1', style: LineStyle.Dashed, width: 1 }
			},
			rightPriceScale: {
				borderColor: '#2a2a3a'
			},
			timeScale: {
				borderColor: '#2a2a3a',
				timeVisible: true,
				secondsVisible: false
			},
			handleScale: { axisPressedMouseMove: { time: true, price: false } }
		});

		lineSeries = chart.addLineSeries({
			color: '#6366f1',
			lineWidth: 2,
			priceLineVisible: true,
			lastValueVisible: true
		});

		// Responsive resize
		resizeObserver = new ResizeObserver(() => {
			if (chart && chartContainer) {
				chart.applyOptions({
					width: chartContainer.clientWidth,
					height: chartContainer.clientHeight
				});
			}
		});
		resizeObserver.observe(chartContainer);
	});

	// Update chart when new mid prices arrive
	$effect(() => {
		const mid = marketStore.midPrice;
		if (mid && lineSeries) {
			const now = Math.floor(Date.now() / 1000);
			const value = parseFloat(mid);
			priceHistory.push({ time: now, value });

			// Keep last 500 points
			if (priceHistory.length > 500) {
				priceHistory = priceHistory.slice(-500);
			}

			lineSeries.update({ time: now, value });
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		chart?.remove();
	});
</script>

<div class="w-full h-full min-h-[200px]" bind:this={chartContainer}></div>
