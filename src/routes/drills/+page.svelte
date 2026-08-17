<script lang="ts">
	import { repo } from '$lib/data';
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

	const visible = $derived(
		selected === 'all' ? drills : drills.filter((d) => d.category === selected)
	);

	// Only offer filters for categories the library actually covers.
	const available = $derived(SKILL_CATEGORIES.filter((c) => drills.some((d) => d.category === c)));

	const DIFFICULTY_LABELS = ['', 'Foundation', 'Developing', 'Advanced'];
</script>

<header class="mb-3">
	<h1 class="text-2xl font-bold">Drills</h1>
	<p class="text-sm text-surface-600-400">{visible.length} drills</p>
</header>

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

<ul class="space-y-2">
	{#each visible as drill (drill.id)}
		<li>
			<a
				href="/drills/{drill.slug}"
				class="block rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 active:bg-surface-200-800"
			>
				<div class="flex items-start justify-between gap-3">
					<h2 class="font-semibold">{drill.name}</h2>
					<span class="shrink-0 text-xs text-surface-500">{drill.duration_minutes} min</span>
				</div>
				<p class="mt-1 text-sm text-surface-600-400">{drill.summary}</p>
				<p class="mt-2 flex gap-2 text-xs text-surface-500">
					<span>{SKILL_CATEGORY_LABELS[drill.category]}</span>
					<span aria-hidden="true">·</span>
					<span>{DIFFICULTY_LABELS[drill.difficulty]}</span>
					<span aria-hidden="true">·</span>
					<span>{drill.min_players === 1 ? 'Solo' : `${drill.min_players}+ players`}</span>
				</p>
			</a>
		</li>
	{/each}
</ul>
