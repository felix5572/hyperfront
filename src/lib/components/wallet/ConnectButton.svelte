<script lang="ts">
	import { walletStore, type ConnectMethod } from '$stores/wallet.svelte';
	import { hasInjectedWallet } from '$lib/wallet/connect';
	import { truncateAddress } from '$utils/format';
	import { onMount } from 'svelte';

	let { variant = 'default' }: { variant?: 'default' | 'large' } = $props();

	let showMenu = $state(false);
	let showConfirm = $state(false);
	let connecting = $state(false);
	let connectError = $state<string | null>(null);
	const hasInjected = $derived(
		typeof window !== 'undefined' && hasInjectedWallet()
	);

	onMount(() => {
		walletStore.tryReconnect();
		const cleanup = walletStore.setupListeners();
		return cleanup;
	});

	function handleConnectClick() {
		connectError = null;
		showConfirm = true;
	}

	function handleConfirm() {
		showConfirm = false;
		// Auto-pick: use injected wallet if available, otherwise WalletConnect
		handleConnect(hasInjected ? 'injected' : 'walletconnect');
	}

	async function handleConnect(method: ConnectMethod) {
		if (connecting) return;
		connecting = true;
		connectError = null;
		try {
			await walletStore.connect(method);
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

	function closeConfirm() {
		showConfirm = false;
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
	<div class="relative {variant === 'large' ? 'w-full' : ''}">
		<button
			class={variant === 'large'
				? 'w-full min-h-[48px] py-4 text-base font-semibold bg-accent text-white rounded-xl border-2 border-accent shadow-md hover:bg-accent/90 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50'
				: 'px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent rounded-lg border border-accent/30 hover:bg-accent/30 transition-colors disabled:opacity-50'}
			onclick={handleConnectClick}
			disabled={connecting || walletStore.status === 'connecting'}
		>
			{connecting || walletStore.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
		</button>

		{#if showConfirm}
			<!-- full-screen modal -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onclick={closeConfirm} onkeydown={() => {}}></div>
			<div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
				<div class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
					<!-- Header -->
					<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
						<span class="text-sm font-semibold text-text-primary">Connect Wallet</span>
						<button class="text-gray-500 hover:text-text-primary transition-colors text-lg leading-none" onclick={closeConfirm}>✕</button>
					</div>
					<!-- Disclaimer body -->
					<div class="px-5 py-4 space-y-2.5 text-[12px] text-gray-400 leading-relaxed">
						<div class="flex gap-2">
							<span class="shrink-0 text-gray-500">·</span>
							<span><span class="text-text-primary font-medium">Unofficial &amp; open-source</span> — no affiliation with Hyperliquid. PRs welcome.</span>
						</div>
						<div class="flex gap-2">
							<span class="shrink-0 text-gray-500">·</span>
							<span><span class="text-text-primary font-medium">Early stage, expect bugs</span> — data may be inaccurate. Not financial advice.</span>
						</div>
						<div class="flex gap-2">
							<span class="shrink-0 text-gray-500">·</span>
							<span><span class="text-text-primary font-medium">We never ask for your private key</span> or seed phrase.</span>
						</div>
						<div class="flex gap-2">
							<span class="shrink-0 text-gray-500">·</span>
							<span>Your wallet signature is <span class="text-text-primary font-medium">only requested when placing or canceling orders</span>.</span>
						</div>
						<p class="pt-1 text-gray-500 text-[11px]">
							Just want to view charts or positions? Enter any wallet address in the search field — no connection needed.
						</p>
					</div>
					<div class="px-5 pb-5">
						<button
							class="w-full py-3 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all"
							onclick={handleConfirm}
						>
							Confirm and Connect
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
