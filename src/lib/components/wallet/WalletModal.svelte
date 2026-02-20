<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { hasInjectedWallet } from '$lib/wallet/injected';
	import type { ConnectMethod } from '$stores/wallet.svelte';

	let connectingMethod = $state<ConnectMethod | null>(null);
	let connectError = $state<string | null>(null);

	function close() {
		walletStore.modalOpen = false;
		connectError = null;
	}

	async function handleConnect(method: ConnectMethod) {
		connectingMethod = method;
		connectError = null;
		// For WalletConnect: close our modal immediately so the WC QR overlay
		// appears cleanly without our modal showing behind it when it closes.
		if (method === 'walletconnect') {
			walletStore.modalOpen = false;
		}
		try {
			await walletStore.connect(method);
			walletStore.modalOpen = false;
		} catch (e) {
			connectError = e instanceof Error ? e.message : String(e);
			// If WC failed, reopen our modal so the error is visible.
			if (method === 'walletconnect') {
				walletStore.modalOpen = true;
			}
		} finally {
			connectingMethod = null;
		}
	}

	async function handleDisconnect() {
		await walletStore.disconnect();
		walletStore.modalOpen = false;
	}

	const viaLabel = $derived(
		walletStore.connectedVia === 'injected' ? 'MetaMask / Browser Wallet' : 'WalletConnect'
	);
</script>

{#if walletStore.modalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm" onclick={close} onkeydown={() => {}}></div>
	<div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
		<div class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">

			{#if walletStore.isConnected && walletStore.address}
				<!-- Connected: show address + via label + disconnect -->
				<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
					<span class="text-sm font-semibold text-gray-900">Wallet</span>
					<button class="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none" onclick={close}>✕</button>
				</div>
				<div class="px-5 py-4">
					<p class="text-xs text-gray-500 mb-1">Connected address</p>
					<p class="text-sm font-mono text-gray-900 break-all">{walletStore.address}</p>
					<p class="text-xs text-gray-500 mt-2">via {viaLabel}</p>
				</div>
				<div class="px-5 pb-5">
					<button
						class="w-full py-3 text-sm font-semibold text-short bg-surface-tertiary hover:bg-surface-hover rounded-xl border border-border-primary transition-colors"
						onclick={handleDisconnect}
					>Disconnect</button>
				</div>

			{:else}
				<!-- Disconnected: disclaimer + connect options -->
				<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
					<span class="text-sm font-semibold text-gray-900">Connect Wallet</span>
					<button class="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none" onclick={close}>✕</button>
				</div>
				<div class="px-5 py-4 space-y-3 text-[13px] text-gray-600 leading-relaxed">
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-400 mt-px">·</span>
						<span><span class="text-red-600 font-semibold">Unofficial &amp; open-source</span> — no affiliation with Hyperliquid. PRs welcome.</span>
					</div>
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-400 mt-px">·</span>
						<span><span class="text-red-600 font-semibold">Early stage, expect bugs</span> — data may be inaccurate. <span class="text-red-600 font-semibold">Not financial advice.</span></span>
					</div>
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-400 mt-px">·</span>
						<span>We <span class="text-red-600 font-semibold">never ask for your private key</span> or seed phrase.</span>
					</div>
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-400 mt-px">·</span>
						<span>Your wallet signature is <span class="text-gray-900 font-semibold">only requested once</span> to set up the agent wallet.</span>
					</div>
					<p class="pt-1 text-gray-500 text-xs">
						Just want to view charts or positions? Enter any wallet address in the search field — no connection needed.
					</p>
					{#if connectError}
						<p class="text-xs text-red-600 font-medium" role="alert">{connectError}</p>
					{/if}
				</div>
				<div class="px-5 pb-5 space-y-2">
					{#if hasInjectedWallet()}
						<button
							class="w-full py-3 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50"
							disabled={connectingMethod !== null}
							onclick={() => handleConnect('injected')}
						>
							{connectingMethod === 'injected' ? 'Connecting…' : 'MetaMask / Browser Wallet'}
						</button>
					{/if}
					<button
						class="w-full py-3 text-sm font-semibold bg-surface-tertiary text-text-primary rounded-xl hover:bg-surface-hover border border-border-primary active:scale-[0.98] transition-all disabled:opacity-50"
						disabled={connectingMethod !== null}
						onclick={() => handleConnect('walletconnect')}
					>
						{connectingMethod === 'walletconnect' ? 'Connecting…' : 'Connect with WalletConnect'}
					</button>
				</div>
			{/if}

		</div>
	</div>
{/if}
