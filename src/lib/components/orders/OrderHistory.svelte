<script lang="ts">
	import { ordersStore } from '$stores/orders.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { formatPrice, formatSize, formatTime } from '$utils/format';
	import Paginator from './Paginator.svelte';

	const PAGE_SIZE = 100;
	let page = $state(1);

	const totalItems = $derived(ordersStore.historicalOrders.length);
	const totalPages = $derived(Math.max(1, Math.ceil(totalItems / PAGE_SIZE)));
	const slicedHistory = $derived(
		ordersStore.historicalOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
	);

	$effect(() => {
		const maxPage = Math.max(1, Math.ceil(ordersStore.historicalOrders.length / PAGE_SIZE));
		if (page > maxPage) page = maxPage;
	});
</script>

<div class="flex flex-col">
	{#if ordersStore.historicalOrders.length === 0}
		<div class="text-center py-8 text-sm text-gray-500">No historical orders</div>
	{:else}
		<div
			class="grid gap-x-3 gap-y-0 px-3 text-xs items-center"
			style="grid-template-columns: 1fr 1.75rem minmax(4rem, auto) minmax(3rem, auto) minmax(4rem, auto) minmax(3.5rem, auto);"
		>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary">Coin</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-center">Side</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Price</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Size</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-center">Status</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Time</div>

			{#each slicedHistory as entry (entry.order.oid + '-' + entry.statusTimestamp)}
				{@const order = entry.order}
				{@const isBuy = order.side === 'B' || order.side === 'buy'}
				{@const pp = marketStore.getCoinPriceParams(order.coin)}
				{@const perp = marketStore.findPerpAsset(order.coin)}
				{@const spot = marketStore.findSpotAsset(order.coin)}
				{@const displayName = perp ? perp.meta.name : spot ? spot.displayName : order.coin}
				{@const rawCoin = spot ? spot.pair.name : order.coin}
				<span class="font-medium whitespace-nowrap min-w-0 overflow-hidden text-ellipsis py-2 border-b border-border-secondary hover:bg-surface-hover">
					{displayName}{#if rawCoin !== displayName}<span class="text-[10px] text-gray-500 font-normal ml-1">{rawCoin}</span>{/if}
				</span>
				<span class="{isBuy ? 'text-long' : 'text-short'} font-medium text-center py-2 border-b border-border-secondary hover:bg-surface-hover">{isBuy ? 'BUY' : 'SELL'}</span>
				<span class="text-right tabular-nums font-semibold font-mono tracking-tight text-gray-900 py-2 border-b border-border-secondary hover:bg-surface-hover">${formatPrice(order.limitPx, pp.szDecimals, pp.isSpot)}</span>
				<span class="text-right tabular-nums font-mono py-2 border-b border-border-secondary hover:bg-surface-hover">{formatSize(order.origSz ?? order.sz, pp.szDecimals)}</span>
				<span class="text-center py-2 border-b border-border-secondary hover:bg-surface-hover">
					<span class="text-[10px] font-medium {entry.status === 'filled' ? 'text-long' : entry.status === 'canceled' || entry.status === 'rejected' ? 'text-short' : 'text-gray-500'}">{entry.status}</span>
				</span>
				<span class="text-right tabular-nums text-gray-500 py-2 border-b border-border-secondary hover:bg-surface-hover">{formatTime(entry.statusTimestamp)}</span>
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
