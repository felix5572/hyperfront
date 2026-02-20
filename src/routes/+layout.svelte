<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import Header from '$components/layout/Header.svelte';
	import BottomNav from '$components/layout/BottomNav.svelte';
	import WalletDisclaimer from '$components/wallet/WalletDisclaimer.svelte';
	import AgentKeyModal from '$components/wallet/AgentKeyModal.svelte';
	import WalletModal from '$components/wallet/WalletModal.svelte';
	import SuccessToast from '$components/common/SuccessToast.svelte';
	import ErrorModal from '$components/common/ErrorModal.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { agentStore } from '$stores/agent.svelte';

	let { children } = $props();

	let wcListenerCleanup: (() => void) | null = null;

	onMount(() => {
		const injCleanup = walletStore.setupListeners(); // injected listeners — safe to register immediately

		void walletStore.tryReconnect()
			.then(() => {
				if (walletStore.connectedVia === 'walletconnect') {
					wcListenerCleanup = walletStore.setupWCListeners(); // WC provider now exists
				}
			})
			.catch(() => {
				// keep UI usable even if reconnect fails
			});

		return () => {
			injCleanup();
			wcListenerCleanup?.();
		};
	});

	// Only clear agent after initialization when the user explicitly disconnected.
	$effect(() => {
		if (
			walletStore.initialized &&
			!walletStore.isConnected &&
			walletStore.lastDisconnectByUser
		) {
			agentStore.clear();
		}
	});
</script>

<svelte:head>
	<title>Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-dvh overflow-hidden bg-surface-primary">
	<Header />
	<main class="flex-1 min-h-0 overflow-y-auto">
		{@render children()}
	</main>
	<BottomNav />
</div>

<WalletDisclaimer />
<WalletModal />
<AgentKeyModal />
<SuccessToast />
<ErrorModal />
