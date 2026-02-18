<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { accountStore } from '$stores/account.svelte';
	import { marketStore } from '$stores/market.svelte';
	import AddressInput from '$components/portfolio/AddressInput.svelte';
	import PositionCard from '$components/portfolio/PositionCard.svelte';
	import SpotBalances from '$components/portfolio/SpotBalances.svelte';
	import { formatUsd } from '$utils/format';

	let subscribedUser: `0x${string}` | null = null;
	let lastAddressFromQuery = $state<`0x${string}` | null>(null);

	// When wallet connects, subscribe for real-time updates
	$effect(() => {
		const addr = walletStore.address;
		if (addr && addr !== subscribedUser) {
			subscribedUser = addr;
			accountStore.subscribeAccount(addr);
		} else if (!addr && subscribedUser) {
			accountStore.unsubscribeAccount(subscribedUser);
			subscribedUser = null;
		}
	});

	// Ensure allMids subscription is active (for spot USD values)
	$effect(() => {
		if (accountStore.viewAddress && Object.keys(marketStore.allMids).length === 0) {
			marketStore.initMids();
		}
	});

	$effect(() => {
		const q = page.url.searchParams.get('address')?.trim() ?? '';
		if (!/^0x[a-fA-F0-9]{40}$/.test(q)) return;
		const addr = q as `0x${string}`;
		if (addr === lastAddressFromQuery || addr === accountStore.viewAddress) return;
		lastAddressFromQuery = addr;
		void accountStore.loadAddress(addr);
	});

	onDestroy(() => {
		const current = accountStore.viewAddress;
		if (current) {
			accountStore.unsubscribeAccount(current);
		}
	});

	const hasData = $derived(accountStore.viewAddress !== null && !accountStore.loading);
	const totalPerpPositions = $derived(
		accountStore.perpDexPositionGroups.reduce((acc, g) => acc + g.positions.length, 0)
	);

	const STABLES = ['USDC', 'USDT', 'USDT0', 'USDE', 'USDH'];
	const perpAccountValue = $derived(parseFloat(accountStore.marginSummary?.accountValue ?? '0'));
	const totalSpotUsd = $derived(
		accountStore.spotBalancesFull.reduce((sum, b) => {
			if (STABLES.includes(b.coin)) return sum + parseFloat(b.total);
			const mid = marketStore.allMids[b.coin];
			if (!mid) return sum;
			return sum + parseFloat(b.total) * parseFloat(mid);
		}, 0)
	);
	const totalValue = $derived(perpAccountValue + totalSpotUsd);
</script>

