<script lang="ts">
	import { agentStore } from '$stores/agent.svelte';
	import { walletStore } from '$stores/wallet.svelte';
	import { createHlWalletAdapter } from '$lib/wallet/hlWalletAdapter';
	import { approveAgentWallet } from '$lib/api/exchange';

	let loading = $state(false);
	let error = $state<string | null>(null);

	const ARBITRUM_CHAIN_ID = '0xa4b1';

	function close() {
		agentStore.modalOpen = false;
		error = null;
	}

	async function setup() {
		error = null;
		loading = true;
		try {
			agentStore.generateKey();

			const wc = walletStore.walletClient;
			if (!wc || !walletStore.address) throw new Error('Wallet not connected');

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
</script>

{#if agentStore.modalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm"
		onclick={close}
		onkeydown={() => {}}
	></div>
	<div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
		<div
			class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
			role="dialog"
			aria-modal="true"
			aria-label="Agent Wallet"
		>
			<div class="flex items-center justify-between px-5 py-4 border-b border-border-primary">
				<span class="text-sm font-semibold text-gray-900">Agent Wallet</span>
				<button
					class="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none"
					onclick={close}
				>✕</button>
			</div>

			<div class="px-5 py-4 space-y-3 text-[13px] text-gray-700 leading-relaxed">
				{#if agentStore.approved && agentStore.address}
					<div class="flex items-center gap-2 text-sm text-green-600 font-semibold">
						<span>✓</span>
						<span>Agent wallet active</span>
					</div>
					<p class="text-xs text-gray-500 font-mono">
						{agentStore.address.slice(0, 6)}…{agentStore.address.slice(-4)}
					</p>
					<p class="text-gray-600">Orders are signed locally. The key lives in memory only and disappears on refresh.</p>
				{:else}
					<p class="text-gray-700">Required to place and cancel orders on Hyperfront.</p>
					<div class="space-y-1.5">
						<div class="flex gap-2">
							<span class="text-gray-400 shrink-0">·</span>
							<span>Can only <span class="text-gray-900 font-semibold">place and cancel orders</span> — cannot withdraw or transfer funds</span>
						</div>
						<div class="flex gap-2">
							<span class="text-gray-400 shrink-0">·</span>
							<span>Key exists in memory only, gone on refresh</span>
						</div>
						<div class="flex gap-2">
							<span class="text-gray-400 shrink-0">·</span>
							<span>Manage existing agents: <a href="https://app.hyperliquid.xyz/API" target="_blank" rel="noopener noreferrer" class="text-accent underline">app.hyperliquid.xyz/API</a></span>
						</div>
					</div>
					{#if error}
						<div class="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
							<p class="text-xs font-semibold text-red-700">Setup failed</p>
							<p class="text-xs text-red-600 break-all">{error}</p>
						</div>
					{/if}
				{/if}
			</div>

			{#if !agentStore.approved}
				<div class="px-5 pb-5">
					<button
						class="w-full py-3 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50"
						disabled={loading}
						onclick={setup}
					>
						{loading ? 'Setting up…' : 'Set up signing key'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
