<script lang="ts">
	import { repo } from '$lib/data';
	import AffirmationCard from '$lib/components/AffirmationCard.svelte';
	import { loadAffirmation } from '$lib/affirm';
	import type { Affirmation } from '$lib/domain/affirmations';
	import { drillTitle } from '$lib/domain/drills';
	import { SESSION_TYPE_LABELS } from '$lib/domain/program-plan';
	import { dayOf, weekProgress, type PlannedDay } from '$lib/domain/schedule';
	import { SKILL_CATEGORY_LABELS, type IsoDate } from '$lib/types';

	interface Props {
		days: PlannedDay[];
		today: IsoDate;
		onchange?: () => void;
	}

	let { days, today, onchange }: Props = $props();

	let working = $state<string | null>(null);
	let shown = $state<Affirmation | null>(null);

	const day = $derived<PlannedDay | undefined>(dayOf(days, today));

	async function toggle(index: number) {
		if (!day) return;
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
</script>

<!--
	Today's row of the week plan, and only today's. The full week lives on Train;
	what belongs on the launch screen is the one question a player opens the app
	to ask — what am I doing right now.
-->
{#if day && (day.sessions.length > 0 || day.skills || day.retest)}
	<section class="mt-6">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-semibold tracking-wide text-surface-600-400 uppercase">On today</h2>
			<a href="/train" class="shrink-0 text-xs font-medium text-primary-500">Week</a>
		</div>

		{#if day.retest}
			<!--
				First in the day, ahead of the session. The test is the measurement
				everything else gets judged by, and it wants fresh legs.
			-->
			<a
				href="/tests"
				class="tap-target mb-2 block rounded-xl border border-primary-500 bg-surface-100-900 p-3"
			>
				<div class="flex items-baseline justify-between gap-3">
					<span class="font-semibold">
						{day.retest.round === 1 ? 'Baseline testing' : `Round ${day.retest.round} retest`}
					</span>
					<span class="shrink-0 text-xs tabular-nums text-surface-500">
						{day.retest.done} of {day.retest.total}
					</span>
				</div>
				<span class="mt-1 block text-xs text-surface-500">
					{day.retest.outstanding.map((p) => p.name).join(' · ')}
				</span>
				{#if day.retest.overdue}
					<span class="mt-1 block text-xs text-primary-500">Overdue — sit it when you can</span>
				{/if}
			</a>
		{/if}

		{#if day.sessions.length > 0}
			<ul class="space-y-2">
				{#each day.sessions as scheduled, index (scheduled.session.id)}
					<li
						class="flex items-stretch gap-2 rounded-xl border bg-surface-100-900 {scheduled.done
							? 'border-surface-200-800'
							: 'border-primary-500'}"
					>
						<a
							href="/train/{scheduled.program.slug}/{scheduled.session.id}"
							class="tap-target min-w-0 flex-1 p-3 active:bg-surface-200-800"
						>
							<span class="block font-semibold {scheduled.done ? 'line-through opacity-60' : ''}">
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
							onclick={() => toggle(index)}
							disabled={working === scheduled.session.id}
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
		{:else if day.skills}
			<div class="rounded-xl border border-dashed border-surface-200-800 p-3">
				<p class="text-xs tracking-wide text-surface-500 uppercase">
					No program session — optional skills
				</p>
				<p class="mt-1 font-semibold">
					{day.skills.drill
						? drillTitle(day.skills.drill)
						: SKILL_CATEGORY_LABELS[day.skills.category]}
				</p>
				{#if day.skills.drill}
					<p class="mt-1 text-sm text-surface-600-400">{day.skills.drill.summary}</p>
					<div class="mt-3 flex gap-2">
						<a
							href="/drills/{day.skills.drill.slug}"
							class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-center text-sm"
						>
							Open drill
						</a>
						<a
							href="/log?drill={day.skills.drill.slug}"
							class="tap-target preset-filled-primary-500 flex-1 rounded-xl py-2 text-center text-sm font-semibold"
						>
							Log reps
						</a>
					</div>
				{/if}
				{#if day.loggedReps}
					<p class="mt-2 text-xs text-primary-500">✓ Reps logged today</p>
				{/if}
			</div>
		{/if}
	</section>
{/if}
