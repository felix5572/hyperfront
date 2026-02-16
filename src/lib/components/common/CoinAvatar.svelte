<script lang="ts">
	let {
		symbol,
		size = 24,
		className = ''
	}: {
		symbol: string;
		size?: number;
		className?: string;
	} = $props();

	const OFFICIAL_ICON_MAP: Record<string, string> = {
		BTC: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/btc.png',
		ETH: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/eth.png',
		SOL: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/sol.png',
		USDC: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/usdc.png',
		USDT: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/usdt.png'
	};

	let showFallback = $state(false);

	const normalized = $derived.by(() => {
		const upper = symbol.toUpperCase();
		if (upper.includes('/')) return upper.split('/')[0].trim();
		if (upper.includes(':')) return upper.split(':').at(-1)?.trim() ?? upper;
		return upper;
	});

	const iconUrl = $derived(OFFICIAL_ICON_MAP[normalized] ?? null);

	const initials = $derived.by(() => {
		const core = normalized.replace(/[^A-Z0-9]/g, '');
		if (!core) return '??';
		return core.slice(0, Math.min(4, core.length));
	});

	const bgColor = $derived.by(() => {
		let hash = 0;
		for (let i = 0; i < normalized.length; i += 1) {
			hash = (hash << 5) - hash + normalized.charCodeAt(i);
			hash |= 0;
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue} 60% 88%)`;
	});
</script>

<span
	class="inline-flex items-center justify-center rounded-full overflow-hidden border border-border-secondary shrink-0 {className}"
	style="width: {size}px; height: {size}px;"
>
	{#if iconUrl && !showFallback}
		<img
			src={iconUrl}
			alt={normalized}
			width={size}
			height={size}
			loading="lazy"
			decoding="async"
			onerror={() => showFallback = true}
		/>
	{:else}
		<span
			class="w-full h-full flex items-center justify-center text-[9px] font-semibold text-gray-700 tracking-tight"
			style="background: {bgColor};"
		>{initials}</span>
	{/if}
</span>
