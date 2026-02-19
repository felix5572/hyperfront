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

	function revoke() {
		agentStore.clear();
		error = null;
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
				<span class="text-sm font-semibold text-text-primary">Agent Wallet</span>
				<button
					class="text-gray-500 hover:text-text-primary transition-colors text-lg leading-none"
					onclick={close}
				>✕</button>
			</div>

			<div class="px-5 py-4 space-y-3">
				{#if agentStore.approved && agentStore.address}
					<div class="flex items-center gap-2 text-sm text-green-500">
						<span>✓</span>
						<span>Signing key active</span>
					</div>
					<p class="text-xs text-gray-500 font-mono">
						Agent: {agentStore.address.slice(0, 6)}…{agentStore.address.slice(-4)}
					</p>
					<p class="text-[13px] text-gray-300 leading-relaxed">
						Orders sign locally — no MetaMask pop-ups. Key lives in memory only and disappears on refresh.
					</p>
				{:else}
					<p class="text-[13px] text-gray-300 leading-relaxed">
						Generates a temporary local key and approves it on Arbitrum, so orders sign without MetaMask pop-ups. The key cannot withdraw funds.
					</p>
					{#if error}
						<p class="text-xs text-red-400" role="alert">{error}</p>
					{/if}
				{/if}
			</div>

			<div class="px-5 pb-5">
				{#if agentStore.approved}
					<button
						class="w-full py-3 text-sm font-semibold text-short bg-surface-tertiary hover:bg-surface-hover rounded-xl border border-border-primary transition-colors"
						onclick={revoke}
					>Revoke</button>
				{:else}
					<button
						class="w-full py-3 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50"
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
