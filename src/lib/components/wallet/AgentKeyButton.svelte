<script lang="ts">
	import { agentStore } from '$stores/agent.svelte';
</script>

<button
	class="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border-primary text-gray-600 bg-surface-tertiary hover:bg-surface-hover transition-colors"
	onclick={() => { agentStore.modalOpen = true; }}
	title="Agent Wallet"
>
	<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
	</svg>
	Agent Wallet
</button>
