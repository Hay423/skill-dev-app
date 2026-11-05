<script lang="ts">
	import { repo } from '$lib/data';
	import DrillFilters from './DrillFilters.svelte';
	import ExcludedDrills from './ExcludedDrills.svelte';
	import { isFilterSet } from '$lib/domain/drill-filter';
	import { drillTitle } from '$lib/domain/drills';
	import { drillLimitFor } from '$lib/domain/load-policy';
	import {
		describeDrillExclusion,
		priorityCategories,
		recommendDrills,
		type RecommendationContext
	} from '$lib/domain/recommend';
	import { drillFilter } from '$lib/filters.svelte';
	import {
		POSITION_LABELS,
		SKILL_CATEGORY_LABELS,
		type Drill,
		type PlayerProfile,
		type PositionProfile
	} from '$lib/types';
	import { localDate } from '$lib/util/time';

	interface Props {
		/**
		 * How many drills to show. Left unset, it follows the player: three fits
		 * above the fold on a 390px screen, and masters get fewer — see
		 * `drillLimitFor` in `domain/load-policy.ts`.
		 */
		limit?: number;
	}

	let { limit }: Props = $props();

	let profile = $state<PlayerProfile | undefined>(undefined);
	let positions = $state<PositionProfile[]>([]);
	let drills = $state<Drill[]>([]);
	let loading = $state(true);

	$effect(() => {
		Promise.all([repo.getProfile(), repo.listPositions(), repo.listDrills()])
			.then(([p, pos, d]) => {
				profile = p;
				positions = pos;
				drills = d;
			})
			.finally(() => (loading = false));
	});

	const context = $derived<RecommendationContext | null>(
		profile ? { profile, positions, today: localDate(), filter: drillFilter.current } : null
	);

	const shown = $derived(limit ?? drillLimitFor(profile));

	const result = $derived(
		context ? recommendDrills(drills, context, shown) : { recommended: [], excluded: [] }
	);

	const focus = $derived(
		context
			? priorityCategories(context)
					.map((c) => SKILL_CATEGORY_LABELS[c].toLowerCase())
					.join(', ')
			: ''
	);

	const excluded = $derived(
		result.excluded.map(({ drill, reason }) => ({
			drill,
			text: describeDrillExclusion(reason)
		}))
	);
</script>

<!--
	Rendered whenever there is anything to say — including the case where every
	drill was excluded. A section that hides itself there is the exact failure
	the exclusions are meant to prevent: an empty library that explains nothing.
-->
{#if !loading && profile && (result.recommended.length > 0 || result.excluded.length > 0)}
	<section class="mt-6">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
				Recommended for you
			</h2>
			<a href="/drills" class="shrink-0 text-xs font-medium text-primary-500">All drills</a>
		</div>

		<p class="mb-2 text-xs text-surface-500">
			{POSITION_LABELS[profile.primary_position]}{#if profile.secondary_position}
				&nbsp;/ {POSITION_LABELS[profile.secondary_position].toLowerCase()}{/if}{#if focus}
				&nbsp;· {focus}{/if}
		</p>

		<DrillFilters {drills} />

		{#if result.recommended.length === 0}
			<p
				class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center text-sm text-surface-500"
			>
				{#if isFilterSet(drillFilter.current)}
					Nothing fits what you have right now. Loosen a filter above, or check what you can train
					with in your profile.
				{:else}
					Every drill needs gear you have not listed. Add what you can train with in your profile to
					open the library up.
				{/if}
			</p>
		{/if}

		<ul class="space-y-2">
			{#each result.recommended as { drill, reason } (drill.id)}
				<li>
					<a
						href="/drills/{drill.slug}"
						class="tap-target block rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 active:bg-surface-200-800"
					>
						<div class="flex items-start justify-between gap-3">
							<h3 class="font-semibold">{drillTitle(drill)}</h3>
							<span class="shrink-0 text-xs text-surface-500">{drill.duration_minutes} min</span>
						</div>
						<p class="mt-1 text-sm text-surface-600-400">{drill.summary}</p>
						{#if reason}
							<p class="mt-2 inline-block rounded-full preset-tonal-primary px-2 py-0.5 text-xs">
								{reason}
							</p>
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		<ExcludedDrills items={excluded} />
	</section>
{/if}
