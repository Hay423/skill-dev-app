<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { repo } from '$lib/data';
	import AffirmationCard from '$lib/components/AffirmationCard.svelte';
	import { loadAffirmation } from '$lib/affirm';
	import type { Affirmation } from '$lib/domain/affirmations';
	import { drillTitle } from '$lib/domain/drills';
	import { formatAccuracy } from '$lib/domain/stats';
	import {
		SKILL_CATEGORIES,
		SKILL_CATEGORY_LABELS,
		type Drill,
		type Foot,
		type SkillCategory
	} from '$lib/types';

	let drills = $state<Drill[]>([]);
	let drillId = $state<string>('');
	let category = $state<SkillCategory>('kicking');
	let foot = $state<Foot | ''>('');
	let attempts = $state(0);
	let successes = $state(0);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let shown = $state<Affirmation | null>(null);

	$effect(() => {
		repo.listDrills().then((all) => {
			drills = all.filter((d) => d.tracks_reps);

			// Deep link from a drill page: /log?drill=<slug>
			const slug = page.url.searchParams.get('drill');
			if (slug) {
				const match = drills.find((d) => d.slug === slug);
				if (match) {
					drillId = match.id;
					category = match.category;
				}
			}
		});
	});

	const selectedDrill = $derived(drills.find((d) => d.id === drillId));
	const accuracy = $derived(attempts === 0 ? null : successes / attempts);
	const target = $derived(selectedDrill?.target_reps ?? null);

	// Picking a drill implies its category, so the two never disagree.
	function onDrillChange(id: string) {
		drillId = id;
		const match = drills.find((d) => d.id === id);
		if (match) category = match.category;
	}

	function hit() {
		attempts += 1;
		successes += 1;
	}

	function miss() {
		attempts += 1;
	}

	function undo() {
		if (attempts === 0) return;
		// Removing a hit must not leave successes above attempts.
		if (successes === attempts) successes -= 1;
		attempts -= 1;
	}

	function reset() {
		attempts = 0;
		successes = 0;
	}

	async function save() {
		if (attempts === 0) return;
		saving = true;
		error = null;
		try {
			await repo.logReps({
				category,
				attempts,
				successes,
				drill_id: drillId || null,
				foot: foot || null
			});
			// Stays on the page rather than redirecting home — the affirmation is
			// shown inline where the work just happened, and a player mid-session
			// often has another set to log straight away.
			shown = await loadAffirmation({
				kind: 'reps',
				category,
				attempts,
				successes,
				foot: foot || null
			});
			reset();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save';
		} finally {
			saving = false;
		}
	}
</script>

<header class="mb-4">
	<h1 class="text-2xl font-bold">Log reps</h1>
	<p class="text-sm text-surface-600-400">Tap as you go — it saves offline.</p>
</header>

<div class="space-y-3">
	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Drill</span>
		<select
			value={drillId}
			onchange={(e) => onDrillChange(e.currentTarget.value)}
			class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		>
			<option value="">Freeform (no drill)</option>
			{#each drills as drill (drill.id)}
				<option value={drill.id}>{drillTitle(drill)}</option>
			{/each}
		</select>
	</label>

	{#if !drillId}
		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Skill</span>
			<select
				bind:value={category}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			>
				{#each SKILL_CATEGORIES as c (c)}
					<option value={c}>{SKILL_CATEGORY_LABELS[c]}</option>
				{/each}
			</select>
		</label>
	{/if}

	<div>
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Foot</span>
		<div class="mt-1 flex gap-2">
			{#each [['', 'N/A'], ['left', 'Left'], ['right', 'Right'], ['both', 'Both']] as [value, label] (value)}
				<button
					type="button"
					onclick={() => (foot = value as Foot | '')}
					class="tap-target flex-1 rounded-xl border px-2 text-sm {foot === value
						? 'preset-filled-primary-500'
						: 'preset-outlined-surface-200-800'}"
				>
					{label}
				</button>
			{/each}
		</div>
	</div>
</div>

<div class="mt-6 rounded-xl border border-surface-200-800 bg-surface-100-900 p-4 text-center">
	<p class="text-5xl font-bold tabular-nums">
		{successes}<span class="text-surface-500">/</span>{attempts}
	</p>
	<p class="mt-1 text-sm text-surface-600-400">
		{formatAccuracy(accuracy)}{target ? ` · target ${target} reps` : ''}
	</p>
</div>

<div class="mt-4 grid grid-cols-2 gap-3">
	<button
		type="button"
		onclick={hit}
		class="preset-filled-primary-500 rounded-2xl py-8 text-xl font-bold"
	>
		Hit
	</button>
	<button
		type="button"
		onclick={miss}
		class="preset-filled-surface-500 rounded-2xl py-8 text-xl font-bold"
	>
		Miss
	</button>
</div>

<div class="mt-3 flex gap-3">
	<button
		type="button"
		onclick={undo}
		disabled={attempts === 0}
		class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-sm disabled:opacity-40"
	>
		Undo
	</button>
	<button
		type="button"
		onclick={reset}
		disabled={attempts === 0}
		class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-sm disabled:opacity-40"
	>
		Reset
	</button>
</div>

{#if error}
	<p class="mt-3 text-sm text-error-500">{error}</p>
{/if}

{#if shown}
	<div class="mt-4">
		<AffirmationCard affirmation={shown} />
	</div>
	<div class="mt-3 flex gap-3">
		<button
			type="button"
			onclick={() => (shown = null)}
			class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-3 font-semibold"
		>
			Log another set
		</button>
		<button
			type="button"
			onclick={() => goto('/')}
			class="tap-target preset-filled-primary-500 flex-1 rounded-xl py-3 font-semibold"
		>
			Done
		</button>
	</div>
{:else}
	<button
		type="button"
		onclick={save}
		disabled={attempts === 0 || saving}
		class="tap-target preset-filled-primary-500 mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
	>
		{saving ? 'Saving…' : 'Save set'}
	</button>
{/if}
