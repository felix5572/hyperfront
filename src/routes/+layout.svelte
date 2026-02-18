<script lang="ts">
	import '../app.css';
	import Header from '$components/layout/Header.svelte';
	import BottomNav from '$components/layout/BottomNav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Hyperfront</title>
</svelte:head>

<div class="flex flex-col h-dvh overflow-hidden bg-surface-primary">
	<Header />
	<main class="flex-1 min-h-0 overflow-y-auto">
		{@render children()}
	</main>
	<BottomNav />
</div>
