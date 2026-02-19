<script lang="ts">
	import { marketStore } from '$stores/market.svelte';
	import { accountStore } from '$stores/account.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { formatPrice, formatSize, formatUsd, tickSize } from '$utils/format';
	import { createHlWalletAdapter } from '$lib/wallet/hlWalletAdapter';
	import { placeOrder as apiPlaceOrder } from '$lib/api/exchange';
	import type { Tif } from '$lib/api/exchange';

	let {
		coin,
		szDecimals = 0,
		isSpot = false
	}: { coin: string; szDecimals?: number; isSpot?: boolean } = $props();

	let side = $state<'buy' | 'sell'>('buy');
	let orderType = $state<'market' | 'limit'>('limit');
	let priceInput = $state('');
	let sizeInput = $state('');
	let sizeAsset = $state<'base' | 'quote'>('quote');
	let allocationPct = $state(0);
	let reduceOnly = $state(false);
	let tif = $state<Tif>('Gtc');
	let showTifHelp = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let accountLoadedFor = $state<`0x${string}` | null>(null);
	let lastCoin = $state('');

	const isBuy = $derived(side === 'buy');
	const midPx = $derived(marketStore.midPrice);
	const spotAsset = $derived(isSpot ? marketStore.findSpotAsset(coin) : undefined);
	const baseAssetName = $derived(isSpot ? (spotAsset?.token.name ?? coin) : coin);
	const quoteAssetName = $derived(isSpot ? (spotAsset?.quoteToken.name ?? 'USDC') : marketStore.mainQuote);

	const baseBalance = $derived(
		isSpot
			? parseFloat(accountStore.spotBalancesFull.find((b) => b.coin === baseAssetName)?.total ?? '0')
			: Math.abs(parseFloat(accountStore.positions.find((p) => p.coin === coin)?.szi ?? '0'))
	);
	const quoteBalance = $derived(
		isSpot
			? parseFloat(accountStore.spotBalancesFull.find((b) => b.coin === quoteAssetName)?.total ?? '0')
			: parseFloat(accountStore.withdrawable ?? '0')
	);
	const usdcBalance = $derived(
		parseFloat(
			accountStore.spotBalancesFull.find((b) => b.coin === 'USDC')?.total ?? '0'
		)
	);
	const stablecoinBalance = $derived(isSpot ? usdcBalance : quoteBalance);
	const midPxNum = $derived(parseFloat(midPx ?? ''));
	const baseHoldingValueAtMid = $derived(
		Number.isFinite(baseBalance) && baseBalance > 0 && Number.isFinite(midPxNum) && midPxNum > 0
			? baseBalance * midPxNum
			: 0
	);
	const allocationSliderDisabled = $derived(
		sizeAsset === 'base'
			? (!Number.isFinite(baseBalance) || baseBalance <= 0)
			: (!Number.isFinite(quoteBalance) || quoteBalance <= 0)
	);
	const activePriceStr = $derived(
		orderType === 'limit' ? priceInput.trim() : (midPx ?? '')
	);
	const activePriceNum = $derived(parseFloat(activePriceStr));
	const inputAmountNum = $derived(parseFloat(sizeInput.trim()));
	const effectiveBaseSize = $derived(
		Number.isFinite(inputAmountNum) && inputAmountNum > 0
			? sizeAsset === 'base'
				? inputAmountNum
				: Number.isFinite(activePriceNum) && activePriceNum > 0
					? inputAmountNum / activePriceNum
					: null
			: null
	);
	const estimatedQuoteValue = $derived(
		Number.isFinite(inputAmountNum) && inputAmountNum > 0
			? sizeAsset === 'quote'
				? inputAmountNum
				: Number.isFinite(activePriceNum) && activePriceNum > 0
					? inputAmountNum * activePriceNum
					: null
			: null
	);

	function setMidPrice() {
		if (midPx) priceInput = formatPrice(midPx, szDecimals, isSpot);
	}

	function adjustPrice(delta: number) {
		const current = parseFloat(priceInput);
		if (isNaN(current)) return;
		const tick = tickSize(current, szDecimals, isSpot);
		const next = current + delta * tick;
		priceInput = formatPrice(next, szDecimals, isSpot);
	}

	function syncSliderFromInput() {
		const val = parseFloat(sizeInput.trim());
		if (!Number.isFinite(val) || val <= 0) {
			allocationPct = 0;
			return;
		}
		const balance = sizeAsset === 'base' ? baseBalance : quoteBalance;
		if (!Number.isFinite(balance) || balance <= 0) {
			allocationPct = 0;
			return;
		}
		allocationPct = Math.min(100, Math.round((val / balance) * 100));
	}

	function applyAllocation(pct: number) {
		submitError = null;
		if (allocationSliderDisabled) {
			allocationPct = 0;
			sizeInput = '';
			return;
		}
		if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
			submitError = 'Allocation must be between 0 and 100';
			return;
		}
		allocationPct = pct;
		if (pct === 0) {
			sizeInput = '';
			return;
		}
		if (sizeAsset === 'base') {
			if (!Number.isFinite(baseBalance) || baseBalance <= 0) {
				submitError = `${baseAssetName} balance not available`;
				return;
			}
			sizeInput = formatSize(baseBalance * (pct / 100), Math.max(0, szDecimals));
			return;
		}
		if (!Number.isFinite(quoteBalance) || quoteBalance <= 0) {
			submitError = `${quoteAssetName} balance not available`;
			return;
		}
		sizeInput = formatSize(quoteBalance * (pct / 100), 4);
	}

	async function submitOrder() {
		submitError = null;
		if (!walletStore.isConnected || !walletStore.walletClient || !walletStore.address) {
			submitError = 'Connect wallet first';
			return;
		}
		const asset = marketStore.getAssetId(coin);
		if (asset == null) {
			submitError = `Unknown asset: ${coin}`;
			return;
		}
		const baseSize = effectiveBaseSize;
		if (typeof baseSize !== 'number' || !Number.isFinite(baseSize) || baseSize <= 0) {
			submitError = 'Enter a valid size';
			return;
		}
		const sizeStr = formatSize(baseSize, Math.max(0, szDecimals));
		const midNum = parseFloat(midPx ?? '');
		if (orderType === 'limit') {
			const priceNum = parseFloat(priceInput.trim());
			if (isNaN(priceNum) || priceNum <= 0) {
				submitError = 'Enter a valid price';
				return;
			}
		} else {
			if (!midPx || !Number.isFinite(midNum) || midNum <= 0) {
				submitError = 'Mid price not available for market order';
				return;
			}
		}
		// Market order: use mid ± 3% slippage as worst-acceptable price
		const slippagePrice = orderType === 'market'
			? formatPrice(midNum * (side === 'buy' ? 1.03 : 0.97), szDecimals, isSpot)
			: priceInput.trim();
		const priceStr = slippagePrice;
		const wallet = createHlWalletAdapter(walletStore.walletClient, walletStore.address);
		if (!wallet) {
			submitError = 'Wallet not ready';
			return;
		}
		submitting = true;
		try {
			const result = await apiPlaceOrder(wallet, {
				asset,
				side,
				orderType,
				price: priceStr,
				size: sizeStr,
				reduceOnly,
				tif: orderType === 'limit' ? tif : undefined
			});
			const first = result.statuses[0];
			if (first && typeof first === 'object' && 'error' in first) {
				submitError = (first as { error: string }).error;
				return;
			}
			submitError = null;
		} catch (e) {
			submitError = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (midPx && !priceInput) {
			priceInput = formatPrice(midPx, szDecimals, isSpot);
		}
	});

	$effect(() => {
		if (coin === lastCoin) return;
		lastCoin = coin;
		sizeInput = '';
		allocationPct = 0;
		if (orderType === 'limit' && midPx) {
			priceInput = formatPrice(midPx, szDecimals, isSpot);
		}
	});

	$effect(() => {
		const addr = walletStore.address;
		if (!addr || addr === accountLoadedFor) return;
		accountLoadedFor = addr;
		void Promise.all([
			accountStore.fetchAccountState(addr),
			accountStore.fetchSpotState(addr)
		]);
	});

	$effect(() => {
		if (allocationSliderDisabled && allocationPct !== 0) {
			allocationPct = 0;
		}
	});
