<script lang="ts">
	import { page } from '$app/state';
	import { repo } from '$lib/data';
	import { drillTitle } from '$lib/domain/drills';
	import { SKILL_CATEGORY_LABELS, type Drill } from '$lib/types';

	let drill = $state<Drill | undefined>(undefined);
	let loading = $state(true);

	$effect(() => {
		const slug = page.params.slug;
		loading = true;
		if (!slug) {
			drill = undefined;
			loading = false;
			return;
		}
		repo
			.getDrillBySlug(slug)
			.then((d) => (drill = d))
			.finally(() => (loading = false));
	});
</script>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if !drill}
	<p class="text-sm text-surface-600-400">
		Drill not found. <a class="underline" href="/drills">Back to drills</a>
	</p>
{:else}
	<header class="mb-4">
		<a href="/drills" class="text-sm text-surface-600-400">← Drills</a>
		<h1 class="mt-2 text-2xl font-bold">{drillTitle(drill)}</h1>
		<p class="mt-1 text-sm text-surface-600-400">{drill.summary}</p>
		<!-- The player count lives in the heading now, so it is not repeated here. -->
		<p class="mt-2 flex flex-wrap gap-2 text-xs text-surface-500">
			<span>{SKILL_CATEGORY_LABELS[drill.category]}</span>
			<span aria-hidden="true">·</span>
			<span>{drill.duration_minutes} min</span>
		</p>
	</header>

	<section class="mb-4 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
		<h2 class="mb-1 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">Setup</h2>
		<p class="text-sm">{drill.setup}</p>
		<p class="mt-2 text-xs text-surface-500">Gear: {drill.equipment.join(', ')}</p>
	</section>

	<section class="mb-4">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Coaching points
		</h2>
		<ul class="space-y-2">
			{#each drill.coaching_points as point (point)}
				<li
					class="flex gap-2 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 text-sm"
				>
					<span class="text-primary-500" aria-hidden="true">▸</span>
					<span>{point}</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if drill.tracks_reps}
		<a
			href="/log?drill={drill.slug}"
			class="tap-target preset-filled-primary-500 flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
		>
			Log reps{drill.target_reps ? ` — target ${drill.target_reps}` : ''}
		</a>
	{/if}
{/if}
