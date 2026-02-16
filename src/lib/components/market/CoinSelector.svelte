<script lang="ts">
	import { marketStore } from '$stores/market.svelte';
	import { formatPrice } from '$utils/format';
	const DEFAULT_COINS = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ARB', 'SUI', 'AVAX', 'LINK', 'MATIC'] as const;

	let showDropdown = $state(false);

	const currentMid = $derived(marketStore.midPrice);

	function handleSelect(coin: string) {
		marketStore.selectCoin(coin);
		showDropdown = false;
	}
</script>

<div class="relative">
	<button
		class="flex items-center gap-2 px-3 py-2 bg-surface-secondary rounded-lg border border-border-secondary hover:border-border-primary transition-colors"
		onclick={() => showDropdown = !showDropdown}
	>
		<span class="font-bold text-base">{marketStore.selectedCoin}</span>
	{#if currentMid}
		{@const pp = marketStore.getCoinPriceParams(marketStore.selectedCoin)}
		<span class="text-sm tabular-nums text-gray-400">{formatPrice(currentMid, pp.szDecimals, pp.isSpot)}</span>
	{/if}
		<svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	{#if showDropdown}
		<!-- backdrop -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={() => showDropdown = false} onkeydown={() => {}}></div>
		<div class="absolute left-0 top-full mt-1 z-50 bg-surface-tertiary border border-border-primary rounded-lg shadow-xl max-h-64 overflow-y-auto min-w-[180px]">
			{#each DEFAULT_COINS as coin}
				{@const mid = marketStore.allMids[coin]}
				<button
					class="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-surface-hover transition-colors {coin === marketStore.selectedCoin ? 'text-accent' : ''}"
					onclick={() => handleSelect(coin)}
				>
					<span class="font-medium">{coin}</span>
				{#if mid}
					{@const pp = marketStore.getCoinPriceParams(coin)}
					<span class="text-xs tabular-nums text-gray-500">{formatPrice(mid, pp.szDecimals, pp.isSpot)}</span>
				{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
