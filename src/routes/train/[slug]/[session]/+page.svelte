<script lang="ts">
	import { page } from '$app/state';
	import SupervisionNote from '$lib/components/SupervisionNote.svelte';
	import { repo } from '$lib/data';
	import {
		describePrescription,
		hasScaledPrescription,
		isLoadedSession,
		itemsForSession,
		resolveItems,
		SESSION_TYPE_LABELS,
		weekOf
	} from '$lib/domain/program-plan';
	import { describeHeartRate, describeMaxHrBasis, estimateMaxHr } from '$lib/domain/heart-rate';
	import { describeExclusion, isEligible, type RecommendationContext } from '$lib/domain/recommend';
	import {
		allItemsTicked,
		weekProgress,
		type PlannedDay,
		type ScheduledSession
	} from '$lib/domain/schedule';
	import {
		isExtraItemId,
		tailorSession,
		topQualitiesFor,
		type TailoredSession
	} from '$lib/domain/exercise-fit';
	import AffirmationCard from '$lib/components/AffirmationCard.svelte';
	import { loadAffirmation } from '$lib/affirm';
	import type { Affirmation } from '$lib/domain/affirmations';
	import { loadWeekPlan } from '$lib/plan';
	import { SECTION_LABELS, splitSections } from '$lib/domain/routines';
	import {
		PHYSICAL_QUALITY_LABELS,
		POSITION_LABELS,
		WEEKDAY_LABELS,
		type Exercise,
		type PlayerProfile,
		type PositionProfile,
		type ProgramItem,
		type ProgramPlan
	} from '$lib/types';
	import { localDate } from '$lib/util/time';

	const today = localDate();

	let plan = $state<ProgramPlan | undefined>(undefined);
	let exercises = $state<Exercise[]>([]);
	let profile = $state<PlayerProfile | undefined>(undefined);
	let positions = $state<PositionProfile[]>([]);
	let planDays = $state<PlannedDay[]>([]);
	let adjust = $state(1);
	let ticked = $state<string[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let shown = $state<Affirmation | null>(null);

	async function load() {
		const slug = page.params.slug;
		const [p, ex, prof, pos, week] = await Promise.all([
			slug ? repo.getProgramPlanBySlug(slug) : Promise.resolve(undefined),
			repo.listExercises(),
			repo.getProfile(),
			repo.listPositions(),
			loadWeekPlan()
		]);
		plan = p;
		exercises = ex;
		profile = prof;
		positions = pos;
		planDays = week.days;
		adjust = week.adjust;
		ticked = [...(scheduledOn(week.days)?.scheduled.log?.completed_item_ids ?? [])];
	}

	$effect(() => {
		load().finally(() => (loading = false));
	});

	/**
	 * Where this session sits in the current week's plan.
	 *
	 * The scheduler owns the mapping from session to day, so the tick is dated
	 * by the same rule the calendar draws — reading it back here rather than
	 * recomputing it is what keeps the two from disagreeing.
	 */
	function scheduledOn(
		days: PlannedDay[]
	): { day: PlannedDay; scheduled: ScheduledSession } | undefined {
		for (const day of days) {
			const scheduled = day.sessions.find((s) => s.session.id === page.params.session);
			if (scheduled) return { day, scheduled };
		}
		return undefined;
	}

	const placement = $derived(scheduledOn(planDays));

	const context = $derived<RecommendationContext | null>(
		profile ? { profile, positions, today } : null
	);

	/** The same gate the program page applies — a session is no less loaded than its program. */
	const eligibility = $derived(
		plan && context ? isEligible(plan.program, context) : ({ eligible: true } as const)
	);

	const session = $derived(plan?.sessions.find((s) => s.id === page.params.session));
	const week = $derived(plan && session ? weekOf(plan, session.week_number) : undefined);
	const items = $derived(plan && session ? itemsForSession(plan, session.id) : []);

	/**
	 * A second, independent filter: an exercise the player is too young for is
	 * dropped even if it somehow reached a program they can open. The seed
	 * content never does this — a test asserts it — but the session view is the
	 * last place a loaded lift could reach a junior, so it checks anyway.
	 */
	const authored = $derived(
		context
			? resolveItems(items, exercises).filter(
					({ exercise }) => exercise === null || isEligible(exercise, context).eligible
				)
			: []
	);

	/**
	 * Position-driven tailoring for this session: exercises worth swapping for a
	 * better fit, and optional extras for movement patterns the session does not
	 * already train. See `domain/exercise-fit.ts`.
	 *
	 * Only for a strength session with a program to tailor against — a running
	 * session has no gym exercises to substitute or extend.
	 */
	const tailored = $derived<TailoredSession>(
		plan && session && context && session.type === 'strength'
			? tailorSession({
					program: plan.program,
					items,
					exercises,
					ctx: context,
					session_type: session.type,
					session_id: session.id
				})
			: { substitutions: new Map(), extras: [] }
	);

	/** Authored items, swapped for a better position fit where one was found. */
	const visible = $derived(
		authored.map(({ item, exercise }) => {
			const swap = tailored.substitutions.get(item.id);
			return { item, exercise: swap ? swap.to : exercise, substitutedFrom: swap?.from ?? null };
		})
	);

	/**
	 * Warm-up, main work and cool-down, each rendered under its own heading. All
	 * three count towards the session being done; only position extras do not.
	 */
	const sections = $derived(splitSections(visible, ({ item }) => item));
	const hasRoutines = $derived(sections.warm_up.length > 0 || sections.cool_down.length > 0);

	/** Only the authored/substituted items count towards the session being done. */
	const requiredIds = $derived(visible.map(({ item }) => item.id));

	const loaded = $derived(session ? isLoadedSession(session, items, exercises) : false);
	const scaled = $derived(hasScaledPrescription(visible.map(({ item }) => item)));

	/**
	 * Estimated from age, because a real maximum needs a supervised test to
	 * exhaustion — see `domain/heart-rate.ts`. Null until the profile has loaded,
	 * which is the one state where no heart rate line can be drawn at all.
	 */
	const maxHr = $derived(profile ? estimateMaxHr(profile, today) : null);

	/**
	 * The heart rate line under an item's prescription, or null where there is
	 * nothing worth printing — a plank has no target and would only be noise.
	 */
	function heartRate(item: ProgramItem, exercise: Exercise | null): string | null {
		if (maxHr === null || !session) return null;
		return describeHeartRate({
			item,
			exercise,
			session_type: session.type,
			week,
			adjust,
			max_hr: maxHr
		});
	}

	/** Whether anything on this session actually prints a heart rate, so the note can be withheld. */
	const showsHeartRate = $derived(
		visible.some(({ item, exercise }) => heartRate(item, exercise) !== null) ||
			tailored.extras.some(({ item, exercise }) => heartRate(item, exercise) !== null)
	);

	/** Ticking is only offered for the week the session is actually scheduled in. */
	const canTick = $derived(placement !== undefined && placement.day.tickable);
	const tickedSet = $derived(new Set(ticked));
	const complete = $derived(allItemsTicked(requiredIds, ticked));
	/**
	 * Counted against the items on screen rather than the stored ticks: a tick
	 * left over from before a content update, or on an optional extra, is not
	 * one of the things this counter is counting.
	 */
	const doneCount = $derived(requiredIds.filter((id) => tickedSet.has(id)).length);

	async function toggleItem(id: string) {
		if (!placement || !canTick) return;
		const wasComplete = complete;
		ticked = tickedSet.has(id) ? ticked.filter((x) => x !== id) : [...ticked, id];
		await persist();
		if (!wasComplete && complete) await announce();
	}

	async function toggleSession() {
		if (!placement || !canTick) return;
		const wasComplete = complete;
		// Extras stay whatever the player left them at — "mark whole session
		// done" is about the prescribed work, not the optional add-ons.
		const extraTicks = ticked.filter((id) => isExtraItemId(id));
		ticked = complete ? extraTicks : [...requiredIds, ...extraTicks];
		await persist();
		if (!wasComplete && complete) await announce();
	}

	/** The affirmation for finishing this session, only on the way to done. */
	async function announce() {
		if (!placement || !plan || !session) return;
		const before = weekProgress(planDays);
		shown = await loadAffirmation({
			kind: 'session',
			session_name: session.name,
			session_type: session.type,
			program_name: plan.program.name,
			week_number: week?.week_number ?? session.week_number,
			total_weeks: plan.program.weeks,
			is_deload: week?.is_deload ?? false,
			done_this_week: before.done + 1,
			sessions_this_week: before.sessions
		});
	}

	/**
	 * A session is done exactly when its exercises are, so the two can never
	 * disagree: ticking the last exercise finishes the session, and unticking
	 * any of them reopens it.
	 */
	async function persist() {
		if (!placement) return;
		saving = true;
		try {
			await repo.logSessionProgress({
				enrolment_id: placement.scheduled.enrolment_id,
				program_session_id: placement.scheduled.session.id,
				local_date: placement.day.date,
				completed_item_ids: $state.snapshot(ticked),
				completed: allItemsTicked(requiredIds, ticked)
			});
		} finally {
			saving = false;
		}
	}

	function substitutionNote(from: Exercise): string {
		const position = context ? POSITION_LABELS[context.profile.primary_position] : '';
		return `Swapped in for ${position.toLowerCase()} — was ${from.name}`;
	}

	function extraNote(exercise: Exercise): string {
		if (!context) return 'Position extra';
		const [top] = topQualitiesFor(exercise, context);
		return top
			? `Position extra — ${PHYSICAL_QUALITY_LABELS[top].toLowerCase()}`
			: 'Position extra';
	}
</script>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if !plan || !session}
	<p class="text-sm text-surface-600-400">
		Session not found. <a class="underline" href="/train">Back to training</a>
	</p>
{:else if !eligibility.eligible}
	<p class="text-sm text-surface-600-400">
		This session is not available to you — {describeExclusion(eligibility.reason)}.
		<a class="underline" href="/train">Back to training</a>
	</p>
{:else}
	<header class="mb-4">
		<a href="/train/{plan.program.slug}" class="text-sm text-surface-600-400">
			← {plan.program.name}
		</a>
		<h1 class="mt-2 text-2xl font-bold">{session.name}</h1>
		<p class="mt-1 flex flex-wrap gap-x-2 text-xs text-surface-500">
			<span>Week {session.week_number}</span>
			<span aria-hidden="true">·</span>
			<span>{SESSION_TYPE_LABELS[session.type]}</span>
			<span aria-hidden="true">·</span>
			<span>{session.duration_minutes} min</span>
			{#if placement}
				<span aria-hidden="true">·</span>
				<span class={placement.day.isToday ? 'text-primary-500' : ''}>
					{WEEKDAY_LABELS[placement.day.weekday]}{placement.day.isToday ? ' (today)' : ''}
				</span>
			{/if}
			{#if week?.is_deload}
				<span aria-hidden="true">·</span>
				<span class="text-primary-500">Deload week</span>
			{/if}
		</p>
		{#if week}
			<p class="mt-1 text-sm text-surface-600-400">{week.focus}</p>
		{/if}
	</header>

	{#if shown}
		<div class="mb-4">
			<AffirmationCard affirmation={shown} ondismiss={() => (shown = null)} />
		</div>
	{/if}

	{#if loaded}
		<div class="mb-4"><SupervisionNote context="session" /></div>
	{/if}

	{#if canTick}
		<p class="mb-3 text-xs text-surface-500">
			{doneCount} of {requiredIds.length} done — tap each one as you finish it{hasRoutines
				? ', warm-up and cool-down included'
				: ''}.
		</p>
	{/if}

	{#snippet sectionHeading(label: string, name: string | null, minutes: number | null)}
		<h2
			class="mb-2 flex items-baseline justify-between gap-3 text-xs tracking-wide text-surface-600-400 uppercase"
		>
			<span>{label}</span>
			{#if name}
				<span class="text-right tracking-normal normal-case text-surface-500">
					{name}{minutes ? ` · ${minutes} min` : ''}
				</span>
			{/if}
		</h2>
	{/snippet}

	{#snippet itemCard(entry: (typeof visible)[number], number: number)}
		{@const { item, exercise, substitutedFrom } = entry}
		{@const isTicked = tickedSet.has(item.id)}
		<li
			class="rounded-xl border bg-surface-100-900 {isTicked
				? 'border-primary-500'
				: 'border-surface-200-800'}"
		>
			<div class="flex items-stretch">
				<div class="min-w-0 flex-1 p-3">
					<div class="flex items-start justify-between gap-3">
						<h3 class="font-semibold {isTicked ? 'line-through opacity-60' : ''}">
							{exercise?.name ?? item.notes ?? 'Run'}
						</h3>
						<span class="shrink-0 text-xs text-surface-500">{number}</span>
					</div>
					<p class="mt-1 text-sm tabular-nums text-surface-600-400">
						{describePrescription(item, week, adjust)}
					</p>
					{#if heartRate(item, exercise)}
						<p class="mt-0.5 text-xs tabular-nums text-surface-500">
							{heartRate(item, exercise)}
						</p>
					{/if}
					{#if substitutedFrom}
						<p class="mt-1 inline-block rounded-full preset-tonal-primary px-2 py-0.5 text-xs">
							{substitutionNote(substitutedFrom)}
						</p>
					{/if}
					{#if item.notes && exercise}
						<p class="mt-1 text-xs text-surface-500">{item.notes}</p>
					{/if}
					{#if exercise && exercise.coaching_points.length > 0}
						<details class="mt-2">
							<summary class="tap-target flex items-center text-xs text-primary-500">
								Coaching points
							</summary>
							<ul class="mt-1 space-y-1">
								{#each exercise.coaching_points as point (point)}
									<li class="flex gap-2 text-xs text-surface-600-400">
										<span class="text-primary-500" aria-hidden="true">▸</span>
										<span>{point}</span>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				</div>
				{#if canTick}
					<button
						type="button"
						onclick={() => toggleItem(item.id)}
						disabled={saving}
						aria-pressed={isTicked}
						aria-label="{isTicked ? 'Undo' : 'Done'}: {exercise?.name ?? item.notes ?? 'item'}"
						class="tap-target w-14 shrink-0 border-l border-surface-200-800 text-lg disabled:opacity-40 {isTicked
							? 'text-primary-500'
							: 'text-surface-500'}"
					>
						{isTicked ? '✓' : '○'}
					</button>
				{/if}
			</div>
		</li>
	{/snippet}

	{#if sections.warm_up.length > 0}
		<section class="mb-5">
			{@render sectionHeading(
				SECTION_LABELS.warm_up,
				session.warm_up_name,
				session.warm_up_minutes
			)}
			<ol class="space-y-2">
				{#each sections.warm_up as entry, i (entry.item.id)}
					{@render itemCard(entry, i + 1)}
				{/each}
			</ol>
		</section>
	{/if}

	<section>
		{#if hasRoutines}
			{@render sectionHeading(SECTION_LABELS.main, null, null)}
		{/if}
		<ol class="space-y-2">
			{#each sections.main as entry, i (entry.item.id)}
				{@render itemCard(entry, i + 1)}
			{/each}
		</ol>
	</section>

	{#if tailored.extras.length > 0}
		<div class="mt-4">
			<p class="mb-2 text-xs tracking-wide text-surface-600-400 uppercase">
				Optional — for your position
			</p>
			<ol class="space-y-2">
				{#each tailored.extras as { item, exercise } (item.id)}
					{@const isTicked = tickedSet.has(item.id)}
					<li
						class="rounded-xl border border-dashed bg-surface-100-900 {isTicked
							? 'border-primary-500'
							: 'border-surface-300-700'}"
					>
						<div class="flex items-stretch">
							<div class="min-w-0 flex-1 p-3">
								<div class="flex items-start justify-between gap-3">
									<h3 class="font-semibold {isTicked ? 'line-through opacity-60' : ''}">
										{exercise.name}
									</h3>
								</div>
								<p class="mt-1 text-sm tabular-nums text-surface-600-400">
									{describePrescription(item, week, adjust)}
								</p>
								{#if heartRate(item, exercise)}
									<p class="mt-0.5 text-xs tabular-nums text-surface-500">
										{heartRate(item, exercise)}
									</p>
								{/if}
								<p class="mt-1 inline-block rounded-full preset-tonal-surface px-2 py-0.5 text-xs">
									{extraNote(exercise)}
								</p>
								{#if exercise.coaching_points.length > 0}
									<details class="mt-2">
										<summary class="tap-target flex items-center text-xs text-primary-500">
											Coaching points
										</summary>
										<ul class="mt-1 space-y-1">
											{#each exercise.coaching_points as point (point)}
												<li class="flex gap-2 text-xs text-surface-600-400">
													<span class="text-primary-500" aria-hidden="true">▸</span>
													<span>{point}</span>
												</li>
											{/each}
										</ul>
									</details>
								{/if}
							</div>
							{#if canTick}
								<button
									type="button"
									onclick={() => toggleItem(item.id)}
									disabled={saving}
									aria-pressed={isTicked}
									aria-label="{isTicked ? 'Undo' : 'Done'}: {exercise.name}"
									class="tap-target w-14 shrink-0 border-l border-surface-200-800 text-lg disabled:opacity-40 {isTicked
										? 'text-primary-500'
										: 'text-surface-500'}"
								>
									{isTicked ? '✓' : '○'}
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	{#if sections.cool_down.length > 0}
		<section class="mt-5">
			{@render sectionHeading(
				SECTION_LABELS.cool_down,
				session.cool_down_name,
				session.cool_down_minutes
			)}
			<ol class="space-y-2">
				{#each sections.cool_down as entry, i (entry.item.id)}
					{@render itemCard(entry, i + 1)}
				{/each}
			</ol>
		</section>
	{/if}

	{#if canTick}
		<button
			type="button"
			onclick={toggleSession}
			disabled={saving}
			class="tap-target mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-40 {complete
				? 'preset-outlined-surface-200-800'
				: 'preset-filled-primary-500'}"
		>
			{complete ? 'Session done — undo' : 'Mark whole session done'}
		</button>
	{:else if placement}
		<p class="mt-4 text-xs text-surface-500">
			{placement.day.date > today
				? `Scheduled for ${WEEKDAY_LABELS[placement.day.weekday]}. You can tick it off on the day.`
				: 'This week has closed, so it can no longer be ticked off.'}
		</p>
	{:else}
		<p class="mt-4 text-xs text-surface-500">
			This session belongs to another week of the block. It can be ticked off in the week it falls
			in.
		</p>
	{/if}

	{#if scaled && (adjust !== 1 || (week && week.intensity_modifier !== 1))}
		<p class="mt-4 text-xs text-surface-500">
			Everything shown already includes
			{#if week && week.intensity_modifier !== 1}
				week {session.week_number}'s
				{week.intensity_modifier < 1 ? 'reduction' : 'increase'} of
				{Math.abs(Math.round((week.intensity_modifier - 1) * 100))}%{adjust !== 1 ? ' and' : '.'}
			{/if}
			{#if adjust !== 1}
				the {Math.round((1 - adjust) * 100)}% masters reduction.
			{/if}
		</p>
	{/if}

	<!--
		Where the beats came from, said out loud. A player who knows their own
		maximum needs to be told these are not it, and a player who does not needs
		to know the percentage is the part to train to.
	-->
	{#if showsHeartRate && profile}
		<p class="mt-2 text-xs text-surface-500">{describeMaxHrBasis(profile, today)}</p>
	{/if}
{/if}
