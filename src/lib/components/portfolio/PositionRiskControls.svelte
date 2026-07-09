<script lang="ts">
	import type { Position } from '$stores/account.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { accountStore } from '$stores/account.svelte';
	import { marketStore } from '$stores/market.svelte';
	import { createHlWalletAdapter } from '$lib/wallet/hlWalletAdapter';
	import { updateLeverage as apiUpdateLeverage, updateIsolatedMargin as apiUpdateIsolatedMargin } from '$lib/api/exchange';

	let { position }: { position: Position } = $props();

	let leverageInput = $state('1');
	let leverageMode = $state<'cross' | 'isolated'>('isolated');
	let marginDeltaInput = $state('');
	let submittingLeverage = $state(false);
	let submittingMargin = $state(false);
	let error = $state<string | null>(null);
	let ok = $state<string | null>(null);

	$effect(() => {
		leverageInput = String(Math.max(1, Math.round(position.leverage?.value ?? 1)));
		leverageMode = position.leverage?.type === 'cross' ? 'cross' : 'isolated';
	});

	async function refreshAccount() {
		const user = accountStore.viewAddress ?? walletStore.address;
		if (!user) return;
		await accountStore.fetchAccountState(user);
	}

	function getWallet() {
		return walletStore.walletClient && walletStore.address
			? createHlWalletAdapter(walletStore.walletClient, walletStore.address)
			: null;
	}

	async function submitLeverage() {
		error = null;
		ok = null;
		const wallet = getWallet();
		if (!wallet) {
			error = 'Connect wallet to update leverage';
			return;
		}
		const leverage = Math.floor(Number(leverageInput));
		if (!Number.isFinite(leverage) || leverage < 1) {
			error = 'Leverage must be an integer >= 1';
			return;
		}
		submittingLeverage = true;
		try {
			const asset = await marketStore.resolveAssetId(position.coin);
			if (asset == null) {
				error = `Unknown asset: ${position.coin}`;
				return;
			}
			await apiUpdateLeverage(wallet, {
				asset,
				isCross: leverageMode === 'cross',
				leverage
			});
			ok = 'Leverage updated';
			await refreshAccount();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			submittingLeverage = false;
		}
	}

	async function submitMargin() {
		error = null;
		ok = null;
		const wallet = getWallet();
		if (!wallet) {
			error = 'Connect wallet to update isolated margin';
			return;
		}
		const delta = Number(marginDeltaInput);
		if (!Number.isFinite(delta) || delta === 0) {
			error = 'Margin delta must be non-zero';
			return;
		}
		const ntli = Math.round(delta * 1_000_000);
		if (ntli === 0) {
			error = 'Margin delta too small';
			return;
		}
		submittingMargin = true;
		try {
			const asset = await marketStore.resolveAssetId(position.coin);
			if (asset == null) {
				error = `Unknown asset: ${position.coin}`;
				return;
			}
			await apiUpdateIsolatedMargin(wallet, {
				asset,
				isBuy: Number(position.szi) > 0,
				ntli
			});
			ok = 'Isolated margin updated';
			marginDeltaInput = '';
			await refreshAccount();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			submittingMargin = false;
		}
	}
</script>

<div class="mt-2 p-2 rounded-lg border border-border-secondary bg-surface-secondary">
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
		<div class="space-y-1">
			<p class="text-[10px] text-gray-500 uppercase tracking-wide">Update Leverage</p>
			<div class="flex gap-1">
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
					disabled={submittingLeverage}
					onclick={submitLeverage}
				>
					{submittingLeverage ? 'Updating…' : 'Apply'}
				</button>
			</div>
		</div>

		<div class="space-y-1">
			<p class="text-[10px] text-gray-500 uppercase tracking-wide">Update Isolated Margin</p>
			<div class="flex gap-1">
				<input
					type="text"
					placeholder="+10 or -5 (USD)"
					bind:value={marginDeltaInput}
					class="flex-1 px-2 py-1 rounded border border-border-primary bg-surface-tertiary text-xs font-mono"
				/>
				<button
					class="px-2 py-1 rounded border border-border-primary text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
					disabled={submittingMargin}
					onclick={submitMargin}
				>
					{submittingMargin ? 'Updating…' : 'Apply'}
				</button>
			</div>
		</div>
	</div>

	{#if error}
		<p class="text-xs text-red-600 mt-2">{error}</p>
	{:else if ok}
		<p class="text-xs text-long mt-2">{ok}</p>
	{/if}
</div>
