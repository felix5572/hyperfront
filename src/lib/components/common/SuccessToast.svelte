<script lang="ts">
	import { feedbackStore } from '$stores/feedback.svelte';
	import { fly } from 'svelte/transition';
</script>

<div class="fixed top-16 right-3 z-[9998] flex flex-col gap-2 pointer-events-none">
	{#each feedbackStore.toasts as toast (toast.id)}
		<div
			transition:fly={{ x: 60, duration: 220 }}
			class="pointer-events-auto flex items-center gap-2 rounded bg-white border border-gray-200 border-l-4 border-l-green-500 shadow-md px-3 py-2.5 min-w-[180px] max-w-xs"
		>
			<svg class="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clip-rule="evenodd" />
			</svg>
			<span class="text-xs text-gray-800">{toast.message}</span>
		</div>
	{/each}
</div>
