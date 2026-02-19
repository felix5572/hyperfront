<script lang="ts">
	import { agentStore } from '$stores/agent.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { createHlWalletAdapter } from '$lib/wallet/hlWalletAdapter';
	import { approveAgentWallet } from '$lib/api/exchange';

	let isOpen = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const ARBITRUM_CHAIN_ID = '0xa4b1';

	async function setup() {
		error = null;
		loading = true;
		try {
			agentStore.generateKey();

			const wc = walletStore.walletClient;
			if (!wc || !walletStore.address) throw new Error('Wallet not connected');

			// Switch to Arbitrum if needed
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const currentChain = await (wc as any).request({ method: 'eth_chainId' });
			if (currentChain !== ARBITRUM_CHAIN_ID) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					await (wc as any).request({
						method: 'wallet_switchEthereumChain',
						params: [{ chainId: ARBITRUM_CHAIN_ID }]
					});
				} catch (switchErr: unknown) {
					const code = (switchErr as { code?: number })?.code;
					if (code === 4902) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						await (wc as any).request({
							method: 'wallet_addEthereumChain',
							params: [
								{
									chainId: ARBITRUM_CHAIN_ID,
									chainName: 'Arbitrum One',
									rpcUrls: ['https://arb1.arbitrum.io/rpc'],
									nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
									blockExplorerUrls: ['https://arbiscan.io']
								}
							]
						});
					} else {
						throw switchErr;
					}
				}
			}

			const agentAddr = agentStore.address;
			if (!agentAddr) throw new Error('Failed to generate agent key');

			const masterWallet = createHlWalletAdapter(wc, walletStore.address);
			if (!masterWallet) throw new Error('Wallet adapter not ready');

			await approveAgentWallet(masterWallet, agentAddr);
			agentStore.markApproved();
		} catch (e) {
			agentStore.clear();
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function revoke() {
		agentStore.clear();
		error = null;
	}
</script>

<!-- Header button -->
<button
	class="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors {agentStore.approved
		? 'border-green-400 text-green-600 bg-green-50 hover:bg-green-100'
		: 'border-orange-400 text-orange-600 bg-orange-50 hover:bg-orange-100'}"
	onclick={() => {
		isOpen = true;
		error = null;
	}}
	title="Signing key"
>
	<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
	</svg>
	{agentStore.approved ? 'Key ✓' : 'Key ⚠'}
</button>

<!-- Modal -->
{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/35"
		aria-label="Close signing key dialog"
		onclick={() => {
			isOpen = false;
			error = null;
		}}
	></button>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="w-full max-w-sm rounded-xl border border-border-primary bg-surface-secondary shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-label="Signing Key"
		>
			<div class="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
				<h3 class="text-sm font-semibold">Signing Key</h3>
				<button
					class="text-xs text-gray-500 hover:text-gray-700"
					onclick={() => {
						isOpen = false;
						error = null;
					}}
				>✕</button>
			</div>

			<div class="p-4 space-y-3">
				{#if agentStore.approved && agentStore.address}
					<div class="flex items-center gap-2 text-sm text-green-600">
						<span class="text-base">✓</span>
						<span>Signing key active</span>
					</div>
					<p class="text-xs text-gray-500 font-mono">
						Agent: {agentStore.address.slice(0, 6)}…{agentStore.address.slice(-4)}
					</p>
					<p class="text-[11px] text-gray-400">
						Orders will be signed locally without MetaMask pop-ups. The key exists only in memory and disappears on refresh.
					</p>
					<button
						class="w-full py-2 rounded border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50"
						onclick={revoke}
					>Revoke</button>
				{:else}
					<p class="text-xs text-gray-600">
						Required for placing &amp; canceling orders without MetaMask pop-ups.
					</p>
					<p class="text-[11px] text-gray-400">
						A temporary signing key is generated locally and approved on Arbitrum. It cannot withdraw funds.
					</p>
					{#if error}
						<p class="text-xs text-red-600" role="alert">{error}</p>
					{/if}
					<button
						class="w-full py-2 rounded bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50"
						disabled={loading}
						onclick={setup}
					>
						{loading ? 'Setting up…' : 'Set up signing key'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
