<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { repo, seedReferenceData } from '$lib/data';

	let { children } = $props();

	// Adds any bundled seed content not yet in IndexedDB, then sends a player
	// with no profile yet to onboarding before anything else loads.
	const ready = seedReferenceData().then(async () => {
		if (page.url.pathname !== '/onboarding') {
			const profile = await repo.getProfile();
			if (!profile) await goto('/onboarding');
		}
	});
</script>

<div class="mx-auto flex min-h-full max-w-lg flex-col">
	<TopBar />
	<main class="flex-1 px-4 pb-24" style="padding-top: calc(3rem + var(--inset-top) + 1rem)">
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
