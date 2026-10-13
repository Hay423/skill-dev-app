<script lang="ts">
	import { drillTitle } from '$lib/domain/drills';
	import { SESSION_TYPE_LABELS } from '$lib/domain/program-plan';
	import { canBrowseTo, weekProgress, type PlannedDay } from '$lib/domain/schedule';
	import { repo } from '$lib/data';
	import AffirmationCard from '$lib/components/AffirmationCard.svelte';
	import { loadAffirmation } from '$lib/affirm';
	import type { Affirmation } from '$lib/domain/affirmations';
	import { SKILL_CATEGORY_LABELS, WEEKDAY_LABELS, type IsoDate } from '$lib/types';
	import { addDays, startOfWeek } from '$lib/util/time';

	interface Props {
		days: PlannedDay[];
		today: IsoDate;
		/** Monday of the week being shown. */
		monday: IsoDate;
		/** The weeks that can be browsed, or null when no block is running. */
		range?: { from: IsoDate; to: IsoDate } | null;
		/** Re-run after a tick so the strip, the streak and Today all agree. */
		onchange?: () => void;
		/** Show a different week. Absent when the caller does not support browsing. */
		onbrowse?: (monday: IsoDate) => void;
	}

	let { days, today, monday, range = null, onchange, onbrowse }: Props = $props();

	/**
	 * Browsing is bounded by the blocks actually running, and the arrows are
	 * disabled rather than hidden at the ends — a control that vanishes leaves
	 * the player wondering whether they did something wrong.
	 */
	const canGoBack = $derived(onbrowse !== undefined && canBrowseTo(addDays(monday, -7), range));
	const canGoForward = $derived(onbrowse !== undefined && canBrowseTo(addDays(monday, 7), range));
	const showingThisWeek = $derived(monday === startOfWeek(today));

	function browse(delta: number) {
		onbrowse?.(addDays(monday, delta * 7));
	}

	/** A week's dates as "15–21 Sep", so a browsed week says which one it is. */
	const weekLabel = $derived.by(() => {
		const [y, m, d] = monday.split('-').map(Number);
		const start = new Date(y, m - 1, d);
		const end = new Date(y, m - 1, d + 6);
		const month = (date: Date) => date.toLocaleDateString('en-AU', { month: 'short' });
		const same = start.getMonth() === end.getMonth();
		return same
			? `${start.getDate()}–${end.getDate()} ${month(end)}`
			: `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
	});

	let selected = $state<IsoDate | null>(null);
	let working = $state<string | null>(null);
	let shown = $state<Affirmation | null>(null);

	// Defaults to today, and follows it if the week being shown changes.
	const current = $derived(
		days.find((d) => d.date === selected) ?? days.find((d) => d.isToday) ?? days[0]
	);

	const progress = $derived(weekProgress(days));

	/**
	 * Marking a session done from the strip ticks every exercise in it, and
	 * unmarking clears them. The two states cannot disagree that way: a session
	 * is done exactly when its exercises are.
	 */
	async function toggleSession(day: PlannedDay, index: number) {
		const scheduled = day.sessions[index];
		const wasDone = scheduled.done;
		working = scheduled.session.id;
		try {
			const done = !wasDone;
			await repo.logSessionProgress({
				enrolment_id: scheduled.enrolment_id,
				program_session_id: scheduled.session.id,
				local_date: day.date,
				completed_item_ids: done ? scheduled.item_ids : [],
				completed: done
			});

			// Only on the way to done, not on an undo — the affirmation is for
			// finishing something, not for correcting a mis-tap.
			if (done && !wasDone) {
				const before = weekProgress(days);
				shown = await loadAffirmation({
					kind: 'session',
					session_name: scheduled.session.name,
					session_type: scheduled.session.type,
					program_name: scheduled.program.name,
					week_number: scheduled.week?.week_number ?? 1,
					total_weeks: scheduled.program.weeks,
					is_deload: scheduled.week?.is_deload ?? false,
					done_this_week: before.done + 1,
					sessions_this_week: before.sessions
				});
			}

			onchange?.();
		} finally {
			working = null;
		}
	}

	function dayState(day: PlannedDay): 'done' | 'session' | 'retest' | 'skills' | 'rest' {
		// A due retest outranks a session in the strip: it is the one thing in the
		// week that cannot be made up later without costing the comparison.
		if (day.retest) return 'retest';
		if (day.sessions.length > 0) {
			return day.sessions.every((s) => s.done) ? 'done' : 'session';
		}
		if (day.loggedReps) return 'done';
		if (day.skills) return 'skills';
		return 'rest';
	}
</script>

{#if days.length > 0}
	<section class="mb-6">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
				{showingThisWeek ? 'This week' : weekLabel}
			</h2>
			{#if progress.sessions > 0}
				<span class="shrink-0 text-xs text-surface-500">
					{progress.done} of {progress.sessions} done
				</span>
			{/if}
		</div>

		{#if onbrowse}
			<div class="mb-2 flex items-center gap-2">
				<button
					type="button"
					onclick={() => browse(-1)}
					disabled={!canGoBack}
					aria-label="Previous week"
					class="tap-target preset-outlined-surface-200-800 rounded-xl px-3 disabled:opacity-30"
				>
					←
				</button>
				<button
					type="button"
					onclick={() => onbrowse?.(startOfWeek(today))}
					disabled={showingThisWeek}
					class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-xs disabled:opacity-30"
				>
					{showingThisWeek ? 'This week' : 'Back to this week'}
				</button>
				<button
					type="button"
					onclick={() => browse(1)}
					disabled={!canGoForward}
					aria-label="Next week"
					class="tap-target preset-outlined-surface-200-800 rounded-xl px-3 disabled:opacity-30"
				>
					→
				</button>
			</div>
		{/if}

		<!-- Seven columns at 390px leaves about 50px each: one letter, one dot. -->
		<div class="flex gap-1">
			{#each days as day (day.date)}
				{@const state = dayState(day)}
				<button
					type="button"
					onclick={() => (selected = day.date)}
					aria-current={day.date === current?.date ? 'date' : undefined}
					class="tap-target flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 {day.date ===
					current?.date
						? 'border-primary-500 bg-surface-100-900'
						: 'border-surface-200-800'}"
				>
					<span
						class="text-[11px] {day.isToday
							? 'font-bold text-primary-500'
							: 'text-surface-600-400'}"
					>
						{WEEKDAY_LABELS[day.weekday].slice(0, 1)}
					</span>
					<span
						class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] {state ===
						'done'
							? 'preset-filled-primary-500'
							: state === 'retest'
								? 'border-2 border-primary-500'
								: state === 'session'
									? 'preset-tonal-primary'
									: state === 'skills'
										? 'border border-dashed border-surface-300-700'
										: ''}"
						aria-hidden="true"
					>
						{#if state === 'done'}✓{:else if state === 'retest'}◎{:else if state === 'session'}{day
								.sessions.length}{/if}
					</span>
				</button>
			{/each}
		</div>

		{#if progress.doubledUp > 0}
			<p class="mt-2 text-xs text-surface-500">
				{progress.doubledUp === 1 ? 'One day carries' : `${progress.doubledUp} days carry`} two sessions
				— you train fewer days than your programs ask for. Add a day in your profile to spread them out.
			</p>
		{/if}

		{#if current}
			<div class="mt-3">
				<p class="mb-2 text-xs tracking-wide text-surface-600-400 uppercase">
					{WEEKDAY_LABELS[current.weekday]}{current.isToday ? ' · today' : ''}
				</p>

				{#if current.retest}
					<a
						href="/tests"
						class="tap-target mb-2 block rounded-xl border border-primary-500 bg-surface-100-900 p-3"
					>
						<div class="flex items-baseline justify-between gap-3">
							<span class="font-semibold">
								{current.retest.round === 1
									? 'Baseline testing'
									: `Round ${current.retest.round} retest`}
							</span>
							<span class="shrink-0 text-xs tabular-nums text-surface-500">
								{current.retest.done} of {current.retest.total}
							</span>
						</div>
						<span class="mt-1 block text-xs text-surface-500">
							{current.retest.outstanding.map((p) => p.name).join(' · ')}
						</span>
					</a>
				{/if}

				{#if current.sessions.length > 0}
					<ul class="space-y-2">
						{#each current.sessions as scheduled, index (scheduled.session.id)}
							<li
								class="flex items-stretch gap-2 rounded-xl border border-surface-200-800 bg-surface-100-900"
							>
								<a
									href="/train/{scheduled.program.slug}/{scheduled.session.id}"
									class="tap-target min-w-0 flex-1 p-3 active:bg-surface-200-800"
								>
									<span class="block font-medium {scheduled.done ? 'line-through opacity-60' : ''}">
										{scheduled.session.name}
									</span>
									<span class="block text-xs text-surface-500">
										{scheduled.program.name} · {SESSION_TYPE_LABELS[scheduled.session.type]} · {scheduled
											.session.duration_minutes} min
									</span>
									{#if scheduled.item_ids.length > 0 && !scheduled.done}
										<span class="block text-xs text-surface-500">
											{scheduled.ticked} of {scheduled.item_ids.length} exercises ticked
										</span>
									{/if}
								</a>
								<button
									type="button"
									onclick={() => toggleSession(current, index)}
									disabled={!current.tickable || working === scheduled.session.id}
									aria-pressed={scheduled.done}
									aria-label="{scheduled.done ? 'Undo' : 'Mark done'}: {scheduled.session.name}"
									class="tap-target w-14 shrink-0 rounded-r-xl border-l border-surface-200-800 text-lg disabled:opacity-30 {scheduled.done
										? 'text-primary-500'
										: 'text-surface-500'}"
								>
									{scheduled.done ? '✓' : '○'}
								</button>
							</li>
						{/each}
					</ul>
					{#if !current.tickable}
						<p class="mt-2 text-xs text-surface-500">
							{current.date > today
								? 'Still to come — you can tick this off on the day.'
								: 'This week has closed. Past weeks stay as they were.'}
						</p>
					{/if}
				{:else if current.skills}
					<div class="rounded-xl border border-dashed border-surface-200-800 p-3">
						<p class="text-xs tracking-wide text-surface-500 uppercase">Optional</p>
						<p class="mt-1 font-medium">
							{SKILL_CATEGORY_LABELS[current.skills.category]}
							{#if current.skills.drill}
								· {current.skills.drill.duration_minutes} min
							{/if}
						</p>
						{#if current.skills.drill}
							<p class="mt-1 text-sm text-surface-600-400">{drillTitle(current.skills.drill)}</p>
							<div class="mt-3 flex gap-2">
								<a
									href="/drills/{current.skills.drill.slug}"
									class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-center text-sm"
								>
									Open drill
								</a>
								<a
									href="/log?drill={current.skills.drill.slug}"
									class="tap-target preset-filled-primary-500 flex-1 rounded-xl py-2 text-center text-sm font-semibold"
								>
									Log reps
								</a>
							</div>
						{/if}
						{#if current.loggedReps}
							<p class="mt-2 text-xs text-primary-500">✓ Reps logged</p>
						{/if}
					</div>
				{:else if !current.retest}
					<!-- A retest-only day is scheduled, so it must not also read as empty. -->
					<p
						class="rounded-xl border border-dashed border-surface-200-800 p-4 text-center text-sm text-surface-500"
					>
						{current.available ? 'Nothing scheduled.' : 'Rest day.'}
					</p>
				{/if}
			</div>
		{/if}

		{#if shown}
			<div class="mt-3">
				<AffirmationCard affirmation={shown} ondismiss={() => (shown = null)} />
			</div>
		{/if}
	</section>
{/if}
