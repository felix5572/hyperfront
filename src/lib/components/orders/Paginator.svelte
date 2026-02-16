<script lang="ts">
	interface Props {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		pageSize: number;
		onPageChange: (page: number) => void;
	}
	let { currentPage, totalPages, totalItems, pageSize, onPageChange }: Props = $props();

	const start = $derived((currentPage - 1) * pageSize + 1);
	const end = $derived(Math.min(currentPage * pageSize, totalItems));
	const hasPrev = $derived(currentPage > 1);
	const hasNext = $derived(currentPage < totalPages);
</script>

{#if totalPages <= 1}
	<!-- No paginator when single page -->
{:else}
	<div class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600 border-t border-border-secondary bg-surface-secondary/50">
		<span class="tabular-nums">
			{start}–{end} of {totalItems}
		</span>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="px-2 py-1 rounded border border-border-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none"
				disabled={!hasPrev}
				onclick={() => onPageChange(currentPage - 1)}
			>
				Prev
			</button>
			<span class="px-2 tabular-nums font-medium">
				Page {currentPage} of {totalPages}
			</span>
			<button
				type="button"
				class="px-2 py-1 rounded border border-border-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none"
				disabled={!hasNext}
				onclick={() => onPageChange(currentPage + 1)}
			>
				Next
			</button>
		</div>
	</div>
{/if}
