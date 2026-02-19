<script lang="ts">
	import { feedbackStore } from '$stores/feedback.svelte';
</script>

{#if feedbackStore.errorTitle !== null}
	<button
		type="button"
		class="fixed inset-0 z-[10000] bg-black/60 cursor-default"
		aria-label="Close error dialog"
		onclick={() => feedbackStore.clearError()}
	></button>
	<div class="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
		<div
			class="pointer-events-auto w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl"
			role="alertdialog"
			aria-modal="true"
			aria-label={feedbackStore.errorTitle}
		>
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
					</svg>
					<span class="text-sm font-semibold text-gray-900">{feedbackStore.errorTitle}</span>
				</div>
				<button
					class="text-gray-400 hover:text-gray-600"
					aria-label="Close"
					onclick={() => feedbackStore.clearError()}
				>
					<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
						<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
					</svg>
				</button>
			</div>
			<div class="px-4 py-3">
				<p class="font-mono text-xs text-gray-700 break-all whitespace-pre-wrap">{feedbackStore.errorDetail}</p>
			</div>
			<div class="px-4 pb-4 flex justify-center">
				<button
					class="px-6 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
					onclick={() => feedbackStore.clearError()}
				>Close</button>
			</div>
		</div>
	</div>
{/if}
