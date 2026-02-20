<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { truncateAddress } from '$utils/format';

	let { variant = 'default' }: { variant?: 'default' | 'large' } = $props();
</script>

{#if walletStore.isConnected && walletStore.address}
	<button
		class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-surface-tertiary rounded-lg border border-border-primary hover:border-accent transition-colors"
		onclick={() => walletStore.modalOpen = true}
	>
		<span class="w-2 h-2 rounded-full bg-long"></span>
		{truncateAddress(walletStore.address)}
	</button>
{:else}
	<button
		class={variant === 'large'
			? 'w-full min-h-[48px] py-4 text-base font-semibold bg-accent text-white rounded-xl border-2 border-accent shadow-md hover:bg-accent/90 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50'
			: 'px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent rounded-lg border border-accent/30 hover:bg-accent/30 transition-colors disabled:opacity-50'}
		onclick={() => walletStore.modalOpen = true}
		disabled={walletStore.status === 'connecting'}
	>
		{walletStore.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
	</button>
{/if}
