<script lang="ts">
	import { marketStore } from '$stores/market.svelte';
	import { formatPrice, formatSize, formatTime } from '$utils/format';

	let {
		szDecimals = 0,
		isSpot = false
	}: { szDecimals?: number; isSpot?: boolean } = $props();

	const MAX_VISIBLE = 30;
	const visibleTrades = $derived(marketStore.recentTrades.slice(0, MAX_VISIBLE));
</script>

<div class="flex flex-col text-xs font-mono">
	<!-- Header -->
	<div class="flex justify-between px-2 py-1 text-gray-600 text-[10px] uppercase tracking-wider">
		<span>Price</span>
		<span>Size</span>
		<span>Time</span>
	</div>

	<!-- Trades list -->
	<div class="flex flex-col overflow-y-auto max-h-64">
		{#each visibleTrades as trade (trade.tid)}
			{@const isBuy = trade.side === 'B'}
			<div class="flex justify-between items-center px-2 py-[3px] hover:bg-surface-hover">
				<span class="tabular-nums {isBuy ? 'text-long' : 'text-short'}">{formatPrice(trade.px, szDecimals, isSpot)}</span>
				<span class="tabular-nums text-gray-400">{formatSize(trade.sz, szDecimals)}</span>
				<span class="tabular-nums text-gray-600">{formatTime(trade.time)}</span>
			</div>
		{/each}

		{#if visibleTrades.length === 0}
			<div class="text-center py-4 text-gray-600">Waiting for trades...</div>
		{/if}
	</div>
</div>
