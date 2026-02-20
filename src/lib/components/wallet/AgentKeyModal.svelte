<script lang="ts">
	import { agentStore } from "$stores/agent.svelte";
	import { walletStore } from "$stores/wallet.svelte";
	import { createHlWalletAdapter } from "$lib/wallet/hlWalletAdapter";
	import { approveAgentWallet } from "$lib/api/exchange";

	let loading = $state(false);
	let setupStep = $state<string | null>(null);
	let error = $state<string | null>(null);

	function close() {
		agentStore.modalOpen = false;
		error = null;
		setupStep = null;
	}

	async function setup() {
		error = null;
		loading = true;
		try {
			setupStep = "Generating signing key…";
			agentStore.generateKey();

			const wc = walletStore.walletClient;
			if (!wc || !walletStore.address) throw new Error("Wallet not connected");

			const agentAddr = agentStore.address;
			if (!agentAddr) throw new Error("Failed to generate agent key");

			const masterWallet = createHlWalletAdapter(wc, walletStore.address);
			if (!masterWallet) throw new Error("Wallet adapter not ready");

			setupStep = "Sign the request in your wallet…";

			// Race signing against a 90 s timeout so we surface a clear message
			// if the wallet opens but the user never sees the prompt.
			await Promise.race([
				approveAgentWallet(masterWallet, agentAddr),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error(
							'Signing timed out (30 s). ' +
							'If MetaMask opened but showed nothing, check the ' +
							'Notifications / Activity tab and try again.'
						)),
						30_000
					)
				)
			]);

			agentStore.markApproved();
			setupStep = null;
		} catch (e) {
			agentStore.clear();
			error = e instanceof Error ? e.message : String(e);
			setupStep = null;
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
			class="w-full max-w-sm bg-surface-secondary border border-border-primary rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
			role="dialog"
			aria-modal="true"
			aria-label="Agent Wallet"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-5 py-4 border-b border-border-primary"
			>
				<span class="text-base font-bold text-gray-900"
					>Agent Wallet</span
				>
				<button
					class="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
					onclick={close}>✕</button
				>
			</div>

			<!-- Body -->
			<div class="px-5 py-5 space-y-4 text-sm leading-relaxed">
				{#if agentStore.approved && agentStore.address}
					<!-- Approved state -->
					<div class="flex items-center gap-2 text-long font-bold">
						<span class="text-lg">✓</span>
						<span>Agent signing active</span>
					</div>
					<div
						class="rounded-xl border border-border-secondary bg-surface-tertiary/50 p-4 space-y-3"
					>
						<div
							class="flex justify-between items-center text-[13px]"
						>
							<span class="text-gray-500">Domain</span>
							<span class="text-gray-900 font-medium"
								>hyper-front.xyz</span
							>
						</div>
						<div
							class="flex justify-between items-center text-[13px]"
						>
							<span class="text-gray-500">Agent address</span>
							<span
								class="text-gray-900 font-mono bg-surface-secondary px-1.5 py-0.5 rounded border border-border-primary"
							>
								{agentStore.address.slice(
									0,
									6,
								)}…{agentStore.address.slice(-4)}
							</span>
						</div>
					</div>
					<p class="text-gray-600">
						Signing session is active. Orders will be signed
						automatically on this device.
					</p>

					<div class="pt-2">
						<button
							class="w-full py-2.5 text-xs font-semibold border-2 border-short/20 text-short rounded-xl hover:bg-short/5 transition-colors"
							onclick={() => agentStore.clear()}
						>
							Disconnect Locally
						</button>
						<p class="text-[10px] text-gray-400 mt-2 text-center">
							To revoke permanently, visit
							<a
								href="https://app.hyperliquid.xyz/API"
								target="_blank"
								rel="noopener noreferrer"
								class="text-accent hover:underline"
								>Hyperliquid API Settings</a
							>
						</p>
					</div>
				{:else}
					<!-- Not yet approved state -->
					<p class="text-gray-700 font-medium">
						Required to place and cancel orders on Hyperfront.
					</p>

					<div class="space-y-3">
						<div class="flex gap-3 items-start">
							<div
								class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5"
							>
								<span class="text-accent text-[10px] font-bold"
									>1</span
								>
							</div>
							<p class="text-gray-600 text-[13px]">
								Limited to <span
									class="text-gray-900 font-semibold"
									>place/cancel orders</span
								> only.
							</p>
						</div>
						<div class="flex gap-3 items-start">
							<div
								class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5"
							>
								<span class="text-accent text-[10px] font-bold"
									>2</span
								>
							</div>
							<p class="text-gray-600 text-[13px]">
								Session persists in this browser until you
								disconnect.
							</p>
						</div>
						<div class="flex gap-3 items-start">
							<div
								class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5"
							>
								<span class="text-accent text-[10px] font-bold"
									>3</span
								>
							</div>
							<p class="text-gray-600 text-[13px]">
								Cannot withdraw or transfer funds.
							</p>
						</div>
						<div class="flex gap-3 items-start">
							<div
								class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5"
							>
								<span class="text-accent text-[10px] font-bold"
									>4</span
								>
							</div>
							<p class="text-gray-600 text-[13px]">
								Manage/Revoke at <a
									href="https://app.hyperliquid.xyz/API"
									target="_blank"
									rel="noopener noreferrer"
									class="text-accent hover:underline"
									>hyperliquid.xyz/API</a
								>
							</p>
						</div>
					</div>

					{#if loading && setupStep}
						<div
							class="rounded-xl bg-accent-dim p-4 flex items-center gap-3 border border-accent/20"
						>
							<div
								class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
							></div>
							<span class="text-accent font-medium text-[13px]"
								>{setupStep}</span
							>
						</div>
					{/if}

					{#if error}
						<div
							class="rounded-xl bg-short-dim border border-short/20 p-4 space-y-1"
						>
							<p class="text-[13px] font-bold text-short">
								Setup failed
							</p>
							<p
								class="text-xs text-short/80 break-all leading-tight"
							>
								{error}
							</p>
						</div>
					{/if}
				{/if}
			</div>

			{#if !agentStore.approved}
				<div class="px-5 pb-5">
					<button
						class="w-full py-3.5 text-sm font-bold bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-[0.98] shadow-lg shadow-accent/20 transition-all disabled:opacity-50 disabled:shadow-none"
						disabled={loading}
						onclick={setup}
					>
						{loading ? "Processing..." : "Set Up Signing Key"}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
