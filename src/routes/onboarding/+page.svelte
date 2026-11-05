<script lang="ts">
	import { goto } from '$app/navigation';
	import { repo } from '$lib/data';
	import type { ProfileInput } from '$lib/data/repo';
	import {
		AGE_GROUPS,
		AGE_GROUP_LABELS,
		EQUIPMENT_ACCESS,
		EQUIPMENT_ACCESS_LABELS,
		EXPERIENCE_LEVELS,
		EXPERIENCE_LEVEL_LABELS,
		POSITIONS,
		POSITION_LABELS,
		DEFAULT_RETEST_INTERVAL_WEEKS,
		TEST_FAMILY_LABELS,
		WEEKDAYS,
		WEEKDAY_LABELS,
		type AgeGroup,
		type EquipmentAccess,
		type ExperienceLevel,
		type Position,
		type TestProtocol,
		type Weekday
	} from '$lib/types';
	import { protocolsByFamily, protocolsForAgeGroup } from '$lib/domain/tests';

	const STEP_TITLES = [
		'Position',
		'Age & experience',
		'Availability & equipment',
		'Baseline testing'
	];
	const totalSteps = STEP_TITLES.length;

	let step = $state(1);

	let primary_position = $state<Position>('utility');
	let secondary_position = $state<Position | null>(null);
	let age_group = $state<AgeGroup>('senior');
	let experience = $state<ExperienceLevel>('developing');
	let sessions_per_week = $state(3);
	let available_days = $state<Weekday[]>([]);
	let equipment_access = $state<EquipmentAccess[]>([]);

	let saving = $state(false);
	let error = $state<string | null>(null);

	let protocols = $state<TestProtocol[]>([]);
	$effect(() => {
		repo.listTestProtocols().then((rows) => (protocols = rows));
	});
	/** The tier this player's age group actually sits, for the step 4 preview. */
	const testPlan = $derived(protocolsForAgeGroup(protocols, age_group));

	function toggleDay(d: Weekday) {
		available_days = available_days.includes(d)
			? available_days.filter((x) => x !== d)
			: [...available_days, d];
	}

	function toggleEquipment(e: EquipmentAccess) {
		equipment_access = equipment_access.includes(e)
			? equipment_access.filter((x) => x !== e)
			: [...equipment_access, e];
	}

	function adjustSessions(delta: number) {
		sessions_per_week = Math.min(14, Math.max(0, sessions_per_week + delta));
	}

	function next() {
		if (step < totalSteps) step += 1;
	}

	function back() {
		if (step > 1) step -= 1;
	}

	async function finish() {
		saving = true;
		error = null;
		try {
			const input: ProfileInput = {
				primary_position,
				secondary_position,
				age_group,
				experience,
				sessions_per_week,
				available_days: $state.snapshot(available_days),
				equipment_access: $state.snapshot(equipment_access)
			};
			await repo.saveProfile(input);
			await goto('/');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save profile';
			saving = false;
		}
	}
</script>

