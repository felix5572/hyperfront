<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { truncateAddress } from '$utils/format';
	import { onMount } from 'svelte';

	let { variant = 'default' }: { variant?: 'default' | 'large' } = $props();

	let showMenu = $state(false);
	let showConfirm = $state(false);
	let connecting = $state(false);
	let connectError = $state<string | null>(null);

	onMount(() => {
		walletStore.tryReconnect();
		const cleanup = walletStore.setupListeners();
		return cleanup;
	});

	async function handleConnect() {
		if (connecting) return;
		connecting = true;
		connectError = null;
		try {
			await walletStore.connect();
		} catch (e) {
			console.error('Wallet connection failed:', e);
			connectError = e instanceof Error ? e.message : String(e);
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
	<div>
		<button
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-surface-tertiary rounded-lg border border-border-primary hover:border-accent transition-colors"
			onclick={() => showMenu = !showMenu}
		>
			<span class="w-2 h-2 rounded-full bg-long"></span>
			{truncateAddress(walletStore.address)}
		</button>

		{#if showMenu}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm" onclick={() => showMenu = false} onkeydown={() => {}}></div>
			<div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
				<div class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
					<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
						<span class="text-sm font-semibold text-text-primary">Wallet</span>
						<button class="text-gray-500 hover:text-text-primary transition-colors text-lg leading-none" onclick={() => showMenu = false}>✕</button>
					</div>
					<div class="px-5 py-4">
						<p class="text-xs text-gray-500 mb-1">Connected address</p>
						<p class="text-sm font-mono text-text-primary break-all">{walletStore.address}</p>
					</div>
					<div class="px-5 pb-5">
						<button
							class="w-full py-3 text-sm font-semibold text-short bg-surface-tertiary hover:bg-surface-hover rounded-xl border border-border-primary transition-colors"
							onclick={handleDisconnect}
						>
							Disconnect
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="relative {variant === 'large' ? 'w-full' : ''}">
		<button
			class={variant === 'large'
				? 'w-full min-h-[48px] py-4 text-base font-semibold bg-accent text-white rounded-xl border-2 border-accent shadow-md hover:bg-accent/90 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50'
				: 'px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent rounded-lg border border-accent/30 hover:bg-accent/30 transition-colors disabled:opacity-50'}
			onclick={() => showConfirm = true}
			disabled={connecting || walletStore.status === 'connecting'}
		>
			{connecting || walletStore.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
		</button>

		{#if showConfirm}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onclick={() => showConfirm = false} onkeydown={() => {}}></div>
			<div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
				<div class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
					<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
						<span class="text-sm font-semibold text-text-primary">Connect Wallet</span>
						<button class="text-gray-500 hover:text-text-primary transition-colors text-lg leading-none" onclick={() => showConfirm = false}>✕</button>
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
					</div>
					<div class="px-5 pb-5">
						<button
							class="w-full py-3 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all"
							onclick={() => { showConfirm = false; handleConnect(); }}
						>
							Connect with WalletConnect
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if connectError}
			<div class="absolute {variant === 'large' ? 'left-0' : 'right-0'} top-full mt-1 z-50 w-64 p-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-[11px] leading-snug shadow-lg">
				<p>{connectError}</p>
			</div>
		{/if}
	</div>
{/if}