</script>

<div class="p-2 space-y-2">
	<!-- Buy / Sell toggle -->
	<div class="flex rounded-lg overflow-hidden border border-border-primary">
		<button
			class="flex-1 py-2 text-xs font-semibold transition-colors {isBuy ? 'bg-long text-white' : 'bg-surface-tertiary text-gray-400'}"
			onclick={() => side = 'buy'}
		>Buy</button>
		<button
			class="flex-1 py-2 text-xs font-semibold transition-colors {!isBuy ? 'bg-short text-white' : 'bg-surface-tertiary text-gray-400'}"
			onclick={() => side = 'sell'}
		>Sell</button>
	</div>

	<!-- Order type -->
		<div class="flex gap-1.5">
			<button
				class="flex-1 py-1 text-[11px] rounded font-medium border transition-colors {orderType === 'limit' ? 'border-accent text-accent bg-accent/10' : 'border-border-primary text-gray-400'}"
				onclick={() => {
					orderType = 'limit';
					if (midPx) priceInput = formatPrice(midPx, szDecimals, isSpot);
				}}
			>Limit</button>
		<button
			class="flex-1 py-1 text-[11px] rounded font-medium border transition-colors {orderType === 'market' ? 'border-accent text-accent bg-accent/10' : 'border-border-primary text-gray-400'}"
			onclick={() => orderType = 'market'}
		>Market</button>
	</div>

	<!-- Price input (limit only) -->
	{#if orderType === 'limit'}
		<div>
			<span class="text-[10px] text-gray-400 mb-0.5 block">Price</span>
			<div class="flex items-center gap-0.5">
				<button
					class="w-7 h-8 flex items-center justify-center bg-surface-tertiary rounded border border-border-primary text-gray-400 hover:text-gray-700 text-sm"
					onclick={() => adjustPrice(-1)}
				>-</button>
				<input
					type="text"
					bind:value={priceInput}
					aria-label="Price"
					class="flex-1 min-w-0 px-2 py-1.5 bg-surface-tertiary border border-border-primary rounded text-xs text-right tabular-nums font-mono focus:outline-none focus:border-accent"
				/>
				<button
					class="w-7 h-8 flex items-center justify-center bg-surface-tertiary rounded border border-border-primary text-gray-400 hover:text-gray-700 text-sm"
					onclick={() => adjustPrice(1)}
				>+</button>
				<button
					class="px-2 h-8 text-[10px] bg-surface-tertiary rounded border border-border-primary text-accent hover:bg-accent/10"
					onclick={setMidPrice}
				>Mid</button>
			</div>
		</div>
	{/if}

	<!-- Size input -->
		<div>
			<div class="flex items-center justify-between mb-0.5 gap-2">
				<span class="text-[10px] text-gray-400">Amount ({sizeAsset === 'base' ? baseAssetName : quoteAssetName})</span>
			<div class="flex items-center gap-1">
				<button
					class="px-1.5 py-0.5 text-[10px] rounded border transition-colors {sizeAsset === 'base' ? 'border-accent text-accent bg-accent/10' : 'border-border-primary text-gray-500'}"
					onclick={() => {
						sizeAsset = 'base';
						if (allocationPct > 0) applyAllocation(allocationPct);
					}}
				>{baseAssetName}</button>
				<button
					class="px-1.5 py-0.5 text-[10px] rounded border transition-colors {sizeAsset === 'quote' ? 'border-accent text-accent bg-accent/10' : 'border-border-primary text-gray-500'}"
					onclick={() => {
						sizeAsset = 'quote';
						if (allocationPct > 0) applyAllocation(allocationPct);
					}}
				>{quoteAssetName}</button>
			</div>
		</div>
		<div class="mb-1 p-1.5 rounded border border-border-secondary bg-surface-tertiary/40 text-[10px] text-gray-500 space-y-0.5">
			<div>{baseAssetName}: {formatSize(baseBalance, Math.max(0, szDecimals))}</div>
			<div>{quoteAssetName}: {formatSize(quoteBalance, 4)}</div>
			{#if quoteAssetName !== 'USDC'}
				<div>USDC: {formatSize(usdcBalance, 4)}</div>
			{/if}
		</div>
		<input
			type="text"
			bind:value={sizeInput}
			placeholder="0.00"
			aria-label="Amount"
			oninput={syncSliderFromInput}
			class="w-full px-2 py-1.5 bg-surface-tertiary border border-border-primary rounded text-xs text-right tabular-nums font-mono focus:outline-none focus:border-accent"
		/>
		<p class="mt-1 text-[10px] text-gray-500">
			{#if sizeAsset === 'base'}
				{#if estimatedQuoteValue != null}
					Estimated Value / Required {quoteAssetName}: {formatUsd(estimatedQuoteValue)}
				{:else}
					Estimated Value / Required {quoteAssetName}: -
				{/if}
			{:else}
				{#if effectiveBaseSize != null}
					Estimated Size: {formatSize(effectiveBaseSize, Math.max(0, szDecimals))} {baseAssetName}
				{:else}
					Estimated Size: -
				{/if}
			{/if}
		</p>
		<div class="mt-1">
			<div class="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
				<span>Allocation Slider ({sizeAsset})</span>
				<span>{allocationPct}%</span>
			</div>
			<input
				type="range"
				min="0"
				max="100"
				step="1"
				bind:value={allocationPct}
				disabled={allocationSliderDisabled}
				oninput={() => applyAllocation(allocationPct)}
				class="allocation-slider w-full disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Allocation slider"
			/>
		</div>
	</div>

	{#if orderType === 'limit'}
		<div class="p-2 rounded border border-border-secondary bg-surface-tertiary/40 space-y-2">
			<label class="flex items-center justify-between text-[11px] text-gray-600">
				<span>Reduce Only</span>
				<input type="checkbox" bind:checked={reduceOnly} />
			</label>
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-1 relative">
						<span class="text-[11px] text-gray-600">TIF</span>
						<button
							type="button"
							class="w-4 h-4 rounded-full border border-border-primary text-[10px] text-gray-500 leading-none"
							aria-expanded={showTifHelp}
							aria-label="Show TIF help"
							onclick={(e) => {
								e.stopPropagation();
								showTifHelp = !showTifHelp;
							}}
						>?</button>
						{#if showTifHelp}
							<button
								type="button"
								class="fixed inset-0 z-10 cursor-default"
								aria-label="Close TIF help"
								onclick={() => showTifHelp = false}
							></button>
							<div class="absolute left-0 top-5 z-20 w-64 rounded-md border border-border-primary bg-surface-secondary p-2 shadow-lg text-[10px] text-gray-600 leading-relaxed">
								<p>Reduce Only: An order that reduces a current position as opposed to opening a new position in the opposite direction.</p>
								<p class="mt-1">Good Til Cancel (GTC): An order that rests on the order book until it is filled or canceled.</p>
								<p class="mt-1">Post Only (ALO): An order that is added to the order book but does not execute immediately.</p>
								<p class="mt-1">Immediate or Cancel (IOC): An order that will be canceled if it is not immediately filled.</p>
							</div>
						{/if}
					</div>
					<select
						bind:value={tif}
						class="px-2 py-1 bg-surface-tertiary border border-border-primary rounded text-xs"
				>
					<option value="Gtc">GTC</option>
					<option value="Ioc">IOC</option>
					<option value="Alo">ALO</option>
					</select>
				</div>
			</div>
		{/if}

	{#if submitError}
		<p class="text-xs text-red-600" role="alert">{submitError}</p>
	{/if}

	<!-- Submit -->
	<button
		class="w-full py-2.5 rounded-lg text-xs font-semibold transition-colors {isBuy ? 'bg-long hover:bg-long/90' : 'bg-short hover:bg-short/90'} text-white disabled:opacity-40"
		disabled={!walletStore.isConnected || submitting}
		onclick={submitOrder}
	>
		{#if !walletStore.isConnected}
			Connect Wallet
		{:else if submitting}
			Submitting…
		{:else}
			{isBuy ? 'Buy' : 'Sell'} {coin}
		{/if}
	</button>
</div>

<style>
	.allocation-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 22px;
		background: transparent;
		cursor: pointer;
	}

	/* Track */
	.allocation-slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 9999px;
		background-color: #d1d5db;
	}
	.allocation-slider::-moz-range-track {
		height: 6px;
		border-radius: 9999px;
		background-color: #d1d5db;
	}

	/* Thumb */
	.allocation-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background-color: var(--color-accent, #3b82f6);
		margin-top: -9px;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
	}
	.allocation-slider::-moz-range-thumb {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background-color: var(--color-accent, #3b82f6);
		border: 2px solid white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: pointer;
	}

	/* Disabled state */
	.allocation-slider:disabled::-webkit-slider-thumb {
		background-color: #9ca3af;
		cursor: not-allowed;
	}
	.allocation-slider:disabled::-moz-range-thumb {
		background-color: #9ca3af;
		cursor: not-allowed;
	}
</style>
