<script lang="ts">
	import DrillFilters from '$lib/components/DrillFilters.svelte';
	import ExcludedDrills from '$lib/components/ExcludedDrills.svelte';
	import { repo } from '$lib/data';
	import { describeDrillFilterReason, filterDrills } from '$lib/domain/drill-filter';
	import { drillTitle } from '$lib/domain/drills';
	import { drillFilter } from '$lib/filters.svelte';
	import {
		SKILL_CATEGORIES,
		SKILL_CATEGORY_LABELS,
		type Drill,
		type SkillCategory
	} from '$lib/types';

	let drills = $state<Drill[]>([]);
	let selected = $state<SkillCategory | 'all'>('all');

	$effect(() => {
		repo.listDrills().then((d) => (drills = d));
	});

	const inCategory = $derived(
		selected === 'all' ? drills : drills.filter((d) => d.category === selected)
	);

	/**
	 * The category chips narrow what the player is browsing; the filter rules
	 * out what they cannot do right now. Category first, so the "not shown" row
	 * counts only within the category on screen — a player looking at kicking
	 * does not need to be told two marking drills need three people.
	 */
	const result = $derived(filterDrills(inCategory, drillFilter.current));

	const excluded = $derived(
		result.excluded.map(({ drill, reason }) => ({
			drill,
			text: describeDrillFilterReason(reason)
		}))
	);

	// Only offer filters for categories the library actually covers.
	const available = $derived(SKILL_CATEGORIES.filter((c) => drills.some((d) => d.category === c)));

	const DIFFICULTY_LABELS = ['', 'Foundation', 'Developing', 'Advanced'];
</script>

<header class="mb-3">
	<h1 class="text-2xl font-bold">Drills</h1>
	<p class="text-sm text-surface-600-400">{result.kept.length} drills</p>
</header>

<DrillFilters {drills} />

<div class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
	<button
		type="button"
		onclick={() => (selected = 'all')}
		class="shrink-0 rounded-full border px-3 py-1.5 text-sm {selected === 'all'
			? 'preset-filled-primary-500'
			: 'preset-outlined-surface-200-800'}"
	>
		All
	</button>
	{#each available as category (category)}
		<button
			type="button"
			onclick={() => (selected = category)}
			class="shrink-0 rounded-full border px-3 py-1.5 text-sm {selected === category
				? 'preset-filled-primary-500'
				: 'preset-outlined-surface-200-800'}"
		>
			{SKILL_CATEGORY_LABELS[category]}
		</button>
	{/each}
</div>

{#if result.kept.length === 0 && result.excluded.length > 0}
	<p
		class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center text-sm text-surface-500"
	>
		Nothing here fits what you have right now. Loosen a filter to open the library back up.
	</p>
{/if}

<ul class="space-y-2">
	{#each result.kept as drill (drill.id)}
		<li>
			<a
				href="/drills/{drill.slug}"
				class="block rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 active:bg-surface-200-800"
			>
				<div class="flex items-start justify-between gap-3">
					<h2 class="font-semibold">{drillTitle(drill)}</h2>
					<span class="shrink-0 text-xs text-surface-500">{drill.duration_minutes} min</span>
				</div>
				<p class="mt-1 text-sm text-surface-600-400">{drill.summary}</p>
				<!-- The player count lives in the name now, so it is not repeated here. -->
				<p class="mt-2 flex gap-2 text-xs text-surface-500">
					<span>{SKILL_CATEGORY_LABELS[drill.category]}</span>
					<span aria-hidden="true">·</span>
					<span>{DIFFICULTY_LABELS[drill.difficulty]}</span>
				</p>
			</a>
		</li>
	{/each}
</ul>

<ExcludedDrills items={excluded} />
