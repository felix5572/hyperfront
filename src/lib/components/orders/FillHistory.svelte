<script lang="ts">
	import { ordersStore } from '$stores/orders.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { formatPrice, formatSize, formatTime, formatUsd } from '$utils/format';
	import Paginator from './Paginator.svelte';

	const PAGE_SIZE = 100;
	let page = $state(1);

	const totalItems = $derived(ordersStore.fills.length);
	const totalPages = $derived(Math.max(1, Math.ceil(totalItems / PAGE_SIZE)));
	const slicedFills = $derived(
		ordersStore.fills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
	);

	$effect(() => {
		const maxPage = Math.max(1, Math.ceil(ordersStore.fills.length / PAGE_SIZE));
		if (page > maxPage) page = maxPage;
	});
</script>

<div class="flex flex-col">
	{#if ordersStore.fills.length === 0}
		<div class="text-center py-8 text-sm text-gray-500">No recent fills</div>
	{:else}
		<!-- Single grid so header and rows align; spacing and money style for $ columns -->
		<div
			class="grid gap-x-3 gap-y-0 px-3 text-xs items-center"
			style="grid-template-columns: 1fr 1.75rem minmax(4rem, auto) minmax(3rem, auto) minmax(3.5rem, auto) minmax(3.2rem, auto);"
		>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary">Coin</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-center">Side</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Price</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Size</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">PnL</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Time</div>

			{#each slicedFills as fill (fill.tid)}
				{@const isBuy = fill.side === 'B' || fill.side === 'buy'}
				{@const pnl = parseFloat(fill.closedPnl)}
				{@const pp = marketStore.getCoinPriceParams(fill.coin)}
				{@const perp = marketStore.findPerpAsset(fill.coin)}
				{@const spot = marketStore.findSpotAsset(fill.coin)}
				{@const displayName = perp ? perp.meta.name : spot ? spot.displayName : fill.coin}
				{@const rawCoin = spot ? spot.pair.name : fill.coin}
				<span class="font-medium whitespace-nowrap min-w-0 overflow-hidden text-ellipsis py-2 border-b border-border-secondary hover:bg-surface-hover">
					{displayName}{#if rawCoin !== displayName}<span class="text-[10px] text-gray-500 font-normal ml-1">{rawCoin}</span>{/if}
				</span>
				<span class="{isBuy ? 'text-long' : 'text-short'} font-medium text-center py-2 border-b border-border-secondary hover:bg-surface-hover">{isBuy ? 'BUY' : 'SELL'}</span>
				<span class="text-right tabular-nums font-semibold font-mono tracking-tight text-gray-900 py-2 border-b border-border-secondary hover:bg-surface-hover">${formatPrice(fill.px, pp.szDecimals, pp.isSpot)}</span>
				<span class="text-right tabular-nums font-mono py-2 border-b border-border-secondary hover:bg-surface-hover">{formatSize(fill.sz, pp.szDecimals)}</span>
				<span class="text-right tabular-nums font-semibold font-mono tracking-tight py-2 border-b border-border-secondary hover:bg-surface-hover {pnl >= 0 ? 'text-long' : 'text-short'}">
					{pnl !== 0 ? formatUsd(pnl) : '—'}
				</span>
				<span class="text-right tabular-nums text-gray-500 py-2 border-b border-border-secondary hover:bg-surface-hover">{formatTime(fill.time)}</span>
			{/each}
		</div>
		<Paginator
			currentPage={page}
			totalPages={totalPages}
			totalItems={totalItems}
			pageSize={PAGE_SIZE}
			onPageChange={(p) => (page = p)}
		/>
	{/if}
</div>
