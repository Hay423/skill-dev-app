<script lang="ts">
	import { page } from '$app/state';
	import SupervisionNote from '$lib/components/SupervisionNote.svelte';
	import { repo } from '$lib/data';
	import {
		describeProgramShape,
		describeQualities,
		PHASE_LABELS,
		SESSION_TYPE_LABELS,
		sessionsForWeek
	} from '$lib/domain/program-plan';
	import { describeExclusion, isEligible, type RecommendationContext } from '$lib/domain/recommend';
	import { programWeekOn } from '$lib/domain/schedule';
	import {
		EXPERIENCE_LEVEL_LABELS,
		type PlayerProfile,
		type PositionProfile,
		type ProgramEnrolment,
		type ProgramPlan
	} from '$lib/types';
	import { localDate } from '$lib/util/time';

	const today = localDate();

	let plan = $state<ProgramPlan | undefined>(undefined);
	let profile = $state<PlayerProfile | undefined>(undefined);
	let positions = $state<PositionProfile[]>([]);
	let enrolment = $state<ProgramEnrolment | undefined>(undefined);
	let loading = $state(true);
	let working = $state(false);
	let openWeek = $state(1);

	$effect(() => {
		const slug = page.params.slug;
		loading = true;
		Promise.all([
			slug ? repo.getProgramPlanBySlug(slug) : Promise.resolve(undefined),
			repo.getProfile(),
			repo.listPositions(),
			repo.activeEnrolments()
		])
			.then(([p, prof, pos, live]) => {
				plan = p;
				profile = prof;
				positions = pos;
				enrolment = p ? live.find((e) => e.program_id === p.program.id) : undefined;
				openWeek = currentWeek ?? 1;
			})
			.finally(() => (loading = false));
	});

	const context = $derived<RecommendationContext | null>(
		profile ? { profile, positions, today } : null
	);

	/**
	 * The age gate runs here too, not only in the recommendation list.
	 *
	 * A program the player is too young for must be unreachable by *any* route —
	 * a typed URL, a stale link, a bookmark kept after a birthday was corrected
	 * downward. Filtering the list alone would leave the content one address bar
	 * away, and that is exactly the failure the gate exists to prevent.
	 */
	const eligibility = $derived(
		plan && context ? isEligible(plan.program, context) : ({ eligible: true } as const)
	);

	const isEnrolled = $derived(enrolment !== undefined);

	/**
	 * Which week the block is up to, read from the calendar rather than a stored
	 * counter: week 1 is the week you started, and every Monday moves it on.
	 */
	const currentWeek = $derived(enrolment ? programWeekOn(enrolment, today) : null);

	async function enrol() {
		if (!plan) return;
		working = true;
		try {
			enrolment = await repo.enrol(plan.program.id);
			openWeek = programWeekOn(enrolment, today);
		} finally {
			working = false;
		}
	}

	async function leave() {
		if (!enrolment) return;
		working = true;
		try {
			await repo.abandonEnrolment(enrolment.id);
			enrolment = undefined;
		} finally {
			working = false;
		}
	}
