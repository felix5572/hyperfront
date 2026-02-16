<script lang="ts">
	import { onMount } from 'svelte';
	import { marketStore, type AssetCtx } from '$stores/market.svelte';
	import { formatPrice, formatUsd } from '$utils/format';
	import { API_URL } from '$utils/constants';

	let { coin, ctx }: { coin: string; ctx: AssetCtx | null } = $props();

	let annotation = $state<{ category: string; description: string } | null>(null);
	let predicted = $state<{ fundingRate: string; nextFundingTime: number } | null>(null);
	// tokenDetails for deployer/deployTime/seededUsdc (supply data now comes from SpotCtx)
	let tokenDetails = $state<any>(null);

	const perpAsset = $derived(marketStore.findPerpAsset(coin));
	const spotAsset = $derived(marketStore.findSpotAsset(coin));

	// ID labels for display
	const perpIdLabel = $derived(perpAsset ? `Asset ID: ${perpAsset.assetId}` : '');
	const spotIdLabel = $derived(
		spotAsset ? `${spotAsset.pair.name} · Tokens: [${spotAsset.pair.tokens[0]}, ${spotAsset.pair.tokens[1]}] · Spot ID: ${spotAsset.spotId} · Asset ID: ${spotAsset.assetId}` : ''
	);

	async function fetchRaw(type: string, params: Record<string, unknown> = {}) {
		const resp = await fetch(`${API_URL}/info`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, ...params })
		});
		return resp.json();
	}

	onMount(async () => {
		// Perp-specific data
		if (perpAsset) {
			// Annotation (category + description)
			fetchRaw('perpAnnotation', { coin }).then((r) => {
				if (r?.category) annotation = r;
			}).catch(() => {});

			// Predicted funding
			fetchRaw('predictedFundings').then((r) => {
				if (Array.isArray(r)) {
					const entry = r.find((e: any) => e[0] === coin);
					if (entry?.[1]?.[0]?.[1]) {
						predicted = entry[1][0][1];
					}
				}
			}).catch(() => {});
		}

		// Spot-specific: token details (for deployer/deploy info only)
		if (spotAsset && spotAsset.token.tokenId) {
			fetchRaw('tokenDetails', { tokenId: spotAsset.token.tokenId }).then((r) => {
				if (r?.name) tokenDetails = r;
			}).catch(() => {});
		}
	});

	// Format funding countdown
	function fundingCountdown(nextTime: number): string {
		const diff = nextTime - Date.now();
		if (diff <= 0) return 'now';
		const mins = Math.floor(diff / 60_000);
		const hrs = Math.floor(mins / 60);
		const m = mins % 60;
		return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`;
	}
</script>

<div class="p-3 space-y-3 text-xs">
	<!-- Annotation -->
	{#if annotation}
		<div class="space-y-1">
			{#if annotation.category}
				<div class="flex items-center gap-2">
					<span class="text-gray-400">Category</span>
					<span class="capitalize font-medium">{annotation.category}</span>
				</div>
			{/if}
			{#if annotation.description}
				<p class="text-gray-500 leading-relaxed">{annotation.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Perp info -->
	{#if perpAsset}
		<div class="grid grid-cols-2 gap-1.5">
			<div class="p-2 bg-surface-tertiary rounded col-span-2">
				<p class="text-gray-400 text-[10px]">Identifiers</p>
				<p class="font-medium font-mono text-[11px]">{perpIdLabel}</p>
			</div>
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Max Leverage</p>
				<p class="font-medium">{perpAsset.meta.maxLeverage}x</p>
			</div>
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Size Decimals</p>
				<p class="font-medium">{perpAsset.meta.szDecimals}</p>
			</div>
			{#if perpAsset.meta.onlyIsolated}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Margin Mode</p>
					<p class="font-medium text-yellow-600">Isolated Only</p>
				</div>
			{/if}

			<!-- Funding -->
			{#if ctx?.funding}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Current Funding</p>
					<p class="font-medium tabular-nums {parseFloat(ctx.funding) >= 0 ? 'text-long' : 'text-short'}">
						{(parseFloat(ctx.funding) * 100).toFixed(4)}%
					</p>
				</div>
			{/if}
			{#if predicted}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Predicted Funding</p>
					<p class="font-medium tabular-nums {parseFloat(predicted.fundingRate) >= 0 ? 'text-long' : 'text-short'}">
						{(parseFloat(predicted.fundingRate) * 100).toFixed(4)}%
					</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Next Funding</p>
					<p class="font-medium tabular-nums">{fundingCountdown(predicted.nextFundingTime)}</p>
				</div>
			{/if}
			{#if ctx?.premium}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Premium</p>
					<p class="font-medium tabular-nums">{(parseFloat(ctx.premium) * 100).toFixed(4)}%</p>
				</div>
			{/if}

			<!-- Price & OI -->
		{#if ctx?.oraclePx}
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Oracle Price</p>
				<p class="font-medium tabular-nums">{formatPrice(ctx.oraclePx, perpAsset.meta.szDecimals, false)}</p>
			</div>
		{/if}
		{#if ctx?.markPx}
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Mark Price</p>
				<p class="font-medium tabular-nums">{formatPrice(ctx.markPx, perpAsset.meta.szDecimals, false)}</p>
			</div>
		{/if}
			{#if ctx?.openInterest}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Open Interest</p>
					<p class="font-medium tabular-nums">{formatUsd(parseFloat(ctx.openInterest), true)}</p>
				</div>
			{/if}
			{#if ctx?.dayNtlVlm}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">24h Volume</p>
					<p class="font-medium tabular-nums">{formatUsd(parseFloat(ctx.dayNtlVlm), true)}</p>
				</div>
			{/if}
		{#if ctx?.prevDayPx}
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Prev Day Price</p>
				<p class="font-medium tabular-nums">{formatPrice(ctx.prevDayPx, perpAsset.meta.szDecimals, false)}</p>
			</div>
		{/if}
	</div>
{/if}

<!-- Spot info -->
	{#if spotAsset}
		<div class="grid grid-cols-2 gap-1.5">
			<div class="p-2 bg-surface-tertiary rounded col-span-2">
				<p class="text-gray-400 text-[10px]">Identifiers</p>
				<p class="font-medium font-mono text-[11px]">{spotIdLabel}</p>
			</div>
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Pair Name (API)</p>
				<p class="font-medium font-mono">{spotAsset.pair.name}</p>
			</div>
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Canonical</p>
				<p class="font-medium">{spotAsset.pair.isCanonical ? 'Yes' : 'No'}</p>
			</div>
		</div>

		<!-- Market data from SpotCtx -->
		<div class="grid grid-cols-2 gap-1.5">
		{#if spotAsset.ctx.markPx && spotAsset.ctx.markPx !== '0'}
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Mark Price</p>
				<p class="font-medium tabular-nums">{formatPrice(spotAsset.ctx.markPx, spotAsset.token.szDecimals, true)}</p>
			</div>
		{/if}
		{#if spotAsset.ctx.midPx && spotAsset.ctx.midPx !== '0'}
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Mid Price</p>
				<p class="font-medium tabular-nums">{formatPrice(spotAsset.ctx.midPx, spotAsset.token.szDecimals, true)}</p>
			</div>
		{/if}
		{#if spotAsset.ctx.prevDayPx && spotAsset.ctx.prevDayPx !== '0'}
			<div class="p-2 bg-surface-tertiary rounded">
				<p class="text-gray-400 text-[10px]">Prev Day Price</p>
				<p class="font-medium tabular-nums">{formatPrice(spotAsset.ctx.prevDayPx, spotAsset.token.szDecimals, true)}</p>
			</div>
		{/if}
			{#if spotAsset.ctx.dayNtlVlm && spotAsset.ctx.dayNtlVlm !== '0'}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">24h Volume (Notional)</p>
					<p class="font-medium tabular-nums">{formatUsd(parseFloat(spotAsset.ctx.dayNtlVlm), true)}</p>
				</div>
			{/if}
			{#if spotAsset.ctx.dayBaseVlm && spotAsset.ctx.dayBaseVlm !== '0'}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">24h Volume (Base)</p>
					<p class="font-medium tabular-nums">{parseFloat(spotAsset.ctx.dayBaseVlm).toLocaleString()}</p>
				</div>
			{/if}
			{#if spotAsset.ctx.totalSupply && spotAsset.ctx.totalSupply !== '0'}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Total Supply</p>
					<p class="font-medium tabular-nums">{parseFloat(spotAsset.ctx.totalSupply).toLocaleString()}</p>
				</div>
			{/if}
			{#if spotAsset.ctx.circulatingSupply && spotAsset.ctx.circulatingSupply !== '0'}
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Circulating Supply</p>
					<p class="font-medium tabular-nums">{parseFloat(spotAsset.ctx.circulatingSupply).toLocaleString()}</p>
				</div>
			{/if}
		</div>

		<!-- Base Token details -->
		<div class="space-y-1">
			<p class="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Base Token</p>
			<div class="grid grid-cols-2 gap-1.5">
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Name</p>
					<p class="font-medium">{spotAsset.token.name}{#if spotAsset.token.fullName}<span class="text-gray-400 font-normal"> ({spotAsset.token.fullName})</span>{/if}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Token Index</p>
					<p class="font-medium tabular-nums">{spotAsset.token.index}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">szDecimals</p>
					<p class="font-medium tabular-nums">{spotAsset.token.szDecimals}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">weiDecimals</p>
					<p class="font-medium tabular-nums">{spotAsset.token.weiDecimals}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Canonical</p>
					<p class="font-medium">{spotAsset.token.isCanonical ? 'Yes' : 'No'}</p>
				</div>
			</div>
			<div class="p-2 bg-surface-tertiary rounded w-full">
				<p class="text-[10px]">
					<span class="text-gray-400">tokenId</span>
					<span class="font-medium font-mono break-all"> {spotAsset.token.tokenId || '—'}</span>
				</p>
			</div>
			<div class="p-2 bg-surface-tertiary rounded w-full">
				<p class="text-[10px]">
					<span class="text-gray-400">evmContract</span>
					{#if spotAsset.token.evmContract == null}
						<span class="font-mono text-gray-500"> null</span>
					{:else}
						<span class="font-mono break-all"> {spotAsset.token.evmContract.address}</span>
						{#if spotAsset.token.evmContract.evm_extra_wei_decimals != null}
							<span class="text-gray-400"> · evm_extra_wei_decimals: {spotAsset.token.evmContract.evm_extra_wei_decimals}</span>
						{/if}
					{/if}
				</p>
			</div>
		</div>

		<!-- Quote Token details -->
		<div class="space-y-1">
			<p class="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Quote Token</p>
			<div class="grid grid-cols-2 gap-1.5">
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Name</p>
					<p class="font-medium">{spotAsset.quoteToken.name}{#if spotAsset.quoteToken.fullName}<span class="text-gray-400 font-normal"> ({spotAsset.quoteToken.fullName})</span>{/if}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">Token Index</p>
					<p class="font-medium tabular-nums">{spotAsset.quoteToken.index}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">szDecimals</p>
					<p class="font-medium tabular-nums">{spotAsset.quoteToken.szDecimals}</p>
				</div>
				<div class="p-2 bg-surface-tertiary rounded">
					<p class="text-gray-400 text-[10px]">weiDecimals</p>
					<p class="font-medium tabular-nums">{spotAsset.quoteToken.weiDecimals}</p>
				</div>
			</div>
			<div class="p-2 bg-surface-tertiary rounded w-full">
				<p class="text-[10px]">
					<span class="text-gray-400">tokenId</span>
					<span class="font-medium font-mono break-all"> {spotAsset.quoteToken.tokenId || '—'}</span>
				</p>
			</div>
			<div class="p-2 bg-surface-tertiary rounded w-full">
				<p class="text-[10px]">
					<span class="text-gray-400">evmContract</span>
					{#if spotAsset.quoteToken.evmContract == null}
						<span class="font-mono text-gray-500"> null</span>
					{:else}
						<span class="font-mono break-all"> {spotAsset.quoteToken.evmContract.address}</span>
						{#if spotAsset.quoteToken.evmContract.evm_extra_wei_decimals != null}
							<span class="text-gray-400"> · evm_extra_wei_decimals: {spotAsset.quoteToken.evmContract.evm_extra_wei_decimals}</span>
						{/if}
					{/if}
				</p>
			</div>
		</div>

		<!-- Deploy info from tokenDetails API (deployer, deploy time, seeded USDC) -->
		{#if tokenDetails}
			<div class="grid grid-cols-2 gap-1.5">
				{#if tokenDetails.deployer}
					<div class="p-2 bg-surface-tertiary rounded col-span-2">
						<p class="text-gray-400 text-[10px]">Deployer</p>
						<p class="font-medium font-mono text-[10px] truncate">{tokenDetails.deployer}</p>
					</div>
				{/if}
				{#if tokenDetails.deployTime}
					<div class="p-2 bg-surface-tertiary rounded">
						<p class="text-gray-400 text-[10px]">Deploy Time</p>
						<p class="font-medium tabular-nums">{new Date(tokenDetails.deployTime).toLocaleDateString()}</p>
					</div>
				{/if}
				{#if tokenDetails.deployGas}
					<div class="p-2 bg-surface-tertiary rounded">
						<p class="text-gray-400 text-[10px]">Deploy Gas</p>
						<p class="font-medium tabular-nums">{tokenDetails.deployGas}</p>
					</div>
				{/if}
				{#if tokenDetails.seededUsdc}
					<div class="p-2 bg-surface-tertiary rounded">
						<p class="text-gray-400 text-[10px]">Seeded USDC</p>
						<p class="font-medium tabular-nums">{formatUsd(parseFloat(tokenDetails.seededUsdc))}</p>
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	{#if !perpAsset && !spotAsset && !ctx}
		<div class="text-center py-4 text-gray-400">No additional info available</div>
	{/if}
</div>
