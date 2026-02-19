<script lang="ts">
	import { ordersStore } from '$stores/orders.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { agentStore } from '$stores/agent.svelte';
	import { feedbackStore } from '$stores/feedback.svelte';
	import { formatPrice, formatSize, formatTime, formatUsd } from '$utils/format';
	import {
		cancelOrder as apiCancelOrder,
		cancelOrders as apiCancelOrders,
		cancelOrdersByCloid as apiCancelOrdersByCloid,
		modifyOrder as apiModifyOrder,
		type Tif
	} from '$lib/api/exchange';

	let cancellingOid = $state<number | null>(null);
	let cancellingAll = $state(false);
	type EditableOrder = { coin: string; oid: number; side: string; limitPx: string; sz: string; reduceOnly?: boolean; cloid?: string };
	let editingOrder = $state<EditableOrder | null>(null);
	let modifyingOid = $state<number | null>(null);
	let editPrice = $state('');
	let editSize = $state('');
	let editTif = $state<Tif>('Gtc');
	let lastModifyTif = $state<Tif>('Gtc');
	async function refreshOpenOrders() {
		const user = ordersStore.viewAddress ?? walletStore.address;
		if (user) await ordersStore.fetchOpenOrders(user);
	}

	async function cancelOrder(order: { coin: string; oid: number; cloid?: string }) {
		if (!agentStore.approved || !agentStore.signer) {
			agentStore.modalOpen = true;
			return;
		}
		const wallet = agentStore.signer;
		const asset = marketStore.getAssetId(order.coin);
		if (asset == null) {
			feedbackStore.error('Cancel Failed', `Unknown asset: ${order.coin}`);
			return;
		}
		cancellingOid = order.oid;
		try {
			const result = order.cloid
				? await apiCancelOrdersByCloid(wallet, [{ asset, cloid: order.cloid as `0x${string}` }])
				: await apiCancelOrder(wallet, asset, order.oid);
			const first = result.statuses[0];
			if (first && typeof first === 'object' && 'error' in first) {
				feedbackStore.error('Cancel Failed', (first as { error: string }).error);
			} else {
				feedbackStore.success('Order cancelled');
				await refreshOpenOrders();
			}
		} catch (e) {
			feedbackStore.error('Cancel Failed', e instanceof Error ? e.message : String(e));
			throw e;
		} finally {
			cancellingOid = null;
		}
	}

	async function cancelAll() {
		if (!confirm(`Cancel all ${ordersStore.openOrders.length} open orders?`)) return;
		if (!agentStore.approved || !agentStore.signer) {
			agentStore.modalOpen = true;
			return;
		}
		const wallet = agentStore.signer;
		const cancels: { a: number; o: number }[] = [];
		for (const order of ordersStore.openOrders) {
			const asset = marketStore.getAssetId(order.coin);
			if (asset == null) continue;
			cancels.push({ a: asset, o: order.oid });
		}
		if (cancels.length === 0) {
			feedbackStore.error('Cancel Failed', 'No cancellable orders');
			return;
		}
		const n = cancels.length;
		cancellingAll = true;
		try {
			const result = await apiCancelOrders(wallet, cancels);
			const firstError = result.statuses.find((s) => typeof s === 'object' && 'error' in s) as { error: string } | undefined;
			if (firstError) {
				feedbackStore.error('Cancel Failed', firstError.error);
			} else {
				feedbackStore.success(`${n} orders cancelled`);
			}
			await refreshOpenOrders();
		} catch (e) {
			feedbackStore.error('Cancel Failed', e instanceof Error ? e.message : String(e));
			throw e;
		} finally {
			cancellingAll = false;
		}
	}

	function beginEdit(order: EditableOrder) {
		editingOrder = order;
		editPrice = order.limitPx;
		editSize = order.sz;
		editTif = lastModifyTif;
	}

	function cancelEdit() {
		editingOrder = null;
		modifyingOid = null;
	}

	async function submitModify(order: { coin: string; oid: number; side: string; reduceOnly?: boolean; cloid?: string }) {
		if (!agentStore.approved || !agentStore.signer) {
			agentStore.modalOpen = true;
			return;
		}
		const wallet = agentStore.signer;
		const asset = marketStore.getAssetId(order.coin);
		if (asset == null) {
			feedbackStore.error('Modify Failed', `Unknown asset: ${order.coin}`);
			return;
		}
		const px = editPrice.trim();
		const sz = editSize.trim();
		if (!px || !sz || Number(px) <= 0 || Number(sz) <= 0) {
			feedbackStore.error('Modify Failed', 'Invalid price or size');
			return;
		}
		modifyingOid = order.oid;
		try {
			const isBuy = order.side === 'B' || order.side === 'buy';
			const result = await apiModifyOrder(wallet, {
				oid: order.cloid ? (order.cloid as `0x${string}`) : order.oid,
				order: {
					a: asset,
					b: isBuy,
					p: px,
					s: sz,
					r: order.reduceOnly ?? false,
					t: { limit: { tif: editTif } }
				}
			});
			const first = result.statuses[0];
			if (first && typeof first === 'object' && 'error' in first) {
				feedbackStore.error('Modify Failed', (first as { error: string }).error);
				return;
			}
			lastModifyTif = editTif;
			editingOrder = null;
			feedbackStore.success('Order modified');
			await refreshOpenOrders();
		} catch (e) {
			feedbackStore.error('Modify Failed', e instanceof Error ? e.message : String(e));
			throw e;
		} finally {
			modifyingOid = null;
		}
	}
