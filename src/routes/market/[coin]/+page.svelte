<script lang="ts">
	import { page } from '$app/state';
	import { onMount, onDestroy } from 'svelte';
	import { marketStore, type AssetCtx } from '$stores/market.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { ordersStore } from '$stores/orders.svelte';
	import { subscribeActiveAssetCtx, subscriptionError, unsubscribe } from '$api/subscriptions';
	import CandlestickChart from '$components/market/CandlestickChart.svelte';
	import StatsBar from '$components/market/StatsBar.svelte';
	import OrderBook from '$components/market/OrderBook.svelte';
	import OrderForm from '$components/market/OrderForm.svelte';
	import PerpLeverageControl from '$components/market/PerpLeverageControl.svelte';
	import CoinInfo from '$components/market/CoinInfo.svelte';
	import CoinAvatar from '$components/common/CoinAvatar.svelte';
	import OpenOrders from '$components/orders/OpenOrders.svelte';
	import FillHistory from '$components/orders/FillHistory.svelte';
	import { formatPrice } from '$utils/format';

	const coin = $derived(decodeURIComponent(page.params.coin ?? ''));

	let liveCtx = $state<AssetCtx | null>(null);
	let wsError = $state<string | null>(null);
	let ordersExpanded = $state(false);
	let ordersTab = $state<'open' | 'history'>('open');

	const perpAsset = $derived(marketStore.findPerpAsset(coin));
	const spotAsset = $derived(marketStore.findSpotAsset(coin));
	const hip3DexFromCoin = $derived(
		coin.includes(':') ? coin.split(':')[0] : ''
	);

	const staticCtx = $derived(
		perpAsset?.ctx ??
		(spotAsset?.ctx as unknown as AssetCtx) ??
		null
	);
	const ctx = $derived(liveCtx ?? staticCtx);

	// Resolve human-readable display name (avoid showing raw "@1" as title)
	const displayName = $derived(
		perpAsset ? perpAsset.meta.name
		: spotAsset ? spotAsset.displayName
		: coin
	);

	// Show raw coin/pair name when it differs from displayName (e.g. "@1" vs "HFUN / USDC")
	const rawCoinLabel = $derived(
		coin !== displayName ? coin : ''
	);

	// Build ID labels for display
	const idLabelTop = $derived(
		spotAsset
			? `${spotAsset.pair.name} · Tokens: [${spotAsset.pair.tokens[0]}, ${spotAsset.pair.tokens[1]}] · Spot ID: ${spotAsset.spotId}`
			: perpAsset && perpAsset.assetId < 100000
				? `Asset ID: ${perpAsset.assetId}`
				: ''
	);
	const idLabelBottom = $derived(
		spotAsset ? `Asset ID: ${spotAsset.assetId}` : ''
	);
	const isHip3Asset = $derived(
		!!perpAsset && perpAsset.assetId >= 100000
	);

	// Price formatting params from asset metadata
	const szDecimals = $derived(
		perpAsset ? perpAsset.meta.szDecimals
		: spotAsset ? spotAsset.token.szDecimals
		: 0
	);
	const isSpot = $derived(!!spotAsset);

	const mark = $derived(ctx ? parseFloat(ctx.markPx ?? '0') : 0);
	const prev = $derived(ctx ? parseFloat(ctx.prevDayPx ?? '0') : 0);
	const change24h = $derived(prev > 0 ? ((mark - prev) / prev) * 100 : 0);
	const isPositive = $derived(change24h >= 0);

	let subscribedUser: `0x${string}` | null = null;
	let activeCoin = $state('');
	let switchingCoin = $state(false);
	let coinSwitchSeq = 0;

	async function switchCoin(nextCoin: string) {
		if (!nextCoin || nextCoin === activeCoin || switchingCoin) return;
		switchingCoin = true;
		const seq = ++coinSwitchSeq;
		try {
			// Unsubscribe old coin-specific stream before switching
			if (activeCoin) {
				await unsubscribe(`activeAssetCtx:${activeCoin}`);
			}

			// For HIP-3 assets (e.g. "xyz:XYZ100"), load dex data before selecting coin.
			const dexFromCoin = nextCoin.includes(':') ? nextCoin.split(':')[0] : '';
			if (
				!marketStore.findPerpAsset(nextCoin) &&
				dexFromCoin &&
				marketStore.hip3Dexes.some((d) => d.name === dexFromCoin)
			) {
				await marketStore.selectHip3Dex(dexFromCoin);
			}

			await marketStore.selectCoin(nextCoin);
			await subscribeActiveAssetCtx(nextCoin, (data: unknown) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const d = data as any;
				// Ignore late updates from stale async switches
				if (seq !== coinSwitchSeq) return;
				if (d?.ctx) liveCtx = d.ctx as AssetCtx;
			});
			if (seq === coinSwitchSeq) {
				activeCoin = nextCoin;
			}
		} finally {
			if (seq === coinSwitchSeq) {
				switchingCoin = false;
			}
		}
	}

	onMount(async () => {
		try {
			if (marketStore.perpAssets.length === 0) {
				await marketStore.initMarketList();
			}
			await switchCoin(coin);

			// Subscribe to orders if wallet connected
			if (walletStore.address) {
				subscribedUser = walletStore.address;
				await ordersStore.subscribeOrders(subscribedUser);
			}
		} catch (e) {
			wsError = e instanceof Error ? e.message : String(e);
		}
	});

	onDestroy(() => {
		void marketStore.unselectCoin();
		if (activeCoin) {
			void unsubscribe(`activeAssetCtx:${activeCoin}`);
		}
		if (subscribedUser) {
			void ordersStore.unsubscribeOrders(subscribedUser);
		}
	});

	$effect(() => {
		const c = coin;
		if (!c) return;
		void switchCoin(c);
	});

	$effect(() => {
		const err = $subscriptionError;
		if (err) wsError = err;
	});
