<script lang="ts">
	import { walletStore } from '$stores/wallet.svelte';
	import { accountStore } from '$stores/account.svelte';
	import { ordersStore } from '$stores/orders.svelte';
	import { pushAddressHistory } from '$utils/addressHistory';
	import AddressInput from '$components/portfolio/AddressInput.svelte';
	import OpenOrders from '$components/orders/OpenOrders.svelte';
	import FillHistory from '$components/orders/FillHistory.svelte';
	import OrderHistory from '$components/orders/OrderHistory.svelte';

	let activeTab: 'open' | 'fills' | 'history' = $state('open');

	// When landing on Orders with an address already set (e.g. from Portfolio), subscribe so we get real-time
	$effect(() => {
		const addr = accountStore.viewAddress;
		if (addr && addr !== ordersStore.viewAddress) ordersStore.subscribeOrders(addr);
	});

	function loadMyOrders() {
		const addr = walletStore.address;
		if (!addr) return;
		pushAddressHistory(addr);
		accountStore.loadAddress(addr);
		ordersStore.subscribeOrders(addr);
	}
</script>

<svelte:head>
	<title>Orders | Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-full">
	<div class="border-b border-border-secondary">
		<AddressInput
			currentViewAddress={accountStore.viewAddress}
			onView={(addr) => {
				accountStore.loadAddress(addr);
				ordersStore.subscribeOrders(addr);
			}}
			loading={accountStore.loading || ordersStore.loading}
		/>
	</div>

	{#if accountStore.viewAddress || ordersStore.viewAddress || ordersStore.openOrders.length > 0 || ordersStore.fills.length > 0 || ordersStore.historicalOrders.length > 0}
		<!-- Tabs -->
		<div class="flex border-b border-border-secondary">
			<button
				class="flex-1 py-2.5 text-xs font-medium text-center transition-colors {activeTab === 'open' ? 'text-accent border-b-2 border-accent' : 'text-gray-500'}"
				onclick={() => activeTab = 'open'}
			>
				Open ({ordersStore.openOrders.length})
			</button>
			<button
				class="flex-1 py-2.5 text-xs font-medium text-center transition-colors {activeTab === 'fills' ? 'text-accent border-b-2 border-accent' : 'text-gray-500'}"
				onclick={() => activeTab = 'fills'}
			>
				Fills ({ordersStore.fills.length})
			</button>
			<button
				class="flex-1 py-2.5 text-xs font-medium text-center transition-colors {activeTab === 'history' ? 'text-accent border-b-2 border-accent' : 'text-gray-500'}"
				onclick={() => activeTab = 'history'}
			>
				History ({ordersStore.historicalOrders.length})
			</button>
		</div>

		<!-- Tab content -->
		<div class="flex-1 overflow-y-auto">
			{#if activeTab === 'open'}
				<OpenOrders />
			{:else if activeTab === 'fills'}
				<FillHistory />
			{:else}
				<OrderHistory />
			{/if}
		</div>
	{:else}
		<div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
			<p class="text-sm text-gray-500">Enter an address above and click View to see open orders and fill history.</p>
			{#if walletStore.isConnected}
				<button
					class="mt-4 px-4 py-2 text-xs bg-surface-tertiary rounded-lg border border-border-primary hover:border-accent text-accent"
					onclick={loadMyOrders}
				>
					Load my orders
				</button>
			{/if}
		</div>
	{/if}
</div>
