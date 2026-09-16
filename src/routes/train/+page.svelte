<script lang="ts">
	import { repo } from '$lib/data';
	import SupervisionNote from '$lib/components/SupervisionNote.svelte';
	import WeekPlan from '$lib/components/WeekPlan.svelte';
	import { loadWeekPlan } from '$lib/plan';
	import type { PlannedDay } from '$lib/domain/schedule';
	import {
		DISCIPLINE_LABELS,
		describeProgramShape,
		describeQualities
	} from '$lib/domain/program-plan';
	import { programWeekOn } from '$lib/domain/schedule';
	import {
		describeExclusion,
		isStrengthWithheld,
		priorityQualities,
		recommendPrograms,
		STRENGTH_MIN_AGE_GROUP,
		type RecommendationContext
	} from '$lib/domain/recommend';
	import {
		AGE_GROUP_LABELS,
		PHYSICAL_QUALITY_LABELS,
		type PlayerProfile,
		type PositionProfile,
		type ProgramEnrolment,
		type TrainingProgram
	} from '$lib/types';
	import { describeLoadPolicy } from '$lib/domain/load-policy';
	import { localDate, startOfWeek } from '$lib/util/time';

	let profile = $state<PlayerProfile | undefined>(undefined);
	let positions = $state<PositionProfile[]>([]);
	let programs = $state<TrainingProgram[]>([]);
	let enrolments = $state<ProgramEnrolment[]>([]);
	let planDays = $state<PlannedDay[]>([]);
	let today = $state(localDate());
	let monday = $state(startOfWeek(localDate()));
	let range = $state<{ from: string; to: string } | null>(null);
	/** The week being shown. Null means this one, and follows the date. */
	let anchor = $state<string | undefined>(undefined);
	let loading = $state(true);

	async function load() {
		const [p, pos, progs, live, plan] = await Promise.all([
			repo.getProfile(),
			repo.listPositions(),
			repo.listPrograms(),
			repo.activeEnrolments(),
			loadWeekPlan(anchor)
		]);
		profile = p;
		positions = pos;
		programs = progs;
		enrolments = live;
		planDays = plan.days;
		today = plan.today;
		monday = plan.monday;
		range = plan.range;
	}

	async function browse(to: string) {
		anchor = to;
		await load();
	}

	$effect(() => {
		load().finally(() => (loading = false));
	});

	const context = $derived<RecommendationContext | null>(
		profile ? { profile, positions, today } : null
	);

	const result = $derived(
		context ? recommendPrograms(programs, context) : { recommended: [], excluded: [] }
	);

	const loadNote = $derived(describeLoadPolicy(profile));

	const strength = $derived(result.recommended.filter((r) => r.program.discipline === 'strength'));
	const conditioning = $derived(
		result.recommended.filter((r) => r.program.discipline === 'conditioning')
	);

	/**
	 * Withheld strength is stated up front rather than left to the exclusions
	 * row. It is not a gap in the library — it is a decision about this player,
	 * and it deserves a sentence of its own.
	 */
	const strengthWithheld = $derived(profile ? isStrengthWithheld(profile) : false);

	const focus = $derived(
		context
			? priorityQualities(context)
					.map((q) => PHYSICAL_QUALITY_LABELS[q].toLowerCase())
					.join(', ')
			: ''
	);

	/** At most one per discipline, so this is a short list rather than a single row. */
	const enrolled = $derived(
		enrolments
			.map((enrolment) => ({
				enrolment,
				program: programs.find((p) => p.id === enrolment.program_id)
			}))
			.filter((row) => row.program !== undefined)
	);

	const enrolledIds = $derived(new Set(enrolled.map((row) => row.program!.id)));

	/**
	 * Exclusions the player can do something about. The junior-strength rule is
	 * not one of them — it already has its own explanation above, and repeating
	 * it as "3 not shown" would read as a library gap rather than a decision.
	 */
	const actionableExclusions = $derived(
		result.excluded.filter(({ reason }) => reason.kind !== 'junior_strength')
	);
</script>

<header class="mb-4">
	<h1 class="text-2xl font-bold">Train</h1>
	<p class="text-sm text-surface-600-400">
		Strength and running programs, matched to your profile.
	</p>
