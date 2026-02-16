<script lang="ts">
	import type { Position } from '$stores/account.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { formatUsd, formatPrice, formatSize, formatPct } from '$utils/format';
	import CoinAvatar from '$components/common/CoinAvatar.svelte';

	let { position }: { position: Position } = $props();

	const szi = $derived(parseFloat(position.szi));
	const isLong = $derived(szi > 0);
	const pnl = $derived(parseFloat(position.unrealizedPnl));
	const roe = $derived(parseFloat(position.returnOnEquity));
	const isPnlPositive = $derived(pnl >= 0);

	const pp = $derived(marketStore.getCoinPriceParams(position.coin));
</script>

<a
	href="/market/{encodeURIComponent(position.coin)}/"
	class="block p-3 bg-surface-secondary rounded-lg border border-border-secondary hover:border-border-primary active:bg-surface-hover transition-colors"
>
	<!-- Top row: coin + side + PnL -->
	<div class="flex items-center justify-between mb-2">
		<div class="flex items-center gap-2">
			<CoinAvatar symbol={position.coin} size={22} />
			<span class="font-semibold text-sm">{position.coin}</span>
			<span class="text-xs px-1.5 py-0.5 rounded font-medium {isLong ? 'bg-long-dim text-long' : 'bg-short-dim text-short'}">
				{isLong ? 'LONG' : 'SHORT'}
			</span>
			{#if position.leverage}
				<span class="text-xs text-gray-500">{position.leverage.value}x</span>
			{/if}
		</div>
		<div class="text-right">
			<span class="text-sm font-medium tabular-nums {isPnlPositive ? 'text-long' : 'text-short'}">
				{formatUsd(pnl)}
			</span>
			<span class="text-xs tabular-nums {isPnlPositive ? 'text-long' : 'text-short'} ml-1">
				{formatPct(roe)}
			</span>
		</div>
	</div>

	<!-- Details grid -->
	<div class="grid grid-cols-3 gap-2 text-xs">
		<div>
			<p class="text-gray-500">Size</p>
			<p class="tabular-nums">{formatSize(Math.abs(szi), pp.szDecimals)}</p>
		</div>
		<div>
			<p class="text-gray-500">Entry</p>
			<p class="tabular-nums">{position.entryPx ? formatPrice(position.entryPx, pp.szDecimals, pp.isSpot) : '-'}</p>
		</div>
		<div>
			<p class="text-gray-500">Liq. Price</p>
			<p class="tabular-nums text-short/70">{position.liquidationPx ? formatPrice(position.liquidationPx, pp.szDecimals, pp.isSpot) : '-'}</p>
		</div>
	</div>
</a>
