<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { truncateAddress } from '$utils/format';
	import { onMount } from 'svelte';

	let showMenu = $state(false);
	let connecting = $state(false);

	onMount(() => {
		walletStore.tryReconnect();
		const cleanup = walletStore.setupListeners();
		return cleanup;
	});

	async function handleConnect() {
		if (connecting) return;
		connecting = true;
		try {
			await walletStore.connect();
		} catch (e) {
			console.error('Wallet connection failed:', e);
		} finally {
			connecting = false;
		}
	}

	function handleDisconnect() {
		walletStore.disconnect();
		showMenu = false;
	}
</script>

{#if walletStore.isConnected && walletStore.address}
	<div class="relative">
		<button
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-surface-tertiary rounded-lg border border-border-primary hover:border-accent transition-colors"
			onclick={() => showMenu = !showMenu}
		>
			<span class="w-2 h-2 rounded-full bg-long"></span>
			{truncateAddress(walletStore.address)}
		</button>

		{#if showMenu}
			<!-- backdrop -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-40" onclick={() => showMenu = false} onkeydown={() => {}}></div>
			<div class="absolute right-0 top-full mt-1 z-50 bg-surface-tertiary border border-border-primary rounded-lg shadow-xl p-1 min-w-[140px]">
				<button
					class="w-full text-left px-3 py-2 text-xs text-short hover:bg-surface-hover rounded transition-colors"
					onclick={handleDisconnect}
				>
					Disconnect
				</button>
			</div>
		{/if}
	</div>
{:else}
	<button
		class="px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent rounded-lg border border-accent/30 hover:bg-accent/30 transition-colors disabled:opacity-50"
		onclick={handleConnect}
		disabled={connecting || walletStore.status === 'connecting'}
	>
		{connecting || walletStore.status === 'connecting' ? 'Connecting...' : 'Connect'}
	</button>
{/if}
