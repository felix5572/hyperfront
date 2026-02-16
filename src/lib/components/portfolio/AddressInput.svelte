<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { getAddressHistory, pushAddressHistory } from '$utils/addressHistory';
	import { truncateAddress } from '$utils/format';

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
				<button
					type="button"
					class="px-2 py-1 text-[11px] font-mono rounded bg-surface-tertiary border border-border-secondary text-gray-600 hover:border-accent hover:text-accent transition-colors"
					onclick={() => pickRecent(addr)}
				>
					{truncateAddress(addr)}
				</button>
			{/each}
		</div>
	{/if}

	{#if showConnectWallet && !walletStore.isConnected}
		<button
			class="w-full min-h-[48px] py-4 text-base font-semibold bg-accent text-white rounded-xl border-2 border-accent shadow-md hover:bg-accent/90 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:bg-accent disabled:shadow-md"
			onclick={() => walletStore.connect()}
			disabled={walletStore.status === 'connecting'}
		>
			{walletStore.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
		</button>
	{/if}
</div>
