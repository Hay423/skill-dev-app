<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { repo, seedDrills } from '$lib/data';

	let { children } = $props();

	// Adds any bundled seed drills not yet in IndexedDB, then sends a player
	// with no profile yet to onboarding before anything else loads.
	const ready = seedDrills().then(async () => {
		if (page.url.pathname !== '/onboarding') {
			const profile = await repo.getProfile();
			if (!profile) await goto('/onboarding');
		}
	});
</script>

<div class="mx-auto flex min-h-full max-w-lg flex-col">
	<main class="flex-1 px-4 pt-4 pb-24">
		{#await ready}
			<p class="pt-8 text-center text-sm text-surface-600-400">Loading…</p>
		{:then}
			{@render children()}
		{:catch error}
			<p class="pt-8 text-center text-sm text-error-500">
				Could not open local storage: {error.message}
			</p>
		{/await}
	</main>
	<BottomNav />
</div>
