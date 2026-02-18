<script lang="ts">
	import type { AssetCtx } from '$stores/market.svelte';
	import { formatPrice, formatUsd } from '$utils/format';

	let {
		ctx,
		szDecimals = 0,
		isSpot = false
	}: { ctx: AssetCtx; szDecimals?: number; isSpot?: boolean } = $props();

	const mark = $derived(parseFloat(ctx.markPx ?? '0'));
	const prev = $derived(parseFloat(ctx.prevDayPx ?? '0'));
	const change24h = $derived(prev > 0 ? ((mark - prev) / prev) * 100 : 0);
	const isPositive = $derived(change24h >= 0);
	const volume = $derived(parseFloat(ctx.dayNtlVlm ?? '0'));
</script>

<div class="flex items-center gap-4 px-3 py-2 overflow-x-auto text-xs border-b border-border-secondary">
	<!-- Mark price -->
	<div class="shrink-0">
		<span class="text-gray-500">Mark</span>
		<span class="ml-1 font-medium tabular-nums">{formatPrice(ctx.markPx, szDecimals, isSpot)}</span>
	</div>

	<!-- 24h change -->
	<div class="shrink-0">
		<span class="text-gray-500">24h</span>
		<span class="ml-1 font-medium tabular-nums {isPositive ? 'text-long' : 'text-short'}">
			{isPositive ? '+' : ''}{change24h.toFixed(2)}%
		</span>
	</div>

	<!-- Volume -->
	<div class="shrink-0">
		<span class="text-gray-500">Vol</span>
		<span class="ml-1 tabular-nums">{formatUsd(volume, true)}</span>
	</div>

	<!-- Oracle price (perp only) -->
	{#if ctx.oraclePx}
		<div class="shrink-0">
			<span class="text-gray-500">Oracle</span>
			<span class="ml-1 tabular-nums">{formatPrice(ctx.oraclePx, szDecimals, isSpot)}</span>
		</div>
	{/if}

	<!-- Funding (perp only) -->
	{#if ctx.funding}
		{@const fundingPct = (parseFloat(ctx.funding) * 100).toFixed(4)}
		<div class="shrink-0">
			<span class="text-gray-500">FR</span>
			<span class="ml-1 tabular-nums {parseFloat(ctx.funding) >= 0 ? 'text-long' : 'text-short'}">{fundingPct}%</span>
		</div>
	{/if}

	<!-- OI (perp only): openInterest is in coin units → multiply by mark price for USD -->
	{#if ctx.openInterest}
		<div class="shrink-0">
			<span class="text-gray-500">OI</span>
			<span class="ml-1 tabular-nums">{formatUsd(parseFloat(ctx.openInterest) * mark, true)}</span>
		</div>
	{/if}
</div>
