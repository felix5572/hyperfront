<script lang="ts">
	import ConnectButton from '$components/wallet/ConnectButton.svelte';
	import AgentKeyButton from '$components/wallet/AgentKeyButton.svelte';
	import { walletStore } from '$stores/wallet.svelte';
</script>

<header class="flex items-center justify-between px-4 h-12 bg-surface-secondary/95 border-b border-border-secondary shrink-0 backdrop-blur-sm">
	<div class="flex items-center gap-2.5 min-w-0">
		<span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent text-white text-xs font-bold shadow-sm">HF</span>
		<div class="flex items-center gap-1.5 min-w-0">
			<span class="text-sm font-semibold text-gray-700 truncate">Hyperfront</span>
			<span class="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">Beta</span>
		</div>
	</div>
	<div class="flex items-center gap-2">
		{#if walletStore.isConnected}
			<AgentKeyButton />
		{/if}
		<ConnectButton />
	</div>
</header>
