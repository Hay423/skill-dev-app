<script lang="ts">
	import '../app.css';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { seedDrills } from '$lib/data';

	let { children } = $props();

	// Keeps the bundled drill library in sync with IndexedDB on every boot.
	const ready = seedDrills();
</script>

<div class="mx-auto flex min-h-full max-w-lg flex-col">
	<main class="flex-1 px-4 pt-4 pb-24">
		{#await ready}
			<p class="pt-8 text-center text-sm text-slate-500">Loading…</p>
		{:then}
			{@render children()}
		{:catch error}
			<p class="pt-8 text-center text-sm text-red-400">
				Could not open local storage: {error.message}
			</p>
		{/await}
	</main>
	<BottomNav />
</div>