</header>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if !profile}
	<div class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center">
		<p class="text-sm text-surface-600-400">Set up a profile first so programs can be matched.</p>
		<a
			href="/onboarding"
			class="tap-target preset-filled-primary-500 mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
		>
			Start onboarding
		</a>
	</div>
{:else}
	<WeekPlan days={planDays} {today} {monday} {range} onchange={load} onbrowse={browse} />

	{#if loadNote}
		<p
			class="mb-5 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 text-xs text-surface-600-400"
		>
			<span class="font-semibold text-surface-900-100">Masters.</span>
			{loadNote}
		</p>
	{/if}

	{#if enrolled.length > 0}
		<section class="mb-6">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
				Currently running
			</h2>
			<ul class="space-y-2">
				{#each enrolled as { enrolment, program } (enrolment.id)}
					<li>
						<a
							href="/train/{program!.slug}"
							class="tap-target block rounded-xl border border-primary-500 bg-surface-100-900 p-3 active:bg-surface-200-800"
						>
							<p class="font-semibold">{program!.name}</p>
							<p class="mt-1 text-sm text-surface-600-400">
								{DISCIPLINE_LABELS[program!.discipline]} · week {programWeekOn(enrolment, today)} of {program!
									.weeks}
							</p>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if focus}
		<p class="mb-3 text-xs text-surface-500">Your position leans on {focus}.</p>
	{/if}

	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			{DISCIPLINE_LABELS.strength}
		</h2>

		{#if strengthWithheld}
			<div class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4">
				<p class="text-sm">
					No strength programs at {AGE_GROUP_LABELS[profile.age_group]}.
				</p>
				<p class="mt-2 text-sm text-surface-600-400">
					Resistance training is held back until {AGE_GROUP_LABELS[STRENGTH_MIN_AGE_GROUP]} so a growing
					body is not carrying load it does not need yet. Running, skills and games build plenty at your
					age — the running programs below are the ones to be doing.
				</p>
				<a href="/profile" class="mt-3 inline-block text-xs font-medium text-primary-500">
					Update your age group →
				</a>
			</div>
		{:else if strength.length === 0}
			<p
				class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center text-sm text-surface-500"
			>
				No strength programs match the gear you have listed. Add what you can train with in your
				profile to open these up.
			</p>
		{:else}
			<div class="mb-2"><SupervisionNote /></div>
			<ul class="space-y-2">
				{#each strength as { program, reason, caution } (program.id)}
					<li>
						<a
							href="/train/{program.slug}"
							class="tap-target block rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 active:bg-surface-200-800"
						>
							<h3 class="font-semibold">{program.name}</h3>
							<p class="mt-1 text-sm text-surface-600-400">{program.summary}</p>
							<p class="mt-2 text-xs text-surface-500">{describeProgramShape(program)}</p>
							{#if enrolledIds.has(program.id)}
								<p
									class="mt-2 inline-block rounded-full preset-filled-primary-500 px-2 py-0.5 text-xs"
								>
									Running now
								</p>
							{:else if caution}
								<p class="mt-2 inline-block rounded-full preset-tonal-surface px-2 py-0.5 text-xs">
									{caution}
								</p>
							{:else if reason}
								<p class="mt-2 inline-block rounded-full preset-tonal-primary px-2 py-0.5 text-xs">
									{reason}
								</p>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			{DISCIPLINE_LABELS.conditioning}
		</h2>
		{#if conditioning.length === 0}
			<p
				class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center text-sm text-surface-500"
			>
				No running programs match your profile yet.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each conditioning as { program, reason, caution } (program.id)}
					<li>
						<a
							href="/train/{program.slug}"
							class="tap-target block rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 active:bg-surface-200-800"
						>
							<h3 class="font-semibold">{program.name}</h3>
							<p class="mt-1 text-sm text-surface-600-400">{program.summary}</p>
							<p class="mt-2 text-xs text-surface-500">{describeProgramShape(program)}</p>
							<p class="text-xs text-surface-500">{describeQualities(program)}</p>
							{#if enrolledIds.has(program.id)}
								<p
									class="mt-2 inline-block rounded-full preset-filled-primary-500 px-2 py-0.5 text-xs"
								>
									Running now
								</p>
							{:else if caution}
								<p class="mt-2 inline-block rounded-full preset-tonal-surface px-2 py-0.5 text-xs">
									{caution}
								</p>
							{:else if reason}
								<p class="mt-2 inline-block rounded-full preset-tonal-primary px-2 py-0.5 text-xs">
									{reason}
								</p>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if actionableExclusions.length > 0}
		<details>
			<summary class="tap-target flex items-center text-xs text-surface-500">
				{actionableExclusions.length}
				{actionableExclusions.length === 1 ? 'program' : 'programs'} not shown
			</summary>
			<ul class="mt-1 space-y-1 pl-1">
				{#each actionableExclusions as { program, reason } (program.id)}
					<li class="text-xs text-surface-500">
						{program.name} — {describeExclusion(reason)}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
{/if}
