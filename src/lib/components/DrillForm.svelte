<script lang="ts">
	import {
		EQUIPMENT_ACCESS,
		EQUIPMENT_ACCESS_LABELS,
		POSITIONS,
		POSITION_LABELS,
		SKILL_CATEGORIES,
		SKILL_CATEGORY_LABELS,
		type Difficulty,
		type Drill,
		type EquipmentAccess,
		type Position,
		type SkillCategory
	} from '$lib/types';
	import type { DrillInput } from '$lib/data/repo';
	import { untrack } from 'svelte';

	interface Props {
		initial?: Drill;
		submitLabel: string;
		saving?: boolean;
		error?: string | null;
		onsubmit: (input: DrillInput) => void;
	}

	let { initial, submitLabel, saving = false, error = null, onsubmit }: Props = $props();

	// Seeded once from `initial` on mount, not kept in sync with it — the caller
	// (the edit route) wraps this component in `{#key drill.id}` to remount it
	// if the underlying drill ever changes.
	const seed = untrack(() => initial);

	let name = $state(seed?.name ?? '');
	let category = $state<SkillCategory>(seed?.category ?? 'kicking');
	let summary = $state(seed?.summary ?? '');
	let setup = $state(seed?.setup ?? '');
	let coachingPointsText = $state((seed?.coaching_points ?? []).join('\n'));
	let equipmentText = $state((seed?.equipment ?? []).join('\n'));
	let minPlayers = $state(seed?.min_players ?? 1);
	let durationMinutes = $state(seed?.duration_minutes ?? 10);
	let difficulty = $state<Difficulty>(seed?.difficulty ?? 1);
	let tracksReps = $state(seed?.tracks_reps ?? true);
	let targetReps = $state(seed?.target_reps ?? 20);
	let positionTags = $state<Position[]>([...(seed?.position_tags ?? [])]);
	let equipmentRequired = $state<EquipmentAccess[]>([...(seed?.equipment_required ?? [])]);

	function linesToList(text: string): string[] {
		return text
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
	}

	function togglePosition(pos: Position) {
		positionTags = positionTags.includes(pos)
			? positionTags.filter((p) => p !== pos)
			: [...positionTags, pos];
	}

	function toggleEquipmentRequired(item: EquipmentAccess) {
		equipmentRequired = equipmentRequired.includes(item)
			? equipmentRequired.filter((e) => e !== item)
			: [...equipmentRequired, item];
	}

	function submit() {
		onsubmit({
			slug: seed?.slug,
			name: name.trim(),
			category,
			summary: summary.trim(),
			setup: setup.trim(),
			coaching_points: linesToList(coachingPointsText),
			equipment: linesToList(equipmentText),
			min_players: minPlayers,
			duration_minutes: durationMinutes,
			difficulty,
			tracks_reps: tracksReps,
			target_reps: tracksReps ? targetReps : null,
			position_tags: $state.snapshot(positionTags),
			equipment_required: $state.snapshot(equipmentRequired)
		});
	}
</script>

<div class="space-y-4">
	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Name</span>
		<input
			type="text"
			bind:value={name}
			class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		/>
	</label>

	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Skill category</span>
		<select
			bind:value={category}
			class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		>
			{#each SKILL_CATEGORIES as c (c)}
				<option value={c}>{SKILL_CATEGORY_LABELS[c]}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Summary</span>
		<textarea
			bind:value={summary}
			rows="2"
			class="mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		></textarea>
	</label>

	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Setup</span>
		<textarea
			bind:value={setup}
			rows="3"
			class="mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		></textarea>
	</label>

	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Coaching points</span>
		<span class="ml-1 text-xs text-surface-500">(one per line)</span>
		<textarea
			bind:value={coachingPointsText}
			rows="4"
			class="mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		></textarea>
	</label>

	<label class="block">
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Equipment</span>
		<span class="ml-1 text-xs text-surface-500">(one per line, for display)</span>
		<textarea
			bind:value={equipmentText}
			rows="2"
			class="mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
		></textarea>
	</label>

	<div class="grid grid-cols-2 gap-3">
		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Min players</span>
			<input
				type="number"
				min="1"
				bind:value={minPlayers}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			/>
		</label>
		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Duration (min)</span>
			<input
				type="number"
				min="1"
				bind:value={durationMinutes}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			/>
		</label>
	</div>

	<div>
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Difficulty</span>
		<div class="mt-1 grid grid-cols-3 gap-2">
			{#each [1, 2, 3] as const as level (level)}
				<button
					type="button"
					onclick={() => (difficulty = level)}
					class="tap-target rounded-xl border px-2 text-sm {difficulty === level
						? 'preset-filled-primary-500'
						: 'preset-outlined-surface-200-800'}"
				>
					{['Foundation', 'Developing', 'Advanced'][level - 1]}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex items-center justify-between rounded-xl border border-surface-200-800 p-3">
		<div>
			<p class="text-sm font-medium">Tracks reps</p>
			<p class="text-xs text-surface-500">Shows up in the rep logger</p>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={tracksReps}
			onclick={() => (tracksReps = !tracksReps)}
			class="tap-target rounded-xl border px-3 text-sm {tracksReps
				? 'preset-filled-primary-500'
				: 'preset-outlined-surface-200-800'}"
		>
			{tracksReps ? 'On' : 'Off'}
		</button>
	</div>

	{#if tracksReps}
		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Target reps</span>
			<input
				type="number"
				min="1"
				bind:value={targetReps}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			/>
		</label>
	{/if}

	<div>
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Position tags</span>
		<span class="ml-1 text-xs text-surface-500">(optional — leave empty for a general drill)</span>
		<div class="mt-1 grid grid-cols-2 gap-2">
			{#each POSITIONS as pos (pos)}
				<button
					type="button"
					onclick={() => togglePosition(pos)}
					class="tap-target rounded-xl border px-2 text-sm {positionTags.includes(pos)
						? 'preset-filled-primary-500'
						: 'preset-outlined-surface-200-800'}"
				>
					{POSITION_LABELS[pos]}
				</button>
			{/each}
		</div>
	</div>

	<div>
		<span class="text-xs tracking-wide text-surface-600-400 uppercase">Equipment required</span>
		<span class="ml-1 text-xs text-surface-500">(optional — for eligibility filtering)</span>
		<div class="mt-1 grid grid-cols-2 gap-2">
			{#each EQUIPMENT_ACCESS as item (item)}
				<button
					type="button"
					onclick={() => toggleEquipmentRequired(item)}
					class="tap-target rounded-xl border px-2 text-sm {equipmentRequired.includes(item)
						? 'preset-filled-primary-500'
						: 'preset-outlined-surface-200-800'}"
				>
					{EQUIPMENT_ACCESS_LABELS[item]}
				</button>
			{/each}
		</div>
	</div>

	{#if error}
		<p class="text-sm text-error-500">{error}</p>
	{/if}

	<button
		type="button"
		onclick={submit}
		disabled={saving || !name.trim() || !summary.trim() || !setup.trim()}
		class="tap-target preset-filled-primary-500 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
	>
		{saving ? 'Saving…' : submitLabel}
	</button>
</div>