<header class="mb-4">
	<p class="text-xs tracking-wide text-surface-600-400 uppercase">Step {step} of {totalSteps}</p>
	<h1 class="text-2xl font-bold">{STEP_TITLES[step - 1]}</h1>
	<div class="mt-3 flex gap-1">
		{#each STEP_TITLES as _, i (i)}
			<div
				class="h-1 flex-1 rounded-full {i < step ? 'bg-primary-500' : 'bg-surface-100-900'}"
			></div>
		{/each}
	</div>
</header>

{#if step === 1}
	<div class="space-y-5">
		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Primary position</span>
			<div class="mt-2 grid grid-cols-2 gap-2">
				{#each POSITIONS as p (p)}
					<button
						type="button"
						onclick={() => (primary_position = p)}
						class="tap-target rounded-xl border px-2 py-2 text-sm {primary_position === p
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{POSITION_LABELS[p]}
					</button>
				{/each}
			</div>
		</div>

		<label class="block">
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Secondary position</span>
			<select
				value={secondary_position ?? ''}
				onchange={(e) => (secondary_position = (e.currentTarget.value || null) as Position | null)}
				class="tap-target mt-1 w-full rounded-xl border border-surface-300-700 bg-surface-100-900 px-3 py-2"
			>
				<option value="">None</option>
				{#each POSITIONS as p (p)}
					<option value={p}>{POSITION_LABELS[p]}</option>
				{/each}
			</select>
		</label>
	</div>
{:else if step === 2}
	<div class="space-y-5">
		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Age group</span>
			<div class="mt-2 grid grid-cols-3 gap-2">
				{#each AGE_GROUPS as a (a)}
					<button
						type="button"
						onclick={() => (age_group = a)}
						class="tap-target rounded-xl border px-2 py-2 text-sm {age_group === a
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{AGE_GROUP_LABELS[a]}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Experience</span>
			<div class="mt-2 grid grid-cols-1 gap-2">
				{#each EXPERIENCE_LEVELS as ex (ex)}
					<button
						type="button"
						onclick={() => (experience = ex)}
						class="tap-target rounded-xl border px-3 py-2 text-left text-sm {experience === ex
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{EXPERIENCE_LEVEL_LABELS[ex]}
					</button>
				{/each}
			</div>
		</div>
	</div>
{:else if step === 3}
	<div class="space-y-5">
		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Sessions per week</span>
			<div class="mt-2 flex items-center gap-3">
				<button
					type="button"
					onclick={() => adjustSessions(-1)}
					class="tap-target preset-outlined-surface-200-800 rounded-xl px-4 text-xl"
				>
					−
				</button>
				<p class="w-12 text-center text-2xl font-bold tabular-nums">{sessions_per_week}</p>
				<button
					type="button"
					onclick={() => adjustSessions(1)}
					class="tap-target preset-outlined-surface-200-800 rounded-xl px-4 text-xl"
				>
					+
				</button>
			</div>
		</div>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Available days</span>
			<div class="mt-2 grid grid-cols-7 gap-1">
				{#each WEEKDAYS as d (d)}
					<button
						type="button"
						onclick={() => toggleDay(d)}
						class="tap-target rounded-xl border px-1 text-xs {available_days.includes(d)
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{WEEKDAY_LABELS[d]}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<span class="text-xs tracking-wide text-surface-600-400 uppercase">Equipment access</span>
			<div class="mt-2 grid grid-cols-2 gap-2">
				{#each EQUIPMENT_ACCESS as e (e)}
					<button
						type="button"
						onclick={() => toggleEquipment(e)}
						class="tap-target rounded-xl border px-2 py-2 text-sm {equipment_access.includes(e)
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						{EQUIPMENT_ACCESS_LABELS[e]}
					</button>
				{/each}
			</div>
		</div>
	</div>
{:else if step === 4}
	<!--
		Not a data step. Everyone goes through a testing phase, and the one thing
		that makes it work is knowing about it before being asked — a 30-kick test
		turns up as a chore if the first you hear of it is a card on the home
		screen. So this sets the expectation and the app prompts from there. It
		deliberately does not gate anything: nobody can sit these at the moment
		they finish onboarding.
	-->
	<div class="space-y-4">
		<p class="text-sm text-surface-600-400">
			Before the app can tell you that you are improving, it needs to know where you are starting.
			Three tests, each with fixed rules so today's score is comparable with one you sit in six
			months.
		</p>

		<!--
			Read off the seeded protocols rather than written out here, so the
			player sees the tier their age group actually sits — a U13 is told
			15, 20 and 25 m, a senior 20, 30 and 40 m — and this copy cannot drift
			from the protocols it describes.
		-->
		<ul class="space-y-2">
			{#each protocolsByFamily(testPlan) as group (group.family)}
				<li class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
					<p class="font-semibold">{TEST_FAMILY_LABELS[group.family]}</p>
					{#each group.protocols as protocol (protocol.id)}
						<p class="mt-1 text-sm text-surface-600-400">{protocol.summary}</p>
					{/each}
				</li>
			{/each}
		</ul>

		<p class="text-sm text-surface-600-400">
			You score yourself, so score honestly — a test you flatter is worth nothing to you. Do them
			whenever you next get to a ground; they will be waiting on your home screen, and nothing else
			is locked until then.
		</p>

		<p class="text-xs text-surface-500">
			After that, a retest every {DEFAULT_RETEST_INTERVAL_WEEKS} weeks by default. You can change that
			on your profile.
		</p>
	</div>
{/if}

{#if error}
	<p class="mt-3 text-sm text-error-500">{error}</p>
{/if}

<div class="mt-6 flex gap-3">
	{#if step > 1}
		<button
			type="button"
			onclick={back}
			class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-3 font-semibold"
		>
			Back
		</button>
	{/if}

	{#if step < totalSteps}
		<button
			type="button"
			onclick={next}
			class="preset-filled-primary-500 tap-target flex-1 rounded-xl py-3 font-semibold"
		>
			Continue
		</button>
	{:else}
		<button
			type="button"
			onclick={finish}
			disabled={saving}
			class="preset-filled-primary-500 tap-target flex-1 rounded-xl py-3 font-semibold disabled:opacity-40"
		>
			{saving ? 'Saving…' : 'Finish setup'}
		</button>
	{/if}
</div>
