<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { marketStore } from "$stores/market.svelte";
	import { accountStore } from "$stores/account.svelte";
	import { walletStore } from "$stores/wallet.svelte";
	import { agentStore } from "$stores/agent.svelte";
	import { feedbackStore } from "$stores/feedback.svelte";
	import {
		formatPrice,
		formatSize,
		formatUsd,
		tickSize,
	} from "$utils/format";
	import { confirmationError, sameOrderContext, type OrderContext, type TradeQuote } from '$utils/orderSafety';
	import { placeOrder as apiPlaceOrder } from "$lib/api/exchange";
	import type { Tif } from "$lib/api/exchange";

	let {
		coin,
		szDecimals = 0,
		isSpot = false,
	}: { coin: string; szDecimals?: number; isSpot?: boolean } = $props();

	let side = $state<"buy" | "sell">("buy");
	let orderType = $state<"market" | "limit">("limit");
	let priceInput = $state("");
	// Once the user touches the price field, stop auto-filling it from mid —
	// otherwise clearing the field gets instantly overwritten on the next tick.
	let priceEdited = $state(false);
	let sizeInput = $state("");
	let sizeAsset = $state<"base" | "quote">("base");
	let allocationPct = $state(0);
	let reduceOnly = $state(false);
	let tif = $state<Tif>("Gtc");
	let showTifHelp = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let preparing = $state(false);
	let validationVersion = 0;
	let now = $state(Date.now());

	type ConfirmDetails = OrderContext & {
		side: "buy" | "sell";
		orderType: "market" | "limit";
		priceStr: string;
		sizeStr: string;
		midPxSnapshot: string;
		estimatedValue: number | null;
		tif?: Tif;
		asset: number;
		reduceOnly: boolean;
		quote: TradeQuote | null;
	};
	let showConfirm = $state(false);
	let pendingOrder = $state<ConfirmDetails | null>(null);

	const isBuy = $derived(side === "buy");
	const tradingAccount = $derived(accountStore.forAddress(walletStore.address));
	const spotAsset = $derived(
		isSpot ? marketStore.findSpotAsset(coin) : undefined,
	);
	const perpAsset = $derived(!isSpot ? marketStore.findPerpAsset(coin) : undefined);
	// Trading references must be fresh two-sided book quotes, including HIP-3.
	const liveQuote = $derived(marketStore.getTradeQuote(coin, Math.max(now, Date.now())));
	const midPx = $derived(liveQuote?.midPx ?? null);
	const draftKey = $derived(JSON.stringify([side, orderType, priceInput, sizeInput, sizeAsset, reduceOnly, tif]));
	function currentContext(): OrderContext {
		return { coin, isSpot, account: walletStore.isConnected ? walletStore.address : null,
			walletClient: walletStore.isConnected ? walletStore.walletClient : null };
	}
	const confirmIssue = $derived(pendingOrder ? confirmationError(pendingOrder, currentContext(), liveQuote, Math.max(now, Date.now())) : null);
	onMount(() => {
		const timer = setInterval(() => { now = Date.now(); }, 1000);
		return () => { clearInterval(timer); ++validationVersion; };
	});
	const baseAssetName = $derived(
		isSpot ? (spotAsset?.token.name ?? coin) : coin,
	);
	// HIP-3 assets carry their own collateral token name (quoteCurrency);
	// main-dex perps fall back to the main quote (USDC).
	const quoteAssetName = $derived(
		isSpot
			? (spotAsset?.quoteToken.name ?? "USDC")
			: (perpAsset?.quoteCurrency ?? marketStore.mainQuote),
	);

	const baseBalance = $derived(
		isSpot
			? parseFloat(
					tradingAccount.spotBalancesFull.find(
						(b) => b.coin === baseAssetName,
					)?.total ?? "0",
				)
			: Math.abs(
					parseFloat(
						tradingAccount.positions.find((p) => p.coin === coin)
							?.szi ?? "0",
					),
				),
	);
	// HIP-3 assets settle margin on their own dex, not the main one; the main
	// dex "withdrawable" is the wrong number for them. Prefer the live all-dexs
	// WS snapshot, fall back to the REST per-dex fetch (direct page entry).
	const isHip3 = $derived(!isSpot && coin.includes(":"));
	const hip3DexName = $derived(isHip3 ? coin.split(":")[0] : null);
	const hip3Withdrawable = $derived.by((): number | null => {
		if (!hip3DexName) return null;
		const tuple = tradingAccount.allDexsClearinghouse.find(
			([dex]) => dex === hip3DexName,
		);
		const state = tuple
			? (tuple[1] as { withdrawable?: string })
			: tradingAccount.dexClearinghouse[hip3DexName];
		if (!state) return null;
		const value = parseFloat(state.withdrawable ?? "");
		return Number.isFinite(value) ? value : null;
	});
	const quoteBalance = $derived(
		isSpot
			? parseFloat(
					tradingAccount.spotBalancesFull.find(
						(b) => b.coin === quoteAssetName,
					)?.total ?? "0",
				)
			: isHip3
				? (hip3Withdrawable ?? 0)
				: parseFloat(tradingAccount.withdrawable ?? "0"),
	);
	const usdcBalance = $derived(
		parseFloat(
			tradingAccount.spotBalancesFull.find((b) => b.coin === "USDC")
				?.total ?? "0",
		),
	);
	const stablecoinBalance = $derived(isSpot ? usdcBalance : quoteBalance);
	const midPxNum = $derived(parseFloat(midPx ?? ""));
	const baseHoldingValueAtMid = $derived(
		Number.isFinite(baseBalance) &&
			baseBalance > 0 &&
			Number.isFinite(midPxNum) &&
			midPxNum > 0
			? baseBalance * midPxNum
			: 0,
	);
	const allocationSliderDisabled = $derived(
		sizeAsset === "base"
			? !Number.isFinite(baseBalance) || baseBalance <= 0
			: !Number.isFinite(quoteBalance) || quoteBalance <= 0,
	);
	const activePriceStr = $derived(
		orderType === "limit" ? priceInput.trim() : (midPx ?? ""),
	);
	const activePriceNum = $derived(parseFloat(activePriceStr));
	const inputAmountNum = $derived(parseFloat(sizeInput.trim()));
	const effectiveBaseSize = $derived(
		Number.isFinite(inputAmountNum) && inputAmountNum > 0
			? sizeAsset === "base"
				? inputAmountNum
				: Number.isFinite(activePriceNum) && activePriceNum > 0
					? inputAmountNum / activePriceNum
					: null
			: null,
	);
	const estimatedQuoteValue = $derived(
		Number.isFinite(inputAmountNum) && inputAmountNum > 0
			? sizeAsset === "quote"
				? inputAmountNum
				: Number.isFinite(activePriceNum) && activePriceNum > 0
					? inputAmountNum * activePriceNum
					: null
			: null,
	);

	// Current position info (perp mode only)
	const currentPosition = $derived(
		!isSpot
			? (tradingAccount.positions.find((p) => p.coin === coin) ?? null)
			: null,
	);
	const positionSzi = $derived(
		currentPosition ? parseFloat(currentPosition.szi) : 0,
	);
	const positionDirection = $derived<"long" | "short" | null>(
		positionSzi > 0 ? "long" : positionSzi < 0 ? "short" : null,
	);
	const positionSize = $derived(Math.abs(positionSzi));

	// Button label helpers
	const buyLabel = $derived(isSpot ? "Buy" : "Buy / Long");
	const sellLabel = $derived(isSpot ? "Sell" : "Sell / Short");

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
		const balance = sizeAsset === "base" ? baseBalance : quoteBalance;
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
			sizeInput = "";
			return;
		}
		if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
			submitError = "Allocation must be between 0 and 100";
			return;
		}
		allocationPct = pct;
		if (pct === 0) {
			sizeInput = "";
			return;
		}
		if (sizeAsset === "base") {
			if (!Number.isFinite(baseBalance) || baseBalance <= 0) {
				submitError = `${baseAssetName} balance not available`;
				return;
			}
			sizeInput = formatSize(
				baseBalance * (pct / 100),
				Math.max(0, szDecimals),
			);
			return;
		}
		if (!Number.isFinite(quoteBalance) || quoteBalance <= 0) {
			submitError = `${quoteAssetName} balance not available`;
			return;
		}
		sizeInput = formatSize(quoteBalance * (pct / 100), 4);
	}

	// Validate and show confirmation modal
	async function submitOrder() {
		if (preparing || submitting) return;
		submitError = null;
		const context = currentContext();
		if (!context.account || !context.walletClient) {
			submitError = "Connect wallet first";
			return;
		}
		const version = ++validationVersion;
		const key = draftKey;
		const draft = { side, orderType, price: priceInput.trim(), amount: sizeInput.trim(), sizeAsset, reduceOnly, tif };
		preparing = true;
		try {
			const asset = await marketStore.resolveAssetId(context.coin);
			if (version !== validationVersion) return;
			if (!sameOrderContext(context, currentContext()) || key !== draftKey) {
				throw new Error('Wallet, market, or inputs changed. Review the order again.');
			}
			if (asset == null) throw new Error(`Unknown asset: ${context.coin}`);
			// Recheck after metadata resolution, which may have taken longer than the quote TTL.
			const quote = marketStore.getTradeQuote(context.coin);
			if (draft.orderType === 'market' && !quote) throw new Error('Fresh two-sided market quote unavailable. Wait for the feed or refresh it.');
			const price = draft.orderType === 'market' ? Number(quote!.midPx) : Number(draft.price);
			if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid price');
			const amount = Number(draft.amount);
			const baseSize = draft.sizeAsset === 'quote' ? amount / price : amount;
			if (!Number.isFinite(baseSize) || baseSize <= 0) throw new Error('Enter a valid size');
			const sizeStr = formatSize(baseSize, Math.max(0, szDecimals));
			if (Number(sizeStr) <= 0) throw new Error('Size is below the asset precision');
			const agentCheck = agentStore.requireSigner(context.account as `0x${string}`);
			if ('error' in agentCheck) {
				agentStore.modalOpen = true;
				throw new Error(agentCheck.error);
			}
			pendingOrder = {
				...context, side: draft.side, orderType: draft.orderType, asset,
				priceStr: draft.orderType === 'market'
					? formatPrice(price * (draft.side === 'buy' ? 1.03 : 0.97), szDecimals, context.isSpot)
					: draft.price,
				sizeStr, midPxSnapshot: quote?.midPx ?? '', estimatedValue: Number(sizeStr) * price,
				tif: draft.orderType === 'limit' ? draft.tif : undefined,
				reduceOnly: context.isSpot ? false : draft.reduceOnly, quote
			};
			showConfirm = true;
		} catch (e) {
			if (version === validationVersion) submitError = e instanceof Error ? e.message : String(e);
		} finally {
			if (version === validationVersion) preparing = false;
		}
	}

	// Actually execute the order after confirmation
	async function executeOrder() {
		if (!pendingOrder || submitting) return;
		const order = pendingOrder;
		const issue = confirmationError(order, currentContext(), marketStore.getTradeQuote(order.coin));
		if (issue) {
			submitError = issue;
			closeConfirm();
			return;
		}
		// Re-validate at confirm time: the wallet account or agent approval may
		// have changed while the confirm dialog was open.
		const agentCheck = agentStore.requireSigner(order.account as `0x${string}`);
		if ("error" in agentCheck) {
			feedbackStore.error("Order Failed", agentCheck.error);
			closeConfirm();
			agentStore.modalOpen = true;
			return;
		}
		const wallet = agentCheck.signer;
		submitting = true;
		try {
			const result = await apiPlaceOrder(wallet, {
				asset: order.asset, side: order.side, orderType: order.orderType,
				price: order.priceStr, size: order.sizeStr,
				reduceOnly: order.reduceOnly, tif: order.tif,
			});
			const first = result.statuses[0];
			if (first && typeof first === "object" && "error" in first) {
				feedbackStore.error(
					"Order Failed",
					(first as { error: string }).error,
				);
				closeConfirm();
				return;
			}
			feedbackStore.success(
				`${order.side === "buy" ? "Buy" : "Sell"} ${order.coin} order placed`,
			);
			closeConfirm();
		} catch (e) {
			feedbackStore.error(
				"Order Failed",
				e instanceof Error ? e.message : String(e),
			);
			closeConfirm();
		} finally {
			submitting = false;
		}
	}

	function closeConfirm() {
		showConfirm = false;
		pendingOrder = null;
	}

	$effect(() => {
		if (midPx && !priceInput && !priceEdited) {
			priceInput = formatPrice(midPx, szDecimals, isSpot);
		}
	});

	$effect(() => {
		// Read only identity dependencies; quote ticks must not reset user input.
		currentContext();
		untrack(() => {
			++validationVersion;
			preparing = false;
			closeConfirm();
			sizeInput = '';
			allocationPct = 0;
			priceEdited = false;
			priceInput = '';
			submitError = null;
		});
	});

	$effect(() => {
		const addr = walletStore.address;
		const client = walletStore.walletClient;
		if (!addr || !client) return;
		untrack(() => { void Promise.all([
			accountStore.fetchAccountState(addr),
			accountStore.fetchSpotState(addr),
		]); });
	});

	// HIP-3: fetch the dex-specific clearinghouse state for margin display
	$effect(() => {
		const addr = walletStore.address;
		const dexName = hip3DexName;
		if (!addr || !dexName) return;
		untrack(() => { void accountStore
			.fetchDexState(addr, dexName)
			.catch((e) => console.error(`fetchDexState(${dexName}) failed:`, e)); });
	});

	$effect(() => {
		if (allocationSliderDisabled && allocationPct !== 0) {
			allocationPct = 0;
		}
	});
