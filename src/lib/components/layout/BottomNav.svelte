<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/home/', label: 'Home', icon: 'home' },
		{ href: '/portfolio/', label: 'Portfolio', icon: 'portfolio' },
		{ href: '/market/', label: 'Market', icon: 'market' },
		{ href: '/orders/', label: 'Orders', icon: 'orders' },
		{ href: '/trade/', label: 'Info', icon: 'trade' }
	] as const;

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href);
	}
</script>

<nav class="flex items-center justify-around h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-surface-secondary/95 border-t border-border-secondary shrink-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
	{#each tabs as tab}
		{@const active = isActive(tab.href)}
		<a
			href={tab.href}
			class="relative flex flex-col items-center justify-center gap-0.5 w-full h-full text-xs transition-colors {active ? 'text-accent' : 'text-gray-400 active:text-gray-600'}"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				{#if tab.icon === 'portfolio'}
					<!-- wallet/portfolio icon -->
					<rect x="2" y="6" width="20" height="14" rx="2" />
					<path d="M2 10h20" />
					<path d="M16 14h2" />
				{:else if tab.icon === 'home'}
					<!-- home icon -->
					<path d="M3 10.5L12 3l9 7.5" />
					<path d="M5 9.5V20h14V9.5" />
					<path d="M10 20v-6h4v6" />
				{:else if tab.icon === 'market'}
					<!-- candlestick/chart icon -->
					<path d="M9 4v4M9 16v4M15 4v2M15 14v6" />
					<rect x="7" y="8" width="4" height="8" rx="0.5" />
					<rect x="13" y="6" width="4" height="8" rx="0.5" />
				{:else if tab.icon === 'trade'}
					<!-- swap/trade icon -->
					<path d="M7 10l-3 3 3 3" />
					<path d="M4 13h13" />
					<path d="M17 14l3-3-3-3" />
					<path d="M20 11H7" />
				{:else if tab.icon === 'orders'}
					<!-- list/orders icon -->
					<path d="M8 6h13M8 12h13M8 18h13" />
					<circle cx="4" cy="6" r="1" fill="currentColor" />
					<circle cx="4" cy="12" r="1" fill="currentColor" />
					<circle cx="4" cy="18" r="1" fill="currentColor" />
				{/if}
			</svg>
			<span>{tab.label}</span>
			{#if active}
				<span class="absolute top-1 w-1 h-1 rounded-full bg-accent"></span>
			{/if}
		</a>
	{/each}
</nav>
