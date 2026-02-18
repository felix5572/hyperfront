<script lang="ts">
	import { formatPrice, formatUsd } from '$utils/format';
	import CoinAvatar from '$components/common/CoinAvatar.svelte';

	let {
		coin,
		href,
		markPx,
		prevDayPx,
		dayNtlVlm,
		funding,
		openInterest,
		maxLeverage,
		currentLeverage,
		pairSuffix = '',
		idLabel = '',
		idLabelOnNewLine = false,
		szDecimals = 0,
		isSpot = false
	}: {
		coin: string;
		href: string;
		markPx: string;
		prevDayPx: string;
		dayNtlVlm: string;
		funding?: string;
		openInterest?: string;
		maxLeverage?: number;
		currentLeverage?: number | null;
		pairSuffix?: string;
		idLabel?: string;
		idLabelOnNewLine?: boolean;
		szDecimals?: number;
		isSpot?: boolean;
	} = $props();

	const mark = $derived(parseFloat(markPx));
	const prev = $derived(parseFloat(prevDayPx));
	const change24h = $derived(prev > 0 ? ((mark - prev) / prev) * 100 : 0);
	const isPositive = $derived(change24h >= 0);
	const volume = $derived(parseFloat(dayNtlVlm));
</script>

<a
	{href}
	class="flex flex-col gap-1 p-3 bg-surface-secondary rounded-lg border border-border-secondary hover:border-border-primary active:bg-surface-hover transition-colors"
>
	<!-- Row 1: name + id, price, change -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 min-w-0">
			<CoinAvatar symbol={coin} size={22} />
			<span class="font-semibold text-sm min-w-0 truncate">
				{coin}
				{#if pairSuffix}<span class="text-gray-400 font-normal">{pairSuffix}</span>{/if}
				{#if idLabel && !idLabelOnNewLine}<span class="text-[10px] text-gray-400 font-mono font-normal ml-1.5">{idLabel}</span>{/if}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-sm tabular-nums font-semibold font-mono tracking-tight text-gray-900">${formatPrice(markPx, szDecimals, isSpot)}</span>
			<span class="text-xs tabular-nums px-1.5 py-0.5 rounded font-medium {isPositive ? 'bg-long-dim text-long' : 'bg-short-dim text-short'}">
				24H: {isPositive ? '+' : ''}{change24h.toFixed(2)}%
			</span>
		</div>
	</div>

	{#if idLabel && idLabelOnNewLine}
		<div class="text-[10px] text-gray-400 font-mono tabular-nums">{idLabel}</div>
	{/if}

	<!-- Row 3: volume, OI, funding -->
	<div class="flex items-center gap-3 text-xs text-gray-500">
		<span>Vol {formatUsd(volume, true)}</span>
		{#if openInterest}
			<span>OI {formatUsd(parseFloat(openInterest) * mark, true)}</span>
		{/if}
		{#if funding}
			{@const fundingPct = (parseFloat(funding) * 100).toFixed(4)}
			<span class="tabular-nums {parseFloat(funding) >= 0 ? 'text-long/70' : 'text-short/70'}">
				FR {fundingPct}%
			</span>
		{/if}
	</div>

	{#if maxLeverage != null}
		<div class="flex items-center gap-3 text-[11px] text-gray-500">
			<span>Max Lev <span class="font-mono">{maxLeverage}x</span></span>
			<span>Your Lev <span class="font-mono">{currentLeverage != null ? `${currentLeverage}x` : '—'}</span></span>
		</div>
	{/if}
</a>
