<script lang="ts">
	import { agentStore } from "$stores/agent.svelte";
	import { walletStore } from "$stores/wallet.svelte";
	import { createHlWalletAdapter } from "$lib/wallet/hlWalletAdapter";
	import { approveAgentWallet } from "$lib/api/exchange";

	let loading = $state(false);
	let error = $state<string | null>(null);

	const ARBITRUM_CHAIN_ID = "0xa4b1";

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
			if (!wc || !walletStore.address)
				throw new Error("Wallet not connected");

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const currentChain = await (wc as any).request({
				method: "eth_chainId",
			});
			if (currentChain !== ARBITRUM_CHAIN_ID) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					await (wc as any).request({
						method: "wallet_switchEthereumChain",
						params: [{ chainId: ARBITRUM_CHAIN_ID }],
					});
				} catch (switchErr: unknown) {
					const code = (switchErr as { code?: number })?.code;
					if (code === 4902) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						await (wc as any).request({
							method: "wallet_addEthereumChain",
							params: [
								{
									chainId: ARBITRUM_CHAIN_ID,
									chainName: "Arbitrum One",
									rpcUrls: ["https://arb1.arbitrum.io/rpc"],
									nativeCurrency: {
										name: "Ether",
										symbol: "ETH",
										decimals: 18,
									},
									blockExplorerUrls: ["https://arbiscan.io"],
								},
							],
						});
					} else {
						throw switchErr;
					}
				}
			}

			const agentAddr = agentStore.address;
			if (!agentAddr) throw new Error("Failed to generate agent key");

			const masterWallet = createHlWalletAdapter(wc, walletStore.address);
			if (!masterWallet) throw new Error("Wallet adapter not ready");

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
	<div
		class="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
	>
		<div
			class="w-full max-w-sm bg-surface-primary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
			role="dialog"
			aria-modal="true"
			aria-label="Agent Wallet"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-5 py-4 border-b border-border-primary"
			>
				<span class="text-base font-bold text-white">Agent Wallet</span>
				<button
					class="text-gray-400 hover:text-white transition-colors text-xl leading-none"
					onclick={close}>✕</button
				>
			</div>

			<!-- Body -->
			<div class="px-5 py-4 space-y-4 text-sm leading-relaxed">
				{#if agentStore.approved && agentStore.address}
					<!-- Approved state -->
					<div
						class="flex items-center gap-2 text-green-400 font-semibold"
					>
						<span>✓</span>
						<span>Agent wallet active</span>
					</div>
					<div
						class="rounded-lg border border-border-primary bg-surface-secondary p-3 space-y-2 text-sm"
					>
						<div class="flex justify-between items-center">
							<span class="text-gray-400">App</span>
							<span class="text-white font-medium"
								>hyper-front.xyz</span
							>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-gray-400">Agent address</span>
							<span class="text-white font-mono"
								>{agentStore.address.slice(
									0,
									6,
								)}…{agentStore.address.slice(-4)}</span
							>
						</div>
					</div>
					<p class="text-gray-300">
						Orders are signed locally. Your signing session is
						active on this device.
					</p>
					<p class="text-gray-400 text-sm">
						To revoke this agent wallet, visit
						<a
							href="https://app.hyperliquid.xyz/API"
							target="_blank"
							rel="noopener noreferrer"
							class="text-accent underline font-medium"
							>app.hyperliquid.xyz/API</a
						>
					</p>
					<button
						class="w-full py-2.5 mt-2 text-xs font-semibold border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
						onclick={() => agentStore.clear()}
					>
						Disconnect locally
					</button>
				{:else}
					<!-- Not yet approved state -->
					<p class="text-gray-200">
						Required to place and cancel orders on Hyperfront.
					</p>
					<div class="space-y-2.5">
						<div class="flex gap-2">
							<span class="text-gray-500 shrink-0 mt-0.5">·</span>
							<span class="text-gray-300"
								>Can only <span class="text-white font-semibold"
									>place and cancel orders</span
								> — cannot withdraw or transfer funds</span
							>
						</div>
						<div class="flex gap-2">
							<span class="text-gray-500 shrink-0 mt-0.5">·</span>
							<span class="text-gray-300"
								>Session remains active until manually
								disconnected</span
							>
						</div>
						<div class="flex gap-2">
							<span class="text-gray-500 shrink-0 mt-0.5">·</span>
							<span class="text-gray-300"
								>App name: <span class="text-white font-medium"
									>hyper-front.xyz</span
								></span
							>
						</div>
						<div class="flex gap-2">
							<span class="text-gray-500 shrink-0 mt-0.5">·</span>
							<span class="text-gray-300"
								>To revoke: <a
									href="https://app.hyperliquid.xyz/API"
									target="_blank"
									rel="noopener noreferrer"
									class="text-accent underline"
									>app.hyperliquid.xyz/API</a
								></span
							>
						</div>
					</div>
					{#if error}
						<div
							class="rounded-lg bg-red-900/40 border border-red-500/50 p-3 space-y-1"
						>
							<p class="text-sm font-semibold text-red-400">
								Setup failed
							</p>
							<p class="text-sm text-red-300 break-all">
								{error}
							</p>
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
						{loading ? "Setting up…" : "Set up signing key"}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
