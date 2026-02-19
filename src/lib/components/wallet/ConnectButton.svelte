<script lang="ts">
	import { walletStore, type ConnectMethod } from '$stores/wallet.svelte';
	import { hasInjectedWallet } from '$lib/wallet/connect';
	import { truncateAddress } from '$utils/format';
	import { onMount } from 'svelte';

	let { variant = 'default' }: { variant?: 'default' | 'large' } = $props();

	let showMenu = $state(false);
	let showWalletPicker = $state(false);
	let connecting = $state(false);
	let connectError = $state<string | null>(null);
	const isMobile = $derived(
		typeof navigator !== 'undefined' && /iphone|ipad|ipod|android/i.test(navigator.userAgent)
	);
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

		// Mobile without injected wallet: go straight to WalletConnect
		if (isMobile && !hasInjected) {
			handleConnect('walletconnect');
			return;
		}

		showWalletPicker = true;
	}

	async function handleConnect(method: ConnectMethod) {
		if (connecting) return;
		showWalletPicker = false;
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

	function closePicker() {
		showWalletPicker = false;
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

		{#if showWalletPicker}
			<!-- backdrop -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-40" onclick={closePicker} onkeydown={() => {}}></div>
			<div class="absolute {variant === 'large' ? 'left-0' : 'right-0'} top-full mt-1 z-50 bg-surface-tertiary border border-border-primary rounded-lg shadow-xl min-w-[220px]">
				<p class="px-3 pt-2.5 pb-1.5 text-[11px] text-gray-500 leading-snug border-b border-border-secondary">
					Connecting grants read &amp; trade access.<br>
					To view only, enter an address below instead.
				</p>
				{#if hasInjected}
					<button
						class="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover transition-colors"
						onclick={() => handleConnect('injected')}
					>
						Browser Wallet
					</button>
				{/if}
				<button
					class="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover rounded-b-lg transition-colors"
					onclick={() => handleConnect('walletconnect')}
				>
					WalletConnect
				</button>
			</div>
		{/if}

		{#if connectError}
			<div class="absolute {variant === 'large' ? 'left-0' : 'right-0'} top-full mt-1 z-50 w-64 p-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-[11px] leading-snug shadow-lg">
				<p>{connectError}</p>
				{#if isMobile && !hasInjected}
					<p class="mt-1">Tip: use WalletConnect to connect your mobile wallet.</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}