</script>

<div class="flex flex-col">
	<div class="flex justify-end px-3 py-1">
		<button
			class="text-xs px-3 py-1.5 rounded-md border border-red-300 bg-red-50 text-red-700 font-semibold hover:bg-red-100 disabled:opacity-50"
			disabled={!walletStore.isConnected || cancellingAll || ordersStore.openOrders.length === 0}
			onclick={cancelAll}
		>
			{cancellingAll ? 'Cancelling…' : 'Cancel All'}
		</button>
	</div>
	{#if ordersStore.openOrders.length === 0}
		<div class="text-center py-8 text-sm text-gray-500">No open orders</div>
	{:else}
		<!-- Single grid so header and rows align; Value = limitPx * sz (notional) -->
		<div
			class="grid gap-x-2 gap-y-0 px-2 text-xs items-center"
			style="grid-template-columns: minmax(5.3rem, 1.2fr) 1.65rem minmax(3.4rem, auto) minmax(2.6rem, auto) minmax(3.8rem, auto) minmax(3.1rem, auto) auto;"
		>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary">Coin</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-center">Side</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Price</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Size</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Value</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Time</div>
			<div class="py-1.5 text-[10px] text-gray-600 uppercase tracking-wider border-b border-border-secondary text-right">Actions</div>

			{#each ordersStore.openOrders as order (order.oid)}
				{@const isBuy = order.side === 'B' || order.side === 'buy'}
				{@const pp = marketStore.getCoinPriceParams(order.coin)}
				{@const perp = marketStore.findPerpAsset(order.coin)}
				{@const spot = marketStore.findSpotAsset(order.coin)}
				{@const displayName = perp ? perp.meta.name : spot ? spot.displayName : order.coin}
				{@const rawCoin = spot ? spot.pair.name : order.coin}
				{@const orderValue = parseFloat(order.limitPx) * parseFloat(order.sz)}
				<span class="font-medium min-w-0 py-1.5 border-b border-border-secondary hover:bg-surface-hover">
					<span class="h-10 flex flex-col justify-center leading-tight">
						<span class="truncate">{displayName}</span>
						<span class="text-[10px] text-gray-500 font-normal truncate">
							{#if rawCoin !== displayName}
								{rawCoin}
							{:else}
								&nbsp;
							{/if}
						</span>
					</span>
				</span>
				<span class="{isBuy ? 'text-long' : 'text-short'} font-medium text-center py-1.5 border-b border-border-secondary hover:bg-surface-hover">
					<span class="h-10 flex flex-col items-center justify-center leading-tight">
						<span>{isBuy ? 'BUY' : 'SELL'}</span>
						<span class="text-[10px] text-gray-500">&nbsp;</span>
					</span>
				</span>
				<span class="text-right tabular-nums font-semibold font-mono tracking-tight text-gray-900 py-1.5 border-b border-border-secondary hover:bg-surface-hover">
					<span class="h-10 flex flex-col justify-center leading-tight">
						<span>${formatPrice(order.limitPx, pp.szDecimals, pp.isSpot)}</span>
						<span class="text-[10px] text-gray-500 font-normal">&nbsp;</span>
					</span>
				</span>
				<span class="text-right tabular-nums font-mono py-1.5 border-b border-border-secondary hover:bg-surface-hover">
					<span class="h-10 flex flex-col justify-center leading-tight">
						<span>{formatSize(order.sz, pp.szDecimals)}</span>
						<span class="text-[10px] text-gray-500">&nbsp;</span>
					</span>
				</span>
				<span class="text-right tabular-nums font-semibold font-mono tracking-tight text-gray-900 py-1.5 border-b border-border-secondary hover:bg-surface-hover">
					<span class="h-10 flex flex-col justify-center leading-tight">
						<span>{formatUsd(orderValue)}</span>
						<span class="text-[10px] text-gray-500 font-normal">&nbsp;</span>
					</span>
				</span>
				<span class="text-right tabular-nums text-gray-500 py-1.5 border-b border-border-secondary hover:bg-surface-hover">
					<span class="h-10 flex flex-col justify-center leading-tight">
						<span>{formatTime(order.timestamp)}</span>
						<span class="text-[10px] text-gray-400">&nbsp;</span>
					</span>
				</span>
				<span class="py-1.5 border-b border-border-secondary text-right">
					<div class="h-10 flex items-center justify-end gap-1">
						<button
							class="w-6 h-6 inline-flex items-center justify-center rounded border border-border-primary text-gray-700 hover:bg-surface-hover disabled:opacity-50"
							title="Modify order"
							disabled={!walletStore.isConnected || cancellingOid === order.oid || modifyingOid === order.oid}
							onclick={() => beginEdit(order)}
						>
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 20h9" />
								<path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
							</svg>
						</button>
					</div>
				</span>
			{/each}
		</div>
	{/if}
</div>

{#if editingOrder}
	{@const eo = editingOrder}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/35"
		aria-label="Close modify dialog"
		onclick={cancelEdit}
	></button>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="w-full max-w-sm rounded-xl border border-border-primary bg-surface-secondary shadow-xl p-3" role="dialog" aria-modal="true" aria-label="Modify Order">
			<div class="flex items-center justify-between mb-2">
				<h3 class="text-sm font-semibold">Modify Order</h3>
				<button class="text-xs text-gray-500 hover:text-gray-700" onclick={cancelEdit}>Close</button>
			</div>
			<p class="text-[11px] text-gray-500 mb-2">{eo.coin} · OID {eo.oid}</p>
			<div class="grid grid-cols-1 gap-2">
				<label class="text-[10px] text-gray-500">
					Price
					<input
						type="text"
						bind:value={editPrice}
						class="mt-0.5 w-full px-2 py-1 bg-surface-tertiary border border-border-primary rounded text-xs font-mono"
					/>
				</label>
				<label class="text-[10px] text-gray-500">
					Size
					<input
						type="text"
						bind:value={editSize}
						class="mt-0.5 w-full px-2 py-1 bg-surface-tertiary border border-border-primary rounded text-xs font-mono"
					/>
				</label>
				<label class="text-[10px] text-gray-500">
					TIF
					<select
						bind:value={editTif}
						class="mt-0.5 w-full px-2 py-1 bg-surface-tertiary border border-border-primary rounded text-xs"
					>
						<option value="Gtc">GTC</option>
						<option value="Ioc">IOC</option>
						<option value="Alo">ALO</option>
					</select>
				</label>
			</div>
			<div class="mt-3 flex justify-end gap-2">
				<button
					class="mr-auto text-[10px] px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
					disabled={cancellingOid === eo.oid || modifyingOid === eo.oid}
					onclick={() => cancelOrder(eo)}
				>{cancellingOid === eo.oid ? 'Cancelling…' : 'Cancel Order'}</button>
				<button
					class="text-[10px] px-2 py-1 rounded border border-border-primary text-gray-700 hover:bg-surface-hover"
					onclick={cancelEdit}
				>Close Window</button>
				<button
					class="text-[10px] px-2 py-1 rounded border border-border-primary text-accent hover:bg-accent/10 disabled:opacity-50"
					disabled={modifyingOid === eo.oid}
					onclick={() => submitModify(eo)}
				>
					{modifyingOid === eo.oid ? 'Modifying…' : 'Submit Modify'}
				</button>
			</div>
		</div>
	</div>
{/if}