</script>

<svelte:head>
	<title>{displayName} | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full overflow-y-auto">
	{#if wsError}
		<div class="mx-3 mt-2 p-2 rounded border border-red-300 bg-red-50 text-red-700 text-xs">
			Realtime connection error: {wsError}
		</div>
	{/if}
	<!-- Header bar -->
	<div class="flex items-center gap-3 px-3 py-2 border-b border-border-secondary shrink-0">
		<a href="/market/" class="text-gray-400 hover:text-gray-700 transition-colors" aria-label="Back to markets">
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M15 18l-6-6 6-6" />
			</svg>
		</a>
		<div class="flex flex-col">
			<div class="flex items-center gap-2">
				<CoinAvatar symbol={displayName} size={24} />
				<span class="font-bold text-base">{displayName}</span>
				{#if rawCoinLabel}
					<span class="text-xs text-gray-400 font-mono">{rawCoinLabel}</span>
				{/if}
			{#if mark > 0}
				<span class="text-sm tabular-nums font-semibold font-mono tracking-tight text-gray-900">${formatPrice(mark, szDecimals, isSpot)}</span>
				<span class="text-xs tabular-nums px-1.5 py-0.5 rounded font-medium {isPositive ? 'bg-long-dim text-long' : 'bg-short-dim text-short'}">
					24H: {isPositive ? '+' : ''}{change24h.toFixed(2)}%
				</span>
			{/if}
			</div>
			{#if idLabelTop}
				<span class="text-[10px] text-gray-400 font-mono tabular-nums">{idLabelTop}</span>
			{/if}
			{#if isHip3Asset}
				<span class="text-[10px] text-gray-400 font-mono tabular-nums">Asset ID: {perpAsset?.assetId}</span>
			{:else if idLabelBottom}
				<span class="text-[10px] text-gray-400 font-mono tabular-nums">{idLabelBottom}</span>
			{/if}
		</div>
	</div>

	<!-- Stats bar -->
	{#if ctx}
		<StatsBar {ctx} {szDecimals} {isSpot} />
	{/if}

	<!-- Candlestick chart -->
	<CandlestickChart {coin} />

	<!-- Middle row: OrderForm (2/3) + OrderBook (1/3) -->
	<div class="grid grid-cols-3 border-t border-border-secondary" style="min-height: 460px;">
		<div class="col-span-2 border-r border-border-secondary">
			<OrderForm {coin} {szDecimals} {isSpot} />
		</div>
		<div class="col-span-1">
			<OrderBook {szDecimals} {isSpot} />
		</div>
	</div>

	{#if !isSpot}
		<div class="border-t border-border-secondary">
			<PerpLeverageControl {coin} />
		</div>
	{/if}

	<!-- Expandable Orders section -->
	<div class="border-t border-border-secondary">
		<button
			class="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-gray-500 hover:bg-surface-hover transition-colors"
			onclick={() => ordersExpanded = !ordersExpanded}
		>
			<span>Orders</span>
			<svg
				class="w-4 h-4 transition-transform {ordersExpanded ? 'rotate-180' : ''}"
				viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</button>

		{#if ordersExpanded}
			{#if !walletStore.isConnected}
				<div class="px-3 pb-3 text-xs text-gray-400 text-center">Connect wallet to view orders</div>
			{:else}
				<!-- Tabs -->
				<div class="flex border-b border-border-secondary">
					<button
						class="flex-1 py-1.5 text-xs font-medium text-center transition-colors {ordersTab === 'open' ? 'text-accent border-b-2 border-accent' : 'text-gray-500'}"
						onclick={() => ordersTab = 'open'}
					>
						Open Orders ({ordersStore.openOrders.length})
					</button>
					<button
						class="flex-1 py-1.5 text-xs font-medium text-center transition-colors {ordersTab === 'history' ? 'text-accent border-b-2 border-accent' : 'text-gray-500'}"
						onclick={() => ordersTab = 'history'}
					>
						Fill History ({ordersStore.fills.length})
					</button>
				</div>

				<div class="max-h-[200px] overflow-y-auto">
					{#if ordersTab === 'open'}
						<OpenOrders />
					{:else}
						<FillHistory />
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Coin Info -->
	<div class="border-t border-border-secondary">
		<CoinInfo {coin} {ctx} />
	</div>
</div>
