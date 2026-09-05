<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { marketStore } from '$stores/market.svelte';
	import { accountStore } from '$stores/account.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import CoinCard from '$components/market/CoinCard.svelte';

	const tabs = [
		{ id: 'perp' as const, label: 'Perp' },
		{ id: 'spot' as const, label: 'Spot' },
		{ id: 'hip3' as const, label: 'HIP-3' }
	];

	let tokensExpanded = $state(false);
	let leverageLoadedFor = $state<`0x${string}` | null>(null);

	const leverageByCoin = $derived.by(() => {
		const map = new Map<string, number>();
		for (const p of accountStore.forAddress(walletStore.address).positions) {
			if (p?.coin && p?.leverage?.value != null) {
				map.set(p.coin, p.leverage.value);
			}
		}
		return map;
	});

	onMount(async () => {
		await marketStore.initMarketList();
	});

	$effect(() => {
		const addr = walletStore.address;
		if (!addr || addr === leverageLoadedFor) return;
		leverageLoadedFor = addr;
		untrack(() => { void accountStore.fetchAccountState(addr); });
	});
</script>

<svelte:head>
	<title>Markets | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full">
	<!-- Primary Tabs: Perp / Spot / HIP-3 -->
	<div class="flex border-b border-border-secondary">
		{#each tabs as tab (tab.id)}
			{@const count = tab.id === 'perp'
				? marketStore.filteredPerpAssets.length
				: tab.id === 'spot'
					? marketStore.filteredSpotAssets.length
					: marketStore.filteredHip3Assets.length}
			<button
				class="flex-1 py-2.5 text-sm font-medium text-center transition-colors {marketStore.activeTab === tab.id ? 'text-accent border-b-2 border-accent' : 'text-gray-500'}"
				onclick={() => marketStore.setTab(tab.id)}
			>
				{tab.label} ({count})
			</button>
		{/each}
	</div>

	<!-- HIP-3 DEX sub-tabs (scrollable row) -->
	{#if marketStore.activeTab === 'hip3'}
		<div class="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-border-secondary no-scrollbar">
			{#if marketStore.hip3Dexes.length === 0}
				<span class="text-xs text-gray-500">Loading DEXes...</span>
			{:else}
				<!-- "All" button -->
				<button
					class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors
						{marketStore.activeHip3Dex === '__all__'
							? 'bg-accent text-white'
							: 'bg-surface-tertiary text-gray-600 hover:bg-surface-hover'}"
					onclick={() => marketStore.selectHip3Dex('__all__')}
				>
					All
				</button>
				{#each marketStore.hip3Dexes as dex (dex.name)}
					<button
						class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors
							{marketStore.activeHip3Dex === dex.name
								? 'bg-accent text-white'
								: 'bg-surface-tertiary text-gray-600 hover:bg-surface-hover'}"
						onclick={() => marketStore.selectHip3Dex(dex.name)}
					>
						{dex.name}
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Spot: Tokens collapsible (above search bar) -->
	{#if marketStore.activeTab === 'spot' && marketStore.spotTokens.length > 0}
		<div class="border-b border-border-secondary">
			<button
				class="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-gray-600 hover:bg-surface-hover transition-colors"
				onclick={() => tokensExpanded = !tokensExpanded}
			>
				<span>Tokens ({marketStore.spotTokens.length})</span>
				<svg
					class="w-4 h-4 transition-transform {tokensExpanded ? 'rotate-180' : ''}"
					viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>

			{#if tokensExpanded}
				<div class="max-h-[360px] overflow-y-auto divide-y divide-border-secondary border-t border-border-secondary">
					{#each marketStore.spotTokens as token (token.index)}
						<div class="px-3 py-2.5 text-xs space-y-1">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="font-semibold">{token.name}</span>
									{#if token.fullName}
										<span class="text-gray-400">({token.fullName})</span>
									{/if}
									{#if token.isCanonical}
										<span class="text-[9px] px-1 py-0.5 bg-accent/10 text-accent rounded">Canonical</span>
									{/if}
								</div>
								<span class="text-gray-400 tabular-nums font-mono">Index: {token.index}</span>
							</div>
							<div class="flex gap-3 text-[10px] text-gray-500">szDec: {token.szDecimals} · weiDec: {token.weiDecimals}</div>
							<p class="text-[10px]">
								<span class="text-gray-400">tokenId</span>
								<span class="font-mono text-gray-700 break-all"> {token.tokenId || '—'}</span>
							</p>
							<p class="text-[10px]">
								evmContract
								{#if token.evmContract == null || token.evmContract === undefined}
									<span class="font-mono text-gray-500"> null</span>
								{:else}
									<span class="font-mono text-gray-700 break-all"> {token.evmContract.address}</span>
									{#if token.evmContract.evm_extra_wei_decimals != null}
										<span class="text-gray-500"> · evm_extra_wei_decimals: {token.evmContract.evm_extra_wei_decimals}</span>
									{/if}
								{/if}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Search bar -->
	<div class="px-3 py-2 border-b border-border-secondary">
		<input
			type="text"
			placeholder="Search coins..."
			value={marketStore.searchQuery}
			oninput={(e) => marketStore.setSearch((e.target as HTMLInputElement).value)}
			class="w-full px-3 py-2 bg-surface-tertiary border border-border-primary rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
		/>
	</div>

	<!-- Coin list -->
	<div class="flex-1 overflow-y-auto p-3 space-y-2">
		{#if marketStore.activeTab === 'perp'}
			{#if marketStore.filteredPerpAssets.length === 0}
				<div class="text-center py-8 text-sm text-gray-500">
					{marketStore.searchQuery ? 'No matching perps' : 'Loading...'}
				</div>
			{:else}
			{#each marketStore.filteredPerpAssets as asset (asset.meta.name)}
				<CoinCard
					coin={asset.meta.name}
					pairSuffix={` - ${marketStore.mainQuote}`}
					idLabel={`Asset ID: ${asset.assetId}`}
					maxLeverage={asset.meta.maxLeverage}
					currentLeverage={leverageByCoin.get(asset.meta.name) ?? null}
					href="/market/{encodeURIComponent(asset.meta.name)}/"
					markPx={asset.ctx.markPx ?? '0'}
					prevDayPx={asset.ctx.prevDayPx ?? '0'}
					dayNtlVlm={asset.ctx.dayNtlVlm ?? '0'}
					funding={asset.ctx.funding}
					openInterest={asset.ctx.openInterest}
					szDecimals={asset.meta.szDecimals}
				/>
				{/each}
			{/if}
		{:else if marketStore.activeTab === 'spot'}
			{#if marketStore.filteredSpotAssets.length === 0}
				<div class="text-center py-8 text-sm text-gray-500">
					{marketStore.searchQuery ? 'No matching spot tokens' : 'Loading...'}
				</div>
			{:else}
			{#each marketStore.filteredSpotAssets as asset (asset.pair.name)}
				<CoinCard
					coin={asset.displayName}
					idLabel={asset.spotId}
					href="/market/{encodeURIComponent(asset.pair.name)}/"
					markPx={asset.ctx.markPx ?? '0'}
					prevDayPx={asset.ctx.prevDayPx ?? '0'}
					dayNtlVlm={asset.ctx.dayNtlVlm ?? '0'}
					szDecimals={asset.token.szDecimals}
					isSpot={true}
				/>
				{/each}
			{/if}
		{:else}
			<!-- HIP-3 tab -->
			{#if marketStore.hip3Loading}
				<div class="text-center py-8 text-sm text-gray-500">Loading {marketStore.activeHip3Dex === '__all__' ? 'all DEXes' : marketStore.activeHip3Dex} assets...</div>
			{:else if marketStore.filteredHip3Assets.length === 0}
				<div class="text-center py-8 text-sm text-gray-500">
					{marketStore.searchQuery ? 'No matching assets' : 'No assets found'}
				</div>
			{:else}
			{#each marketStore.filteredHip3Assets as asset (asset.meta.name)}
				<CoinCard
					coin={asset.meta.name}
					pairSuffix={` - ${asset.quoteCurrency ?? marketStore.hip3Quote}`}
					idLabel={`Asset ID: ${asset.assetId}`}
					idLabelOnNewLine={true}
					maxLeverage={asset.meta.maxLeverage}
					currentLeverage={leverageByCoin.get(asset.meta.name) ?? null}
					href="/market/{encodeURIComponent(asset.meta.name)}/"
					markPx={asset.ctx.markPx ?? '0'}
					prevDayPx={asset.ctx.prevDayPx ?? '0'}
					dayNtlVlm={asset.ctx.dayNtlVlm ?? '0'}
					funding={asset.ctx.funding}
					openInterest={asset.ctx.openInterest}
					szDecimals={asset.meta.szDecimals}
				/>
				{/each}
			{/if}
		{/if}
	</div>
</div>

<style>
	/* Hide scrollbar for HIP-3 sub-tab row */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
