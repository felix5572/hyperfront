<script lang="ts">
	import { marketStore } from '$stores/market.svelte';
	import { formatPrice, formatMid, formatSize } from '$utils/format';

	let { szDecimals = 0, isSpot = false }: { szDecimals?: number; isSpot?: boolean } = $props();

	const VISIBLE_LEVELS = 8;

	// Asks: reversed so highest at top, best (lowest) at bottom
	const visibleAsks = $derived(marketStore.asks.slice(0, VISIBLE_LEVELS).reverse());
	// Bids: best (highest) at top, descending
	const visibleBids = $derived(marketStore.bids.slice(0, VISIBLE_LEVELS));

	const maxAskSz = $derived(
		Math.max(...marketStore.asks.slice(0, VISIBLE_LEVELS).map((l) => parseFloat(l.sz)), 1)
	);
	const maxBidSz = $derived(
		Math.max(...marketStore.bids.slice(0, VISIBLE_LEVELS).map((l) => parseFloat(l.sz)), 1)
	);

	// Conservative mid price
	const midData = $derived(
		(marketStore.asks.length > 0 && marketStore.bids.length > 0)
			? formatMid(marketStore.bids[0].px, marketStore.asks[0].px, szDecimals, isSpot)
			: null
	);
</script>

<div class="flex flex-col h-full text-[10px] font-mono leading-tight">
	<!-- Header -->
	<div class="flex justify-between px-1.5 py-0.5 text-[9px] text-gray-400 uppercase tracking-wider border-b border-border-secondary">
		<span>Price</span>
		<span>Size</span>
	</div>

	<!-- Asks (highest at top, best ask at bottom) -->
	<div class="flex flex-col flex-1 justify-end overflow-hidden">
		{#each visibleAsks as level}
			{@const pct = (parseFloat(level.sz) / maxAskSz) * 100}
			<div class="relative flex justify-between items-center px-1.5 py-[2px]">
				<div class="absolute right-0 top-0 bottom-0 bg-short-dim" style="width: {pct}%"></div>
				<span class="relative tabular-nums text-short">{formatPrice(level.px, szDecimals, isSpot)}</span>
				<span class="relative tabular-nums text-gray-500">{formatSize(level.sz, szDecimals)}</span>
			</div>
		{/each}
	</div>

	<!-- Mid price -->
	<div class="flex items-center justify-center py-1 border-y border-border-secondary bg-surface-secondary">
		{#if midData}
			<span class="text-xs font-bold tabular-nums">{midData.mid}</span>
		{:else}
			<span class="text-gray-400">--</span>
		{/if}
	</div>

	<!-- Bids (best bid at top, descending) -->
	<div class="flex flex-col flex-1 overflow-hidden">
		{#each visibleBids as level}
			{@const pct = (parseFloat(level.sz) / maxBidSz) * 100}
			<div class="relative flex justify-between items-center px-1.5 py-[2px]">
				<div class="absolute right-0 top-0 bottom-0 bg-long-dim" style="width: {pct}%"></div>
				<span class="relative tabular-nums text-long">{formatPrice(level.px, szDecimals, isSpot)}</span>
				<span class="relative tabular-nums text-gray-500">{formatSize(level.sz, szDecimals)}</span>
			</div>
		{/each}
	</div>
</div>
