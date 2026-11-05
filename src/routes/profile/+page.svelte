<script lang="ts">
	import { repo } from '$lib/data';
	import type { ProfileInput } from '$lib/data/repo';
	import { canOptInToSeniorPrograms, SENIOR_OPT_IN_MIN_AGE_YEARS } from '$lib/domain/senior-opt-in';
	import { localDate } from '$lib/util/time';
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
	let seniorOptIn = $state<0 | 1>(0);
	/** Whether the acknowledgement panel is open. Never persisted — it is a step, not a setting. */
	let acknowledging = $state(false);

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
				seniorOptIn = p.senior_programs_opt_in;
			})
			.finally(() => (loading = false));
	});

	function toggleDay(day: Weekday) {
		availableDays = availableDays.includes(day)
			? availableDays.filter((d) => d !== day)
			: [...availableDays, day];
	}

	const today = localDate();

	/*
	 * Derived from what is on the form rather than from the saved row, so a
	 * player who has just picked Under 17 and typed a date of birth sees the
	 * setting appear without saving first. The rule itself is not restated here
	 * — `canOptInToSeniorPrograms` owns it.
	 */
	const canOptIn = $derived(
		profile
			? canOptInToSeniorPrograms(
					{ ...profile, age_group: ageGroup, date_of_birth: dateOfBirth || null },
					today
				)
			: false
	);

	function toggleEquipment(item: EquipmentAccess) {
		equipmentAccess = equipmentAccess.includes(item)
			? equipmentAccess.filter((e) => e !== item)
			: [...equipmentAccess, item];
	}

	/*
	 * `override` is how the senior opt-in is written. It saves the form as it
	 * stands as well, which is deliberate: the acknowledgement has to persist on
	 * the tap that gives it — an opt-in that needed a second trip to Save would
	 * be an acknowledgement the player believes they gave and the app does not
	 * have — and Save is the only other way anything on this page is stored, so
	 * nothing is written that a Save would not have written anyway.
	 */
	async function save(override: Partial<ProfileInput> = {}) {
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
				retest_interval_weeks: retestIntervalWeeks,
				...override
			});
			seniorOptIn = profile.senior_programs_opt_in;
			acknowledging = false;
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
			{#if ageGroup === 'u17' && !dateOfBirth}
				<span class="mt-1 block text-xs text-surface-500">
					Needed to opt in to the senior programs — the age is checked against the date, not the age
					group.
				</span>
			{/if}
		</label>

		<!--
			Senior programs. Shown to the players the rule applies to, and to anyone
			still carrying the flag after moving out of it, so an opt-in that has
			stopped applying says so instead of vanishing silently.
		-->
		{#if canOptIn || seniorOptIn === 1}
			<div class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
				<span class="text-xs tracking-wide text-surface-600-400 uppercase">Senior programs</span>

				{#if !canOptIn}
					<p class="mt-2 text-sm">Not active at {AGE_GROUP_LABELS[ageGroup]}.</p>
					<p class="mt-1 text-xs text-surface-600-400">
						You opted in earlier, and the senior blocks are held back again because your profile no
						longer meets the age. The choice is kept — put the age group and date of birth back and
						it applies again.
					</p>
				{:else if seniorOptIn === 1}
					<p class="mt-2 text-sm">On. The senior blocks are in your Train list.</p>
					<p class="mt-1 text-xs text-surface-600-400">
						Pre-season max strength, In-season strength maintenance and Pre-season reactive power.
						The Under 17 versions are still there, and still the right place to be if a lift is new
						to you.
					</p>
					<button
						type="button"
						onclick={() => save({ senior_programs_opt_in: 0 })}
						disabled={saving}
						class="tap-target preset-outlined-surface-200-800 mt-3 w-full rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
					>
						Turn off
					</button>
				{:else if acknowledging}
					<p class="mt-2 text-sm">Before you turn this on:</p>
					<ul class="mt-2 space-y-1 text-xs text-surface-600-400">
						<li>
							· Sets are prescribed as a percentage of your one-rep max, so these blocks assume you
							have tested one and know the number.
						</li>
						<li>
							· They include power cleans and depth jumps — a technical lift and the highest landing
							force in the library. Both want a coach watching before they carry load.
						</li>
						<li>
							· Nothing is scaled down for your age. You are choosing the block a senior gets, as
							written.
						</li>
						<li>
							· You can turn this off here at any time, and the Under 17 blocks never go away.
						</li>
					</ul>
					<div class="mt-3 flex gap-2">
						<button
							type="button"
							onclick={() => (acknowledging = false)}
							class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-sm font-semibold"
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={() => save({ senior_programs_opt_in: 1 })}
							disabled={saving}
							class="tap-target preset-filled-primary-500 flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
						>
							I understand
						</button>
					</div>
				{:else}
					<p class="mt-2 text-sm">
						You are {SENIOR_OPT_IN_MIN_AGE_YEARS} or over, so you can train the senior blocks if you want
						to.
					</p>
					<p class="mt-1 text-xs text-surface-600-400">
						Three blocks are held back at Under 17 because they load by percentage and include power
						cleans and depth jumps. Opting in adds them to your Train list as written, with nothing
						taken out.
					</p>
					<button
						type="button"
						onclick={() => (acknowledging = true)}
						class="tap-target preset-tonal-primary mt-3 w-full rounded-xl py-2 text-sm font-semibold"
					>
						Opt in to senior programs
					</button>
				{/if}
			</div>
		{/if}

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
		onclick={() => save()}
		disabled={saving}
		class="tap-target preset-filled-primary-500 mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
	>
		{saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
	</button>
{/if}
