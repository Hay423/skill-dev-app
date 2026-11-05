<script lang="ts">
	import '../app.css';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { swipeTabs } from '$lib/actions/swipe-tabs';
	import { tabSlideDirection } from '$lib/nav';
	import { repo, seedReferenceData } from '$lib/data';

	let { children } = $props();

	// Slides the page sideways when moving between tabs, whether the move came
	// from a swipe or a tap on the bar. The browser does the animating: holding
	// both pages on screen at once from Svelte would mean taking the outgoing one
	// out of flow, and an absolutely positioned page mid-navigation is how scroll
	// position and measured heights go wrong.
	//
	// Anything the browser can't or shouldn't animate — no View Transitions
	// support, a player who asked for less motion — falls through to the instant
	// navigation we had before, which is a plain loss of polish and nothing worse.
	onNavigate((navigation) => {
		const direction = tabSlideDirection(navigation.from?.url.pathname, navigation.to?.url.pathname);
		if (!direction) return;
		if (typeof document.startViewTransition !== 'function') return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		document.documentElement.dataset.tabSlide = direction;
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			// Clear the direction once the animation is done and not a frame before,
			// or the keyframes it selects vanish mid-slide. `finally`, so a rejected
			// transition can't leave the attribute behind to steer the next one.
			transition.finished.finally(() => {
				delete document.documentElement.dataset.tabSlide;
			});
		});
	});

	// Adds any bundled seed content not yet in IndexedDB, then sends a player
	// with no profile yet to onboarding before anything else loads.
	const ready = seedReferenceData().then(async () => {
		if (page.url.pathname !== '/onboarding') {
			const profile = await repo.getProfile();
			if (!profile) await goto('/onboarding');
		}
	});
</script>

<!--
	`min-h-dvh`, not `min-h-full`. `min-height: 100%` chains up through body and
	html to the initial containing block, and in an installed iOS PWA that block is
	shorter than the screen by the bottom safe area — which left the bottom bar
	floating above the home indicator on every page short enough not to scroll.
	`dvh` measures the viewport actually on screen, so the column is the screen.
-->
<div class="mx-auto flex min-h-dvh max-w-lg flex-col">
	<TopBar />
	<!--
		Horizontal swipes walk the bottom bar's tabs, so the whole row is reachable
		without the thumb leaving the middle of the screen.
	-->
	<main
		use:swipeTabs={() => page.url.pathname}
		class="flex-1 px-4 pb-6"
		style="padding-top: calc(3rem + var(--inset-top) + 1rem)"
	>
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
