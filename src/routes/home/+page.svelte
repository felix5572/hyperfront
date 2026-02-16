<svelte:head>
	<title>Home | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full overflow-y-auto p-4 space-y-3">
	<div class="p-4 rounded-xl border border-border-secondary bg-surface-secondary space-y-2">
		<h2 class="text-base font-semibold">Home</h2>
		<p class="text-xs text-gray-500 leading-relaxed">
			Hyperfront does not collect or store your wallet private key. Wallet interaction is signature-based and only required when placing/canceling orders or executing other account actions.
		</p>
		<div class="space-y-2">
			<input
				type="text"
				placeholder="Search market / coin / wallet / tx..."
				class="w-full px-4 py-3 text-sm rounded-lg border border-border-primary bg-surface-tertiary focus:outline-none focus:border-accent"
			/>
			<input
				type="text"
				placeholder="Ask AI (coming soon): XMR 是什么？黄金怎么配置？"
				class="w-full px-4 py-3 text-sm rounded-lg border border-border-primary bg-surface-tertiary focus:outline-none focus:border-accent"
			/>
		</div>
	</div>

	<div class="p-3 rounded-lg border border-border-secondary bg-surface-secondary">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Hyperliquid Links</h3>
		<div class="grid grid-cols-2 gap-2">
			<a href="https://app.hyperliquid.xyz/" target="_blank" rel="noreferrer" class="px-3 py-2 rounded border border-border-primary text-sm hover:bg-surface-hover">Mainnet App</a>
			<a href="https://app.hyperliquid-testnet.xyz/" target="_blank" rel="noreferrer" class="px-3 py-2 rounded border border-border-primary text-sm hover:bg-surface-hover">Testnet App</a>
			<a href="https://hyperliquid.gitbook.io/hyperliquid-docs" target="_blank" rel="noreferrer" class="px-3 py-2 rounded border border-border-primary text-sm hover:bg-surface-hover">Docs</a>
			<a href="https://github.com/hyperliquid-dex" target="_blank" rel="noreferrer" class="px-3 py-2 rounded border border-border-primary text-sm hover:bg-surface-hover">Official GitHub</a>
		</div>
		<div class="mt-2 p-2 rounded border border-dashed border-border-primary text-xs text-gray-500 font-mono">
			Hyperfront GitHub (placeholder): https://github.com/your-org/hyperfront
		</div>
	</div>

	<div class="p-3 rounded-lg border border-border-secondary bg-surface-secondary">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Funding Actions</h3>
		<div class="grid grid-cols-2 gap-2">
			<button class="px-3 py-2.5 rounded border border-long text-long bg-long-dim/40 text-sm font-medium">
				Deposit
			</button>
			<button class="px-3 py-2.5 rounded border border-short text-short bg-short-dim/40 text-sm font-medium">
				Withdraw
			</button>
		</div>
	</div>

	<div class="p-3 rounded-lg border border-border-secondary bg-surface-secondary">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Popular Wallets</h3>
		<div class="space-y-2 text-xs">
			<a href="/portfolio/?address=0x1111111111111111111111111111111111111111" class="block p-2 rounded border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-mono break-all">0x1111111111111111111111111111111111111111</p>
				<p class="text-gray-500 mt-1">Reason: 示例地址，方便快速演示和对比 UI 状态。</p>
			</a>
			<a href="/portfolio/?address=0x2222222222222222222222222222222222222222" class="block p-2 rounded border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-mono break-all">0x2222222222222222222222222222222222222222</p>
				<p class="text-gray-500 mt-1">Reason: 常用测试地址占位，减少手动输入成本。</p>
			</a>
			<a href="/portfolio/?address=0x3333333333333333333333333333333333333333" class="block p-2 rounded border border-border-primary bg-surface-tertiary hover:bg-surface-hover transition-colors">
				<p class="font-mono break-all">0x3333333333333333333333333333333333333333</p>
				<p class="text-gray-500 mt-1">Reason: 新用户可先点开看看页面结构与仓位字段。</p>
			</a>
		</div>
	</div>

	<div class="p-3 rounded-lg border border-border-secondary bg-surface-secondary">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">News</h3>
		<div class="space-y-2 text-xs">
			<div class="p-2 rounded border border-border-primary bg-surface-tertiary">
				<p class="font-medium">Protocol update placeholder</p>
				<p class="text-gray-500 mt-0.5">Waiting for feed integration...</p>
			</div>
			<div class="p-2 rounded border border-border-primary bg-surface-tertiary">
				<p class="font-medium">Market digest placeholder</p>
				<p class="text-gray-500 mt-0.5">Will aggregate selected crypto macro links.</p>
			</div>
		</div>
	</div>
</div>
