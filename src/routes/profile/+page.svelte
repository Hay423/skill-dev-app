<script lang="ts">
	import { repo } from '$lib/data';
	import {
		AGE_GROUPS,
		AGE_GROUP_LABELS,
		EQUIPMENT_ACCESS,
		EQUIPMENT_ACCESS_LABELS,
		DEFAULT_RETEST_INTERVAL_WEEKS,
		EXPERIENCE_LEVELS,
		EXPERIENCE_LEVEL_LABELS,
		POSITIONS,
		RETEST_INTERVAL_WEEKS,
		POSITION_LABELS,
		WEEKDAYS,
		WEEKDAY_LABELS,
		type AgeGroup,
		type EquipmentAccess,
		type ExperienceLevel,
		type PlayerProfile,
		type Position,
		type Weekday
	} from '$lib/types';

	let profile = $state<PlayerProfile | undefined>(undefined);
	let loading = $state(true);

	let displayName = $state('');
	let primaryPosition = $state<Position>('utility');
	let secondaryPosition = $state<Position | ''>('');
	let ageGroup = $state<AgeGroup>('senior');
	let dateOfBirth = $state('');
	let experience = $state<ExperienceLevel>('developing');
	let sessionsPerWeek = $state(1);
	let availableDays = $state<Weekday[]>([]);
	let equipmentAccess = $state<EquipmentAccess[]>([]);
	let retestIntervalWeeks = $state<number>(DEFAULT_RETEST_INTERVAL_WEEKS);

	let saving = $state(false);
	let saved = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		repo
			.getProfile()
			.then((p) => {
				profile = p;
				if (!p) return;
				displayName = p.display_name ?? '';
				primaryPosition = p.primary_position;
				secondaryPosition = p.secondary_position ?? '';
				ageGroup = p.age_group;
				dateOfBirth = p.date_of_birth ?? '';
				experience = p.experience;
				sessionsPerWeek = p.sessions_per_week;
				availableDays = [...p.available_days];
				equipmentAccess = [...p.equipment_access];
				retestIntervalWeeks = p.retest_interval_weeks;
			})
			.finally(() => (loading = false));
	});

	function toggleDay(day: Weekday) {
		availableDays = availableDays.includes(day)
			? availableDays.filter((d) => d !== day)
			: [...availableDays, day];
	}

	function toggleEquipment(item: EquipmentAccess) {
		equipmentAccess = equipmentAccess.includes(item)
			? equipmentAccess.filter((e) => e !== item)
			: [...equipmentAccess, item];
	}

	async function save() {
		saving = true;
		saved = false;
		error = null;
		try {
			profile = await repo.saveProfile({
				display_name: displayName.trim() || null,
				primary_position: primaryPosition,
				secondary_position: secondaryPosition || null,
				age_group: ageGroup,
				date_of_birth: dateOfBirth || null,
				experience,
				sessions_per_week: sessionsPerWeek,
				available_days: $state.snapshot(availableDays),
				equipment_access: $state.snapshot(equipmentAccess),
				retest_interval_weeks: retestIntervalWeeks
			});
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save';
		} finally {
			saving = false;
		}
	}
</script>

<header class="mb-4">
	<h1 class="text-2xl font-bold">Profile</h1>
	<p class="text-sm text-surface-600-400">Keeps your training tailored to you.</p>
</header>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if !profile}
	<div class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center">
		<p class="text-sm text-surface-600-400">No profile yet — set one up first.</p>
		<a
			href="/onboarding"
			class="tap-target preset-filled-primary-500 mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
		>
			Start onboarding
		</a>
	</div>
{:else}
	<a
		href="/profile/drills"
		class="tap-target preset-outlined-surface-200-800 mb-5 flex items-center justify-between rounded-xl px-4 py-3"
	>
		<span class="text-sm font-medium">Manage drill library</span>
		<span class="text-surface-500" aria-hidden="true">→</span>
	</a>

	<div class="space-y-5">
		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Display name</span>
			<input
				type="text"
				bind:value={displayName}
				placeholder="Optional"
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			/>
		</label>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Primary position</span>
			<div class="mt-1 grid grid-cols-2 gap-2">
				{#each POSITIONS as pos (pos)}
					<button
						type="button"
						onclick={() => (primaryPosition = pos)}
						class="tap-target rounded-xl border px-2 text-sm {primaryPosition === pos
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{POSITION_LABELS[pos]}
					</button>
				{/each}
			</div>
		</div>

		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Secondary position</span>
			<select
				bind:value={secondaryPosition}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			>
				<option value="">None</option>
				{#each POSITIONS as pos (pos)}
					<option value={pos}>{POSITION_LABELS[pos]}</option>
				{/each}
			</select>
		</label>

		<div>
			<label class="block" for="age-group">
				<span class="text-xs tracking-wide text-surface-600-400 uppercase" id="age-group"
					>Age group</span
				>
				<select
					bind:value={ageGroup}
					aria-labelledby="age-group"
					class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
				>
					{#each AGE_GROUPS as group (group)}
						<option value={group}>{AGE_GROUP_LABELS[group]}</option>
					{/each}
				</select>
			</label>
			<p class="mt-1 text-xs text-surface-500">
				Used to decide which strength-training content is safe to show you later.
			</p>
		</div>

		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Date of birth</span>
			<input
				type="date"
				bind:value={dateOfBirth}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			/>
		</label>

		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Experience</span>
			<select
				bind:value={experience}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			>
				{#each EXPERIENCE_LEVELS as level (level)}
					<option value={level}>{EXPERIENCE_LEVEL_LABELS[level]}</option>
				{/each}
			</select>
		</label>

		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Sessions per week</span>
			<input
				type="number"
				min="0"
				max="14"
				bind:value={sessionsPerWeek}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			/>
		</label>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Available days</span>
			<div class="mt-1 grid grid-cols-4 gap-2">
				{#each WEEKDAYS as day (day)}
					<button
						type="button"
						onclick={() => toggleDay(day)}
						class="tap-target rounded-xl border px-2 text-sm {availableDays.includes(day)
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{WEEKDAY_LABELS[day]}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Retest every</span>
			<div class="mt-1 flex gap-2">
				{#each RETEST_INTERVAL_WEEKS as weeks (weeks)}
					<button
						type="button"
						onclick={() => (retestIntervalWeeks = weeks)}
						class="tap-target flex-1 rounded-xl border px-2 text-sm {retestIntervalWeeks === weeks
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{weeks}w
					</button>
				{/each}
			</div>
			<p class="mt-1 text-xs text-surface-500">
				How often the skill tests come up again. Four weeks is long enough for training to show and
				short enough for the trend to have points in it.
			</p>
		</div>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Equipment access</span>
			<div class="mt-1 grid grid-cols-2 gap-2">
				{#each EQUIPMENT_ACCESS as item (item)}
					<button
						type="button"
						onclick={() => toggleEquipment(item)}
						class="tap-target rounded-xl border px-2 text-sm {equipmentAccess.includes(item)
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{EQUIPMENT_ACCESS_LABELS[item]}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if error}
		<p class="mt-3 text-sm text-error-500">{error}</p>
	{/if}

	<button
		type="button"
		onclick={save}
		disabled={saving}
		class="tap-target preset-filled-primary-500 mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
	>
		{saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
	</button>
{/if}
