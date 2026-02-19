<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';

	let connecting = $state(false);
	let connectError = $state<string | null>(null);

	function close() {
		walletStore.modalOpen = false;
		connectError = null;
	}

	async function handleConnect() {
		connecting = true;
		connectError = null;
		try {
			await walletStore.connect();
			walletStore.modalOpen = false;
		} catch (e) {
			connectError = e instanceof Error ? e.message : String(e);
		} finally {
			connecting = false;
		}
	}

	function handleDisconnect() {
		walletStore.disconnect();
		walletStore.modalOpen = false;
	}
</script>

{#if walletStore.modalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm" onclick={close} onkeydown={() => {}}></div>
	<div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
		<div class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">

			{#if walletStore.isConnected && walletStore.address}
				<!-- Connected: show address + disconnect -->
				<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
					<span class="text-sm font-semibold text-text-primary">Wallet</span>
					<button class="text-gray-500 hover:text-text-primary transition-colors text-lg leading-none" onclick={close}>✕</button>
				</div>
				<div class="px-5 py-4">
					<p class="text-xs text-gray-500 mb-1">Connected address</p>
					<p class="text-sm font-mono text-text-primary break-all">{walletStore.address}</p>
				</div>
				<div class="px-5 pb-5">
					<button
						class="w-full py-3 text-sm font-semibold text-short bg-surface-tertiary hover:bg-surface-hover rounded-xl border border-border-primary transition-colors"
						onclick={handleDisconnect}
					>Disconnect</button>
				</div>

			{:else}
				<!-- Disconnected: disclaimer + connect -->
				<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
					<span class="text-sm font-semibold text-text-primary">Connect Wallet</span>
					<button class="text-gray-500 hover:text-text-primary transition-colors text-lg leading-none" onclick={close}>✕</button>
				</div>
				<div class="px-5 py-4 space-y-3 text-[13px] text-gray-300 leading-relaxed">
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-500 mt-px">·</span>
						<span><span class="text-red-400 font-semibold">Unofficial &amp; open-source</span> — no affiliation with Hyperliquid. PRs welcome.</span>
					</div>
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-500 mt-px">·</span>
						<span><span class="text-red-400 font-semibold">Early stage, expect bugs</span> — data may be inaccurate. <span class="text-red-400 font-semibold">Not financial advice.</span></span>
					</div>
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-500 mt-px">·</span>
						<span>We <span class="text-red-400 font-semibold">never ask for your private key</span> or seed phrase.</span>
					</div>
					<div class="flex gap-2.5">
						<span class="shrink-0 text-gray-500 mt-px">·</span>
						<span>Your wallet signature is <span class="text-red-400 font-semibold">only requested once</span> to set up the agent wallet.</span>
					</div>
					<p class="pt-1 text-gray-500 text-xs">
						Just want to view charts or positions? Enter any wallet address in the search field — no connection needed.
					</p>
					{#if connectError}
						<p class="text-xs text-red-400" role="alert">{connectError}</p>
					{/if}
				</div>
				<div class="px-5 pb-5">
					<button
						class="w-full py-3 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50"
						disabled={connecting}
						onclick={handleConnect}
					>
						{connecting ? 'Connecting...' : 'Connect with WalletConnect'}
					</button>
				</div>
			{/if}

		</div>
	</div>
{/if}