</script>

<div class="p-2 space-y-2">
	<div class="flex items-center justify-between text-[10px] text-gray-500">
		<span>{liveQuote ? 'Live book mid' : 'Live quote unavailable / stale'}{liveQuote ? ` · ${Math.max(0, Math.floor((now - liveQuote.receivedAt) / 1000))}s` : ''}</span>
		<button onclick={() => { void marketStore.selectCoin(coin).catch((e) => { submitError = String(e); }); }}>Refresh feed</button>
	</div>
	{#if orderType === 'market' && !liveQuote}
		<p class="text-xs text-amber-700">Market orders need a two-sided book updated within 15 seconds. Cached prices are not used.</p>
	{/if}
	{#if tradingAccount.errors.length > 0}
		<div role="alert" class="text-xs text-amber-700">
			{#each tradingAccount.errors as error (error)}<p>{error}</p>{/each}
		</div>
	{/if}
	<!-- Buy / Sell toggle -->
	<div class="flex rounded-lg overflow-hidden border border-border-primary">
		<button
			class="flex-1 py-2 text-xs font-semibold transition-colors {isBuy
				? 'bg-long text-white'
				: 'bg-surface-tertiary text-gray-400'}"
			onclick={() => (side = "buy")}>{buyLabel}</button
		>
		<button
			class="flex-1 py-2 text-xs font-semibold transition-colors {!isBuy
				? 'bg-short text-white'
				: 'bg-surface-tertiary text-gray-400'}"
			onclick={() => (side = "sell")}>{sellLabel}</button
		>
	</div>

	<!-- Order type -->
	<div class="flex gap-1.5">
		<button
			class="flex-1 py-1 text-[11px] rounded font-medium border transition-colors {orderType ===
			'limit'
				? 'border-accent text-accent bg-accent/10'
				: 'border-border-primary text-gray-400'}"
			onclick={() => {
				orderType = "limit";
				if (midPx) priceInput = formatPrice(midPx, szDecimals, isSpot);
			}}>Limit</button
		>
		<button
			class="flex-1 py-1 text-[11px] rounded font-medium border transition-colors {orderType ===
			'market'
				? 'border-accent text-accent bg-accent/10'
				: 'border-border-primary text-gray-400'}"
			onclick={() => (orderType = "market")}>Market</button
		>
	</div>

	<!-- Price input (limit only) -->
	{#if orderType === "limit"}
		<div>
			<span class="text-[10px] text-gray-400 mb-0.5 block">Price</span>
			<div class="flex items-center gap-0.5">
				<button
					class="w-7 h-8 flex items-center justify-center bg-surface-tertiary rounded border border-border-primary text-gray-400 hover:text-gray-700 text-sm"
					onclick={() => adjustPrice(-1)}>-</button
				>
				<input
					type="text"
					bind:value={priceInput}
					aria-label="Price"
					oninput={() => (priceEdited = true)}
					class="flex-1 min-w-0 px-2 py-1.5 bg-surface-tertiary border border-border-primary rounded text-xs text-right tabular-nums font-mono focus:outline-none focus:border-accent"
				/>
				<button
					class="w-7 h-8 flex items-center justify-center bg-surface-tertiary rounded border border-border-primary text-gray-400 hover:text-gray-700 text-sm"
					onclick={() => adjustPrice(1)}>+</button
				>
				<button
					class="px-2 h-8 text-[10px] bg-surface-tertiary rounded border border-border-primary text-accent hover:bg-accent/10"
					onclick={setMidPrice}>Mid</button
				>
			</div>
		</div>
	{/if}

	<!-- Size input -->
	<div>
		<div class="flex items-center justify-between mb-0.5 gap-2">
			<span class="text-[10px] text-gray-400"
				>Amount ({sizeAsset === "base"
					? baseAssetName
					: quoteAssetName})</span
			>
			<div class="flex items-center gap-1">
				<button
					class="px-1.5 py-0.5 text-[10px] rounded border transition-colors {sizeAsset ===
					'base'
						? 'border-accent text-accent bg-accent/10'
						: 'border-border-primary text-gray-500'}"
					onclick={() => {
						sizeAsset = "base";
						if (allocationPct > 0) applyAllocation(allocationPct);
					}}>{baseAssetName}</button
				>
				<button
					class="px-1.5 py-0.5 text-[10px] rounded border transition-colors {sizeAsset ===
					'quote'
						? 'border-accent text-accent bg-accent/10'
						: 'border-border-primary text-gray-500'}"
					onclick={() => {
						sizeAsset = "quote";
						if (allocationPct > 0) applyAllocation(allocationPct);
					}}>{quoteAssetName}</button
				>
			</div>
		</div>

		<!-- Current position indicator (perp only) -->
		{#if !isSpot}
			<div
				class="mb-1 px-2 py-1 rounded border border-border-secondary bg-surface-tertiary/40 text-[10px] font-medium
				{positionDirection === 'long'
					? 'text-long'
					: positionDirection === 'short'
						? 'text-short'
						: 'text-gray-500'}"
			>
				{#if positionDirection === "long"}
					▲ Long &nbsp;{formatSize(
						positionSize,
						Math.max(0, szDecimals),
					)}
					{coin}
				{:else if positionDirection === "short"}
					▼ Short &nbsp;{formatSize(
						positionSize,
						Math.max(0, szDecimals),
					)}
					{coin}
				{:else}
					— No position
				{/if}
			</div>
		{/if}

		<div
			class="mb-1 p-1.5 rounded border border-border-secondary bg-surface-tertiary/40 text-[10px] text-gray-500 space-y-0.5"
		>
			<div>
				{baseAssetName}: {formatSize(
					baseBalance,
					Math.max(0, szDecimals),
				)}
			</div>
			<div>
				{quoteAssetName}{isSpot ? "" : " (margin)"}: {isHip3 &&
				hip3Withdrawable == null
					? "—"
					: formatSize(quoteBalance, 4)}
			</div>
			{#if quoteAssetName !== "USDC"}
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
			{#if sizeAsset === "base"}
				{#if estimatedQuoteValue != null}
					Estimated Value / Required {quoteAssetName}: {formatUsd(
						estimatedQuoteValue,
					)}
				{:else}
					Estimated Value / Required {quoteAssetName}: -
				{/if}
			{:else if effectiveBaseSize != null}
				Estimated Size: {formatSize(
					effectiveBaseSize,
					Math.max(0, szDecimals),
				)}
				{baseAssetName}
			{:else}
				Estimated Size: -
			{/if}
		</p>
		<div class="mt-1">
			<div
				class="flex items-center justify-between text-[10px] text-gray-500 mb-0.5"
			>
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

	{#if !isSpot || orderType === "limit"}
		<div
			class="p-2 rounded border border-border-secondary bg-surface-tertiary/40 space-y-2"
		>
			<!-- Reduce Only is a perp concept; show it for both order types so a
			     checked flag is never hidden from the user. -->
			{#if !isSpot}
				<label
					class="flex items-center justify-between text-[11px] text-gray-600"
				>
					<span>Reduce Only</span>
					<input type="checkbox" bind:checked={reduceOnly} />
				</label>
			{/if}
			{#if orderType === "limit"}
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
						}}>?</button
					>
					{#if showTifHelp}
						<button
							type="button"
							class="fixed inset-0 z-10 cursor-default"
							aria-label="Close TIF help"
							onclick={() => (showTifHelp = false)}
						></button>
						<div
							class="absolute left-0 top-5 z-20 w-64 rounded-md border border-border-primary bg-surface-secondary p-2 shadow-lg text-[10px] text-gray-600 leading-relaxed"
						>
							<p>
								Reduce Only: An order that reduces a current
								position as opposed to opening a new position in
								the opposite direction.
							</p>
							<p class="mt-1">
								Good Til Cancel (GTC): An order that rests on
								the order book until it is filled or canceled.
							</p>
							<p class="mt-1">
								Post Only (ALO): An order that is added to the
								order book but does not execute immediately.
							</p>
							<p class="mt-1">
								Immediate or Cancel (IOC): An order that will be
								canceled if it is not immediately filled.
							</p>
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
			{/if}
		</div>
	{/if}

	{#if submitError}
		<p class="text-xs text-red-600" role="alert">{submitError}</p>
	{/if}

	<!-- Submit -->
	<button
		class="w-full py-2.5 rounded-lg text-xs font-semibold transition-colors {isBuy
			? 'bg-long hover:bg-long/90'
			: 'bg-short hover:bg-short/90'} text-white disabled:opacity-40"
		disabled={!walletStore.isConnected || submitting || preparing || (orderType === 'market' && !liveQuote)}
		onclick={submitOrder}
	>
		{#if !walletStore.isConnected}
			Connect Wallet
		{:else if submitting}
			Submitting…
		{:else}
			{isBuy ? buyLabel : sellLabel} {baseAssetName}
		{/if}
	</button>
</div>

<!-- Confirm Order Modal -->
{#if showConfirm && pendingOrder && sameOrderContext(pendingOrder, currentContext())}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-[9999] bg-black/70 cursor-default"
		aria-label="Close confirm dialog"
		onclick={closeConfirm}
	></button>

	<!-- Modal card -->
	<div
		class="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-modal-title"
	>
		<div
			class="pointer-events-auto w-full max-w-sm rounded-2xl border border-border-primary bg-surface-primary shadow-2xl overflow-hidden"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-5 py-4 border-b border-border-primary"
			>
				<span
					id="confirm-modal-title"
					class="text-base font-bold text-white">Confirm Order</span
				>
				<button
					type="button"
					class="text-gray-400 hover:text-white text-xl leading-none transition-colors"
					aria-label="Close"
					onclick={closeConfirm}>✕</button
				>
			</div>

			<!-- Body -->
			<div class="px-5 py-4 space-y-3 text-sm">
				<!-- Side -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Side</span>
					<span
						class="font-bold text-base {pendingOrder.side === 'buy'
							? 'text-long'
							: 'text-short'}"
					>
						{pendingOrder.side === "buy" ? buyLabel : sellLabel}
					</span>
				</div>
				<!-- Market type -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Market</span>
					<span class="font-semibold text-white"
						>{isSpot ? "Spot" : "Perpetual"}</span
					>
				</div>
				<!-- Asset -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Asset</span>
					<span class="font-semibold text-white">{baseAssetName}</span
					>
				</div>
				<!-- Spot ID + Tokens (spot only) -->
				{#if isSpot}
					<div class="flex justify-between items-center">
						<span class="text-gray-400">Spot ID</span>
						<span class="font-mono text-white">{coin}</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-400">Tokens</span>
						<span class="font-mono text-white">
							[{spotAsset?.pair.tokens[0] ?? "?"}, {spotAsset
								?.pair.tokens[1] ?? "?"}] &lt;=&gt; [{spotAsset
								?.token.name ?? baseAssetName}, {spotAsset
								?.quoteToken.name ?? quoteAssetName}]
						</span>
					</div>
				{/if}
				<!-- Asset ID -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Asset ID</span>
					<span class="font-mono text-white"
						>{pendingOrder.asset}</span
					>
				</div>
				<!-- Order Type -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Order Type</span>
					<span class="font-semibold text-white capitalize"
						>{pendingOrder.orderType}</span
					>
				</div>
				<!-- Price -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Price</span>
					<span class="font-semibold text-white">
						{#if pendingOrder.orderType === "market"}
							Market (±3% slippage)
						{:else}
							{formatUsd(parseFloat(pendingOrder.priceStr))}
						{/if}
					</span>
				</div>
				<!-- Mid Price snapshot -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Mid Price</span>
					<span class="font-semibold text-white">
						{pendingOrder.midPxSnapshot
							? formatUsd(parseFloat(pendingOrder.midPxSnapshot))
							: "—"}
					</span>
				</div>
				<!-- Size -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Size</span>
					<span class="font-semibold text-white"
						>{pendingOrder.sizeStr} {baseAssetName}</span
					>
				</div>
				<!-- Estimated Value -->
				<div class="flex justify-between items-center">
					<span class="text-gray-400">Est. Value</span>
					<span class="font-semibold text-white">
						{pendingOrder.estimatedValue != null
							? "~" + formatUsd(pendingOrder.estimatedValue)
							: "—"}
					</span>
				</div>
				<!-- TIF (limit only) -->
				{#if pendingOrder.orderType === "limit" && pendingOrder.tif}
					<div class="flex justify-between items-center">
						<span class="text-gray-400">TIF</span>
						<span class="font-semibold text-white"
							>{pendingOrder.tif === "Gtc"
								? "GTC"
								: pendingOrder.tif === "Ioc"
									? "IOC"
									: "ALO"}</span
						>
					</div>
				{/if}
				{#if !pendingOrder.isSpot && pendingOrder.reduceOnly}
					<div class="flex justify-between items-center">
						<span class="text-gray-400">Reduce Only</span>
						<span class="font-semibold text-white">Yes</span>
					</div>
				{/if}

				<!-- Current position (perp only) -->
				{#if !isSpot}
					<div
						class="pt-3 mt-1 border-t border-border-primary text-sm font-medium
						{positionDirection === 'long'
							? 'text-long'
							: positionDirection === 'short'
								? 'text-short'
								: 'text-gray-400'}"
					>
						{#if positionDirection === "long"}
							Current: Long {formatSize(
								positionSize,
								Math.max(0, szDecimals),
							)}
							{coin}
						{:else if positionDirection === "short"}
							Current: Short {formatSize(
								positionSize,
								Math.max(0, szDecimals),
							)}
							{coin}
						{:else}
							Current: No position
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if confirmIssue}<p role="alert" class="px-5 pb-2 text-xs text-amber-700">{confirmIssue}</p>{/if}
			<div class="flex gap-3 px-5 py-4 border-t border-border-primary">
				<button
					type="button"
					class="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border-primary text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
					onclick={closeConfirm}>Cancel</button
				>
				<button
					type="button"
					class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50
						{pendingOrder.side === 'buy'
						? 'bg-long hover:bg-long/90'
						: 'bg-short hover:bg-short/90'}"
					disabled={submitting || !!confirmIssue}
					onclick={executeOrder}
				>
					{submitting ? "Submitting…" : "Confirm →"}
				</button>
			</div>
		</div>
	</div>
{/if}

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
