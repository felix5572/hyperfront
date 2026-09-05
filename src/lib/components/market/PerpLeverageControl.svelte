<script lang="ts">
	import { untrack } from 'svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { accountStore } from '$stores/account.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { createHlWalletAdapter } from '$lib/wallet/hlWalletAdapter';
	import { updateLeverage as apiUpdateLeverage } from '$lib/api/exchange';

	let { coin }: { coin: string } = $props();

	const perp = $derived(marketStore.findPerpAsset(coin));
	const maxLeverage = $derived(perp?.meta.maxLeverage ?? null);
	const tradingAccount = $derived(accountStore.forAddress(walletStore.address));
	const currentPosLeverage = $derived(
		tradingAccount.positions.find((p) => p.coin === coin)?.leverage?.value ?? null
	);
	const currentPosMode = $derived(
		tradingAccount.positions.find((p) => p.coin === coin)?.leverage?.type === 'cross'
			? 'cross'
			: 'isolated'
	);

	let leverageInput = $state('1');
	let leverageMode = $state<'cross' | 'isolated'>('isolated');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let ok = $state<string | null>(null);

	$effect(() => {
		leverageInput = String(Math.max(1, Math.round(currentPosLeverage ?? 1)));
		leverageMode = currentPosMode;
	});

	$effect(() => {
		const addr = walletStore.address;
		const dex = coin.includes(':') ? coin.split(':')[0] : '';
		if (!addr) return;
		untrack(() => { void accountStore.fetchDexState(addr, dex); });
	});

	async function submitLeverage() {
		error = null;
		ok = null;
		const wallet = walletStore.walletClient && walletStore.address
			? createHlWalletAdapter(walletStore.walletClient, walletStore.address)
			: null;
		if (!wallet) {
			error = 'Connect wallet to update leverage';
			return;
		}
		const asset = marketStore.getAssetId(coin);
		if (asset == null) {
			error = `Unknown asset: ${coin}`;
			return;
		}
		const leverage = Math.floor(Number(leverageInput));
		if (!Number.isFinite(leverage) || leverage < 1) {
			error = 'Leverage must be an integer >= 1';
			return;
		}
		if (maxLeverage != null && leverage > maxLeverage) {
			error = `Leverage exceeds max (${maxLeverage}x)`;
			return;
		}
		submitting = true;
		try {
			await apiUpdateLeverage(wallet, {
				asset,
				isCross: leverageMode === 'cross',
				leverage
			});
			ok = 'Leverage updated';
			if (walletStore.address) {
				await accountStore.fetchDexState(walletStore.address, coin.includes(':') ? coin.split(':')[0] : '');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			submitting = false;
		}
	}
</script>

<details class="p-2 border-t border-border-secondary bg-surface-secondary/40 group">
	<summary class="flex items-center justify-between cursor-pointer select-none">
		<h4 class="text-[11px] font-semibold text-gray-700">Leverage Setting</h4>
		<div class="text-[10px] text-gray-500">
			Max {maxLeverage != null ? `${maxLeverage}x` : '—'} · Current {currentPosLeverage != null ? `${currentPosLeverage}x` : '—'}
		</div>
	</summary>
	<div class="mt-2 flex items-center gap-1.5">
		<select
			bind:value={leverageMode}
			class="px-2 py-1 rounded border border-border-primary bg-surface-tertiary text-xs"
		>
			<option value="cross">Cross</option>
			<option value="isolated">Isolated</option>
		</select>
		<input
			type="number"
			min="1"
			step="1"
			bind:value={leverageInput}
			class="w-20 px-2 py-1 rounded border border-border-primary bg-surface-tertiary text-xs font-mono"
		/>
		<button
			class="px-2 py-1 rounded border border-border-primary text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
			disabled={submitting}
			onclick={submitLeverage}
		>
			{submitting ? 'Updating…' : 'Apply'}
		</button>
	</div>
	{#if error}
		<p class="text-xs text-red-600 mt-1">{error}</p>
	{:else if ok}
		<p class="text-xs text-long mt-1">{ok}</p>
	{/if}
</details>
