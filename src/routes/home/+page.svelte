<svelte:head>
	<title>Home | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(56,189,248,0.08),transparent_60%),radial-gradient(80%_120%_at_100%_0%,rgba(16,185,129,0.08),transparent_60%)]">
	<div class="p-4 rounded-2xl border border-border-secondary bg-surface-secondary shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
		<p class="text-[11px] uppercase tracking-[0.14em] text-gray-500">Hyperfront</p>
		<h2 class="text-lg font-semibold tracking-tight mt-0.5">Quick Access Home</h2>
		<p class="text-xs text-gray-500 mt-1">Pinned links, tracked wallets, and account action placeholders.</p>
	</div>

	<div class="p-4 rounded-2xl border border-border-secondary bg-gradient-to-br from-surface-secondary to-surface-tertiary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Funding Actions</h3>
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

	<div class="p-4 rounded-2xl border border-border-secondary bg-surface-secondary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Popular Wallets</h3>
		<div class="space-y-2 text-xs">
			<a href="/portfolio/?address=0x5078c2fbea2b2ad61bc840bc023e35fce56bedb6" class="block p-3 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">JamesWynnReal</p>
				<p class="font-mono break-all mt-0.5">0x5078c2fbea2b2ad61bc840bc023e35fce56bedb6</p>
				<p class="text-gray-500 mt-1">Reason: community watchlist address, quick portfolio lookup.</p>
			</a>
			<a href="/portfolio/?address=0xefd3ab65915e35105caa462442c9ecc1346728df" class="block p-3 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">cbb</p>
				<p class="font-mono break-all mt-0.5">0xefd3ab65915e35105caa462442c9ecc1346728df</p>
				<p class="text-gray-500 mt-1">Reason: useful reference wallet for position and flow checks.</p>
			</a>
			<a href="/portfolio/?address=0xcb58b8f5ec6d47985f0728465c25a08ef9ad2c7b" class="block p-3 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">CL207</p>
				<p class="font-mono break-all mt-0.5">0xcb58b8f5ec6d47985f0728465c25a08ef9ad2c7b</p>
				<p class="text-gray-500 mt-1">Reason: another tracked wallet for quick market context.</p>
			</a>
		</div>
	</div>

	<div class="p-4 rounded-2xl border border-border-secondary bg-surface-secondary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Hyperliquid Links</h3>
		<div class="grid grid-cols-1 gap-2 text-xs">
			<a href="https://app.hyperliquid.xyz/" target="_blank" rel="noreferrer" class="block p-3 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">Mainnet App</p>
				<p class="font-mono break-all mt-0.5 text-gray-500">https://app.hyperliquid.xyz/</p>
			</a>
			<a href="https://hyperliquid.gitbook.io/hyperliquid-docs" target="_blank" rel="noreferrer" class="block p-3 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">Hyperliquid Docs</p>
				<p class="font-mono break-all mt-0.5 text-gray-500">https://hyperliquid.gitbook.io/hyperliquid-docs</p>
			</a>
			<a href="https://github.com/hyperliquid-dex" target="_blank" rel="noreferrer" class="block p-3 rounded-xl border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-semibold">Official GitHub</p>
				<p class="font-mono break-all mt-0.5 text-gray-500">https://github.com/hyperliquid-dex</p>
			</a>
		</div>
		<div class="mt-2 p-2 rounded-lg border border-dashed border-border-primary text-xs text-gray-500 font-mono">
			Hyperfront GitHub (placeholder): https://github.com/your-org/hyperfront
		</div>
	</div>
</div>
