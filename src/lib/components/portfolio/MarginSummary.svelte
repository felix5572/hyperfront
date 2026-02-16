<script lang="ts">
	import { accountStore } from '$stores/account.svelte';
	import { formatUsd, formatPct } from '$utils/format';

	const margin = $derived(accountStore.marginSummary);

	const accountValue = $derived(margin ? parseFloat(margin.accountValue) : 0);
	const totalMarginUsed = $derived(margin ? parseFloat(margin.totalMarginUsed) : 0);
	const totalNtlPos = $derived(margin ? parseFloat(margin.totalNtlPos) : 0);
	const withdrawable = $derived(parseFloat(accountStore.withdrawable));
	const marginRatio = $derived(accountValue > 0 ? totalMarginUsed / accountValue : 0);
</script>

<div class="p-4 space-y-4">
	<!-- Account Value -->
	<div>
		<p class="text-xs text-gray-500 uppercase tracking-wide">Account Value</p>
		<p class="text-2xl font-bold tabular-nums">{formatUsd(accountValue)}</p>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 gap-3">
		<div class="p-3 bg-surface-tertiary rounded-lg">
			<p class="text-xs text-gray-500">Total Position</p>
			<p class="text-sm font-medium tabular-nums">{formatUsd(totalNtlPos, true)}</p>
		</div>
		<div class="p-3 bg-surface-tertiary rounded-lg">
			<p class="text-xs text-gray-500">Margin Used</p>
			<p class="text-sm font-medium tabular-nums">{formatUsd(totalMarginUsed)}</p>
		</div>
		<div class="p-3 bg-surface-tertiary rounded-lg">
			<p class="text-xs text-gray-500">Available</p>
			<p class="text-sm font-medium tabular-nums text-long">{formatUsd(withdrawable)}</p>
		</div>
		<div class="p-3 bg-surface-tertiary rounded-lg">
			<p class="text-xs text-gray-500">Margin Ratio</p>
			<p class="text-sm font-medium tabular-nums">{formatPct(marginRatio)}</p>
		</div>
	</div>
</div>
