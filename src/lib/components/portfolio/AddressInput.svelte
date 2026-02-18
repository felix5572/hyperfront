<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { getAddressHistory, pushAddressHistory, removeAddressHistory } from '$utils/addressHistory';
	import { truncateAddress } from '$utils/format';
	import ConnectButton from '$components/wallet/ConnectButton.svelte';

	interface Props {
		onView: (addr: `0x${string}`) => void;
		loading: boolean;
		showConnectWallet?: boolean;
		/** Shared view address so Portfolio and Orders show the same address when switching pages */
		currentViewAddress?: string | null;
	}
	let { onView, loading, showConnectWallet = false, currentViewAddress = null }: Props = $props();

	let inputValue = $state('');
	let inputError = $state<string | null>(null);
	let recentAddresses = $state<string[]>([]);

	$effect(() => {
		recentAddresses = getAddressHistory();
	});

	// Sync input from shared view address or wallet (Portfolio and Orders share the same address)
	$effect(() => {
		if (currentViewAddress) inputValue = currentViewAddress;
		else if (walletStore.address) inputValue = walletStore.address;
	});

	function isValidAddress(addr: string): addr is `0x${string}` {
		return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
	}

	function submitAddress(addr: string) {
		const trimmed = addr.trim();
		if (!isValidAddress(trimmed)) {
			inputError = 'Invalid address. Expected 0x followed by 40 hex characters.';
			return;
		}
		inputError = null;
		inputValue = trimmed;
		pushAddressHistory(trimmed);
		onView(trimmed as `0x${string}`);
	}

	function handleSubmit() {
		submitAddress(inputValue);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSubmit();
	}

	function pickRecent(addr: string) {
		submitAddress(addr);
	}

	function deleteRecent(addr: string) {
		removeAddressHistory(addr);
		recentAddresses = getAddressHistory();
	}
</script>

<div class="p-4 space-y-3">
	<div class="flex gap-2">
		<input
			type="text"
			bind:value={inputValue}
			placeholder="Hypercore wallet address: 0x1234...abcd"
			class="flex-1 px-3 py-2.5 bg-surface-tertiary border border-border-primary rounded-lg text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
			onkeydown={handleKeydown}
		/>
		<button
			class="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium shrink-0 hover:bg-accent/90 transition-colors disabled:opacity-50"
			onclick={handleSubmit}
			disabled={loading}
		>
			{loading ? '...' : 'View'}
		</button>
	</div>

	{#if inputError}
		<p class="text-xs text-short">{inputError}</p>
	{/if}

	{#if recentAddresses.length > 0}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-[10px] text-gray-500 uppercase tracking-wide shrink-0">Recent</span>
			{#each recentAddresses as addr (addr)}
				<div class="relative">
					<button
						type="button"
						class="px-2 py-1 pr-5 text-[11px] font-mono rounded bg-surface-tertiary border border-border-secondary text-gray-600 hover:border-accent hover:text-accent transition-colors"
						onclick={() => pickRecent(addr)}
					>
						{truncateAddress(addr)}
					</button>
					<button
						type="button"
						aria-label="Remove recent address"
						class="absolute -top-1 -right-1 w-4 h-4 rounded-full border border-border-secondary bg-surface-secondary text-[10px] leading-none text-gray-500 hover:text-short hover:border-short/40"
						onclick={(e) => {
							e.stopPropagation();
							deleteRecent(addr);
						}}
					>×</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if showConnectWallet && !walletStore.isConnected}
		<ConnectButton variant="large" />
	{/if}
</div>
