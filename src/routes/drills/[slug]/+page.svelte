<script lang="ts">
	import { page } from '$app/state';
	import { repo } from '$lib/data';
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
	<p class="text-sm text-slate-500">Loading…</p>
{:else if !drill}
	<p class="text-sm text-slate-400">
		Drill not found. <a class="underline" href="/drills">Back to drills</a>
	</p>
{:else}
	<header class="mb-4">
		<a href="/drills" class="text-sm text-slate-400">← Drills</a>
		<h1 class="mt-2 text-2xl font-bold">{drill.name}</h1>
		<p class="mt-1 text-sm text-slate-400">{drill.summary}</p>
		<p class="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
			<span>{SKILL_CATEGORY_LABELS[drill.category]}</span>
			<span aria-hidden="true">·</span>
			<span>{drill.duration_minutes} min</span>
			<span aria-hidden="true">·</span>
			<span>{drill.min_players === 1 ? 'Solo' : `${drill.min_players}+ players`}</span>
		</p>
	</header>

	<section class="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
		<h2 class="mb-1 text-sm font-semibold tracking-wide text-slate-400 uppercase">Setup</h2>
		<p class="text-sm">{drill.setup}</p>
		<p class="mt-2 text-xs text-slate-500">Gear: {drill.equipment.join(', ')}</p>
	</section>

	<section class="mb-4">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">
			Coaching points
		</h2>
		<ul class="space-y-2">
			{#each drill.coaching_points as point (point)}
				<li class="flex gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
					<span class="text-pitch-500" aria-hidden="true">▸</span>
					<span>{point}</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if drill.tracks_reps}
		<a
			href="/log?drill={drill.slug}"
			class="tap-target bg-pitch-600 active:bg-pitch-700 flex items-center justify-center rounded-xl px-4 py-3 font-semibold text-white"
		>
			Log reps{drill.target_reps ? ` — target ${drill.target_reps}` : ''}
		</a>
	{/if}
{/if}
