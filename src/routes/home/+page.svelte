<script lang="ts">
	let walletsExpanded = $state(false);
</script>

<svelte:head>
	<title>Home | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full overflow-y-auto p-3 space-y-3 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(56,189,248,0.08),transparent_60%),radial-gradient(80%_120%_at_100%_0%,rgba(16,185,129,0.08),transparent_60%)]">
	<div class="p-3.5 rounded-2xl border border-border-secondary bg-surface-secondary shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
		<div class="flex items-center gap-2">
			<span class="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 10.5L12 3l9 7.5" />
					<path d="M5 9.5V20h14V9.5" />
					<path d="M10 20v-6h4v6" />
				</svg>
			</span>
			<div>
				<p class="text-[11px] uppercase tracking-[0.14em] text-gray-500">Hyperfront</p>
				<h2 class="text-base font-semibold tracking-tight mt-0.5">Quick Access Home</h2>
			</div>
		</div>
		<p class="text-xs text-gray-500 mt-1">Pinned links, tracked wallets, and account action placeholders.</p>
	</div>

	<div class="p-3.5 rounded-2xl border border-border-secondary bg-gradient-to-br from-surface-secondary to-surface-tertiary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<div class="flex items-center gap-1.5 mb-2">
			<svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="2" y="6" width="20" height="14" rx="2" />
				<path d="M2 10h20" />
			</svg>
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Funding Actions</h3>
		</div>
		<p class="text-xs text-gray-500 leading-relaxed mb-3">
			Hyperfront does not collect or store your wallet private key. Wallet interaction is signature-based and only required when placing/canceling orders or executing other account actions.
		</p>
		<div class="grid grid-cols-2 gap-2">
			<button disabled class="px-3 py-2.5 rounded-lg border border-gray-300 text-gray-400 bg-gray-100 text-sm font-semibold cursor-not-allowed">
				Deposit
			</button>
			<button disabled class="px-3 py-2.5 rounded-lg border border-gray-300 text-gray-400 bg-gray-100 text-sm font-semibold cursor-not-allowed">
				Withdraw
			</button>
		</div>
		<p class="text-[11px] text-gray-500 mt-2">Feature placeholder: funding actions are temporarily disabled.</p>
	</div>

	<div class="p-3.5 rounded-2xl border border-border-secondary bg-surface-secondary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<div class="flex items-center gap-1.5 mb-2">
			<svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10 5" />
				<path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L14 19" />
			</svg>
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Useful Links</h3>
		</div>
		<div class="grid grid-cols-1 gap-1.5 text-xs">
			<a href="https://app.hyperliquid.xyz/" target="_blank" rel="noreferrer" class="block p-2.5 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">Mainnet App <span class="text-[10px] text-gray-500">(Official)</span></p>
				<p class="font-mono break-all mt-0.5 text-gray-500">https://app.hyperliquid.xyz/</p>
			</a>
			<a href="https://hyperliquid.gitbook.io/hyperliquid-docs" target="_blank" rel="noreferrer" class="block p-2.5 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">Hyperliquid Docs <span class="text-[10px] text-gray-500">(Official)</span></p>
				<p class="font-mono break-all mt-0.5 text-gray-500">https://hyperliquid.gitbook.io/hyperliquid-docs</p>
			</a>
			<a href="https://github.com/hyperliquid-dex" target="_blank" rel="noreferrer" class="block p-2.5 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">Official GitHub <span class="text-[10px] text-gray-500">(Official)</span></p>
				<p class="font-mono break-all mt-0.5 text-gray-500">https://github.com/hyperliquid-dex</p>
			</a>
		</div>
	</div>

	<div class="p-3.5 rounded-2xl border border-border-secondary bg-gradient-to-r from-sky-50 to-cyan-50 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<div class="flex items-center gap-1.5 mb-2">
			<svg class="w-4 h-4 text-sky-700" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.2.8-.6v-2.1c-3.3.7-4-1.5-4-1.5-.6-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6A4.7 4.7 0 0 1 6.6 8c-.1-.3-.5-1.5.1-3 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.9 4.7 19 5 19 5a4.7 4.7 0 0 1 .1 3 4.7 4.7 0 0 1 1.2 3.3c0 4.7-2.9 5.7-5.6 6 .4.3.9 1 .9 2v3c0 .4.2.7.8.6A12 12 0 0 0 12 .5Z" />
			</svg>
			<h3 class="text-xs font-semibold uppercase tracking-wide text-sky-800">Hyperfront Project</h3>
		</div>
		<a href="https://github.com/felix5572/hyperfront" target="_blank" rel="noreferrer" class="block p-2.5 rounded-xl border border-sky-200 bg-white/80 hover:bg-white transition-colors text-xs">
			<p class="font-semibold text-sky-900">GitHub Repository (Community)</p>
			<p class="font-mono break-all mt-0.5 text-sky-700">https://github.com/felix5572/hyperfront</p>
		</a>
		<div class="mt-2 p-2 rounded-lg border border-sky-200 bg-white/70 text-[11px] text-sky-900">
			This repository is a community project and is not an official Hyperliquid property.
		</div>
	</div>

	<div class="p-3.5 rounded-2xl border border-border-secondary bg-surface-secondary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<button
			class="w-full flex items-center justify-between text-left"
			onclick={() => walletsExpanded = !walletsExpanded}
			aria-expanded={walletsExpanded}
		>
			<div class="flex items-center gap-1.5">
				<svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="2" y="6" width="20" height="14" rx="2" />
					<path d="M2 10h20" />
					<path d="M16 14h2" />
				</svg>
				<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Popular Wallets</h3>
				<span class="text-[10px] text-gray-400">(3)</span>
			</div>
			<svg class="w-4 h-4 text-gray-500 transition-transform {walletsExpanded ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M6 9l6 6 6-6" />
			</svg>
		</button>
		{#if walletsExpanded}
			<div class="space-y-1.5 text-xs mt-2">
				<a href="/portfolio/?address=0x5078c2fbea2b2ad61bc840bc023e35fce56bedb6" class="block p-2.5 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
					<p class="font-semibold">JamesWynnReal</p>
					<p class="font-mono break-all mt-0.5">0x5078c2fbea2b2ad61bc840bc023e35fce56bedb6</p>
					<p class="text-gray-500 mt-1">Reason: community watchlist address, quick portfolio lookup.</p>
				</a>
				<a href="/portfolio/?address=0xefd3ab65915e35105caa462442c9ecc1346728df" class="block p-2.5 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
					<p class="font-semibold">cbb</p>
					<p class="font-mono break-all mt-0.5">0xefd3ab65915e35105caa462442c9ecc1346728df</p>
					<p class="text-gray-500 mt-1">Reason: useful reference wallet for position and flow checks.</p>
				</a>
				<a href="/portfolio/?address=0xcb58b8f5ec6d47985f0728465c25a08ef9ad2c7b" class="block p-2.5 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
					<p class="font-semibold">CL207</p>
					<p class="font-mono break-all mt-0.5">0xcb58b8f5ec6d47985f0728465c25a08ef9ad2c7b</p>
					<p class="text-gray-500 mt-1">Reason: another tracked wallet for quick market context.</p>
				</a>
			</div>
		{:else}
			<p class="text-[11px] text-gray-500 mt-2">Tap to expand tracked wallet shortcuts.</p>
		{/if}
	</div>
</div>