</script>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if !plan}
	<p class="text-sm text-surface-600-400">
		Program not found. <a class="underline" href="/train">Back to training</a>
	</p>
{:else if !eligibility.eligible}
	<header class="mb-4">
		<a href="/train" class="text-sm text-surface-600-400">← Train</a>
		<h1 class="mt-2 text-2xl font-bold">{plan.program.name}</h1>
	</header>
	<div class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4">
		<p class="text-sm">
			This program is not available to you — {describeExclusion(eligibility.reason)}.
		</p>
		{#if eligibility.reason.kind === 'junior_strength'}
			<p class="mt-2 text-sm text-surface-600-400">
				Running and skills work build far more at your age, and they carry none of the risk of
				lifting without supervision.
			</p>
		{/if}
		<a href="/train" class="mt-3 inline-block text-xs font-medium text-primary-500">
			See what is available →
		</a>
	</div>
{:else}
	<header class="mb-4">
		<a href="/train" class="text-sm text-surface-600-400">← Train</a>
		<h1 class="mt-2 text-2xl font-bold">{plan.program.name}</h1>
		<p class="mt-1 text-sm text-surface-600-400">{plan.program.summary}</p>
		<p class="mt-2 flex flex-wrap gap-x-2 text-xs text-surface-500">
			<span>{describeProgramShape(plan.program)}</span>
			<span aria-hidden="true">·</span>
			<span>{describeQualities(plan.program)}</span>
		</p>
		<p class="mt-1 text-xs text-surface-500">
			{plan.program.experience.map((e) => EXPERIENCE_LEVEL_LABELS[e]).join(', ')}
		</p>
	</header>

	{#if plan.program.discipline === 'strength'}
		<div class="mb-4"><SupervisionNote /></div>
	{/if}

	{#if isEnrolled && currentWeek}
		<div class="mb-4 rounded-xl border border-primary-500 bg-surface-100-900 p-3">
			<p class="text-xs tracking-wide text-primary-500 uppercase">You are up to</p>
			<p class="mt-1 font-semibold">Week {currentWeek} of {plan.program.weeks}</p>
			<p class="mt-1 text-xs text-surface-500">
				The week moves on with the calendar, every Monday. Your sessions for this week are on
				<a href="/train" class="text-primary-500">the week plan</a>.
			</p>
			<button
				type="button"
				onclick={leave}
				disabled={working}
				class="tap-target preset-outlined-surface-200-800 mt-3 w-full rounded-xl py-2 text-sm disabled:opacity-40"
			>
				Leave this program
			</button>
		</div>
	{:else}
		<button
			type="button"
			onclick={enrol}
			disabled={working}
			class="tap-target preset-filled-primary-500 mb-4 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
		>
			{working ? 'Starting…' : 'Start this program'}
		</button>
	{/if}

	<section>
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Week by week
		</h2>
		<ul class="space-y-2">
			{#each plan.weeks as week (week.week_number)}
				{@const sessions = sessionsForWeek(plan, week.week_number)}
				<li
					class="rounded-xl border bg-surface-100-900 {week.week_number === currentWeek
						? 'border-primary-500'
						: 'border-surface-200-800'}"
				>
					<button
						type="button"
						onclick={() => (openWeek = openWeek === week.week_number ? 0 : week.week_number)}
						class="tap-target flex w-full items-center justify-between gap-3 p-3 text-left"
						aria-expanded={openWeek === week.week_number}
					>
						<span class="min-w-0">
							<span class="block font-medium">Week {week.week_number}</span>
							<span class="block text-xs text-surface-600-400">{week.focus}</span>
						</span>
						<span class="flex shrink-0 items-center gap-2">
							{#if week.is_deload}
								<span class="rounded-full preset-tonal-surface px-2 py-0.5 text-xs">Deload</span>
							{/if}
							<span class="text-surface-500" aria-hidden="true">
								{openWeek === week.week_number ? '▾' : '▸'}
							</span>
						</span>
					</button>

					{#if openWeek === week.week_number}
						<ul class="border-t border-surface-200-800 p-2">
							{#each sessions as session (session.id)}
								<li>
									<a
										href="/train/{plan.program.slug}/{session.id}"
										class="tap-target flex items-center justify-between gap-3 rounded-xl px-2 py-2 active:bg-surface-200-800"
									>
										<span class="min-w-0">
											<span class="block text-sm font-medium">{session.name}</span>
											<span class="block text-xs text-surface-500">
												{SESSION_TYPE_LABELS[session.type]} · {session.duration_minutes} min
											</span>
										</span>
										<span class="shrink-0 text-surface-500" aria-hidden="true">→</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<p class="mt-4 text-xs text-surface-500">
		{PHASE_LABELS[plan.program.phase]} block. Weeks marked deload are deliberately lighter — they are
		part of the program, not a week off.
	</p>
{/if}