<svelte:head>
	<title>Portfolio | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full overflow-y-auto">
	<AddressInput
		onView={(addr) => accountStore.loadAddress(addr)}
		loading={accountStore.loading}
		showConnectWallet
		currentViewAddress={accountStore.viewAddress}
	/>

	{#if accountStore.loading}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-sm text-gray-500">Loading account data...</div>
		</div>
	{:else if hasData}
		<!-- Value Summary -->
		<div class="grid grid-cols-3 divide-x divide-border-secondary border-b border-border-secondary">
			<div class="px-3 py-2.5 text-center">
				<p class="text-[10px] text-gray-500 mb-0.5">合约账户</p>
				<p class="text-sm font-semibold tabular-nums">{formatUsd(perpAccountValue, true)}</p>
			</div>
			<div class="px-3 py-2.5 text-center">
				<p class="text-[10px] text-gray-500 mb-0.5">现货总值</p>
				<p class="text-sm font-semibold tabular-nums">{formatUsd(totalSpotUsd, true)}</p>
			</div>
			<div class="px-3 py-2.5 text-center">
				<p class="text-[10px] text-gray-500 mb-0.5">总计</p>
				<p class="text-sm font-bold tabular-nums text-accent">{formatUsd(totalValue, true)}</p>
			</div>
		</div>

		<!-- Perp Positions -->
		<div class="px-4 pb-2">
			<h3 class="text-xs text-gray-500 uppercase tracking-wide mb-2">
				Perp Positions ({totalPerpPositions})
			</h3>

			{#if totalPerpPositions === 0}
				<div class="text-center py-6 text-sm text-gray-500">
					No open positions
				</div>
			{:else}
				<div class="space-y-3">
					{#each accountStore.perpDexPositionGroups as group (group.dex || 'main')}
						<div class="pt-1 {group.dex === '' ? '' : 'border-t border-border-secondary/60'}">
							<p class="text-[10px] text-gray-500 mb-1.5">{group.label}</p>
							<div class="space-y-2">
								{#each group.positions as position (`${group.dex}:${position.coin}`)}
									<PositionCard {position} />
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Spot Balances -->
		<SpotBalances />

		<!-- Raw data: one outer fold, collapsed by default -->
		<div class="px-4 pb-4 border-t border-border-secondary">
			<details class="group pt-3">
				<summary class="text-xs text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 list-none flex items-center gap-1">
					<svg class="w-3.5 h-3.5 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
					Raw data (clearinghouse, spot, WebData3, all DEXs)
				</summary>
				<div class="mt-3 space-y-3">
					{#if accountStore.clearinghouse != null}
						<details class="bg-surface-secondary rounded-lg border border-border-secondary">
							<summary class="px-3 py-2 text-xs font-medium cursor-pointer select-none hover:bg-surface-hover rounded-t-lg">Clearinghouse state (main DEX)</summary>
							<pre class="p-3 text-[10px] font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-gray-700 bg-surface-tertiary rounded-b-lg border-t border-border-secondary">{JSON.stringify(accountStore.clearinghouse, null, 2)}</pre>
						</details>
					{/if}

					{#if accountStore.spotClearinghouseStateRaw != null}
						<details class="bg-surface-secondary rounded-lg border border-border-secondary">
							<summary class="px-3 py-2 text-xs font-medium cursor-pointer select-none hover:bg-surface-hover rounded-t-lg">Spot clearinghouse state</summary>
							<pre class="p-3 text-[10px] font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-gray-700 bg-surface-tertiary rounded-b-lg border-t border-border-secondary">{JSON.stringify(accountStore.spotClearinghouseStateRaw, null, 2)}</pre>
						</details>
					{/if}

					{#if accountStore.webData3Raw != null}
						<details class="bg-surface-secondary rounded-lg border border-border-secondary">
							<summary class="px-3 py-2 text-xs font-medium cursor-pointer select-none hover:bg-surface-hover rounded-t-lg">WebData3</summary>
							<pre class="p-3 text-[10px] font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-gray-700 bg-surface-tertiary rounded-b-lg border-t border-border-secondary">{JSON.stringify(accountStore.webData3Raw, null, 2)}</pre>
						</details>
					{/if}

					{#if accountStore.allDexsClearinghouse.length > 0}
						<details class="bg-surface-secondary rounded-lg border border-border-secondary">
							<summary class="px-3 py-2 text-xs font-medium cursor-pointer select-none hover:bg-surface-hover rounded-t-lg">All DEXs clearinghouse ({accountStore.allDexsClearinghouse.length} DEXs)</summary>
							<pre class="p-3 text-[10px] font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-gray-700 bg-surface-tertiary rounded-b-lg border-t border-border-secondary">{JSON.stringify(accountStore.allDexsClearinghouse, null, 2)}</pre>
						</details>
					{/if}

					{#if accountStore.clearinghouse == null && accountStore.spotClearinghouseStateRaw == null && accountStore.webData3Raw == null && accountStore.allDexsClearinghouse.length === 0}
						<p class="text-xs text-gray-500">Waiting for data…</p>
					{/if}
				</div>
			</details>
		</div>
	{:else}
		<!-- Empty state hint -->
		<div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
			<div class="w-16 h-16 mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
				<svg class="w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="2" y="6" width="20" height="14" rx="2" />
					<path d="M2 10h20" />
					<path d="M16 14h2" />
				</svg>
			</div>
			<p class="text-sm text-gray-500">Enter a wallet address above to view portfolio, or connect your wallet.</p>
		</div>
	{/if}
</div>
