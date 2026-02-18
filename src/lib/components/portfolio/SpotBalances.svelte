<script lang="ts">
	import { accountStore } from '$stores/account.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { formatUsd } from '$utils/format';
	import CoinAvatar from '$components/common/CoinAvatar.svelte';

	const balances = $derived(
		[...accountStore.spotBalancesFull].sort(
			(a, b) => parseFloat(b.entryNtl) - parseFloat(a.entryNtl)
		)
	);

	const STABLES = ['USDC', 'USDT', 'USDT0', 'USDE', 'USDH'];

	function getUsdValue(coin: string, total: string, tokenIndex: number): number {
		if (STABLES.includes(coin)) return parseFloat(total);
		const mid = marketStore.getSpotMidPrice(coin, tokenIndex);
		if (!mid) return 0;
		return parseFloat(total) * mid;
	}

	function pnlPct(currentVal: number, entryNtl: number): number | null {
		const entry = parseFloat(String(entryNtl));
		if (entry <= 0 || !Number.isFinite(entry)) return null;
		return ((currentVal - entry) / entry) * 100;
	}
</script>

<div class="px-4 pb-4">
	<h3 class="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
		Spot Balances ({balances.length})
	</h3>

	{#if balances.length === 0}
		<div class="text-center py-6 text-sm text-gray-500">No spot balances</div>
	{:else}
		<div class="space-y-1.5">
			{#each balances as b (b.token)}
				{@const usdVal = getUsdValue(b.coin, b.total, b.token)}
				{@const entry = parseFloat(b.entryNtl)}
				{@const pct = pnlPct(usdVal, entry)}
				{@const spotAsset = marketStore.spotAssets.find((a) => a.token.name === b.coin || a.token.index === b.token)}
				{@const marketHref = spotAsset ? `/market/${encodeURIComponent(spotAsset.pair.name)}/` : null}
				{@const rowClass = "px-2.5 py-2 bg-surface-secondary rounded-lg border border-border-secondary text-xs hover:border-border-primary active:bg-surface-hover transition-colors"}
				{#if marketHref}
					<a href={marketHref} class="block {rowClass}">
						<div class="flex items-center gap-1.5">
							<CoinAvatar symbol={b.coin} size={20} />
							<span class="font-semibold">{b.coin}</span>
							<span class="text-gray-500 font-mono text-[11px]">token {b.token}</span>
						</div>
						<div class="mt-1 text-gray-600 font-mono tabular-nums text-[11px]">
							total {parseFloat(b.total).toFixed(4)} · hold {parseFloat(b.hold).toFixed(4)}
						</div>
						<div class="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] tabular-nums">
							{#if usdVal > 0}
								<span class="text-gray-600">≈ {formatUsd(usdVal)}</span>
							{/if}
							{#if entry > 0}
								<span class="text-gray-500">entry {formatUsd(entry)}</span>
							{/if}
							{#if pct !== null}
								{@const pnlAmt = usdVal - entry}
								<span class="{pnlAmt >= 0 ? 'text-long' : 'text-short'} font-medium">
									{pnlAmt >= 0 ? '+' : ''}{formatUsd(pnlAmt)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class={rowClass}>
						<div class="flex items-center gap-1.5">
							<CoinAvatar symbol={b.coin} size={20} />
							<span class="font-semibold">{b.coin}</span>
							<span class="text-gray-500 font-mono text-[11px]">token {b.token}</span>
						</div>
						<div class="mt-1 text-gray-600 font-mono tabular-nums text-[11px]">
							total {parseFloat(b.total).toFixed(4)} · hold {parseFloat(b.hold).toFixed(4)}
						</div>
						<div class="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] tabular-nums">
							{#if usdVal > 0}
								<span class="text-gray-600">≈ {formatUsd(usdVal)}</span>
							{/if}
							{#if entry > 0}
								<span class="text-gray-500">entry {formatUsd(entry)}</span>
							{/if}
							{#if pct !== null}
								{@const pnlAmt = usdVal - entry}
								<span class="{pnlAmt >= 0 ? 'text-long' : 'text-short'} font-medium">
									{pnlAmt >= 0 ? '+' : ''}{formatUsd(pnlAmt)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
								</span>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
