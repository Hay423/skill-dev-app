<script lang="ts">
	import { EQUIPMENT_ACCESS_LABELS, type IsoDate } from '$lib/types';
	import type { BaselinePhase } from '$lib/domain/tests';
	import { daysUntilDue, type RetestCycle } from '$lib/domain/retest';

	interface Props {
		phase: BaselinePhase;
		cycle: RetestCycle;
		today: IsoDate;
	}

	let { phase, cycle, today }: Props = $props();

	// Only the tests actually within reach are listed. A player with no oval
	// access is not shown a 40 m kicking test as an outstanding chore.
	const listed = $derived(phase.tests.filter((t) => t.available));
	const needed = $derived([...new Set(phase.tests.flatMap((t) => t.missing_equipment))]);

	const outstanding = $derived(new Set(cycle.outstanding.map((p) => p.slug)));
	const next = $derived(cycle.outstanding[0]);
	const isBaseline = $derived(cycle.current_number === 1);
	const days = $derived(daysUntilDue(cycle, today));
</script>

<!--
	The testing phase and the monthly cycle that follows it, on the screen the
	player opens the app to.

	It prompts rather than blocks. A 30-kick test needs an oval and twenty
	minutes, so a hard gate would mean the app does nothing at all for the player
	who opened it indoors at night — and the cost of that is the whole first
	session, not just the test. So the app stays usable and this card stays put
	while a round is outstanding, which is the one thing that makes everything
	downstream of it honest.
-->
{#if phase.blocked}
	<section class="mt-6 rounded-xl border border-dashed border-surface-200-800 p-4">
		<h2 class="text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Baseline testing
		</h2>
		<p class="mt-2 text-sm text-surface-600-400">
			The three skill tests need somewhere to do them — {needed
				.map((item) => EQUIPMENT_ACCESS_LABELS[item].toLowerCase())
				.join(', ')}. Tick what you can get to on your profile and they will show up here.
		</p>
		<a
			href="/profile"
			class="tap-target preset-outlined-surface-200-800 mt-3 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold"
		>
			Update equipment access
		</a>
	</section>
{:else if cycle.due}
	<section class="mt-6 rounded-xl border border-primary-500 bg-surface-100-900 p-4">
		<div class="flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-semibold tracking-wide text-primary-500 uppercase">
				{isBaseline ? 'Baseline testing' : `Round ${cycle.current_number}`}
			</h2>
			<span class="shrink-0 text-xs tabular-nums text-surface-500">
				{listed.length - cycle.outstanding.length} of {listed.length}
			</span>
		</div>

		<p class="mt-1 text-sm text-surface-600-400">
			{#if isBaseline && cycle.outstanding.length === listed.length}
				Three fixed tests, scored by you, with a ball and some cones. They are what every number
				after this is measured against.
			{:else if isBaseline}
				Keep going — the trend only starts once all of them are in.
			{:else if cycle.open}
				Round {cycle.current_number} is part-done. Finish it and you get the comparison with round {cycle.current_number -
					1}.
			{:else}
				Same tests, same rules, {cycle.interval_weeks} weeks on. This is the one that tells you whether
				the training worked.
			{/if}
		</p>

		<ul class="mt-3 space-y-1">
			{#each listed as test (test.protocol.id)}
				{@const todo = outstanding.has(test.protocol.slug)}
				<li class="flex items-center gap-2 text-sm">
					<span
						class="w-4 shrink-0 text-center {todo ? 'text-surface-500' : 'text-primary-500'}"
						aria-hidden="true">{todo ? '○' : '✓'}</span
					>
					<a href="/tests/{test.protocol.slug}" class="min-w-0 flex-1 truncate">
						{test.protocol.name}
					</a>
					{#if !todo && test.score}
						<span class="shrink-0 text-xs tabular-nums text-surface-500">
							{test.score.total}{test.score.max === null ? '' : `/${test.score.max}`}
						</span>
					{/if}
				</li>
			{/each}
		</ul>

		{#if next}
			<a
				href="/tests/{next.slug}"
				class="tap-target preset-filled-primary-500 mt-3 flex items-center justify-center rounded-xl py-3 font-semibold"
			>
				{isBaseline ? 'Start' : 'Retest'}: {next.name}
			</a>
		{/if}
	</section>
{:else if cycle.due_on && days !== null}
	<!--
		Nothing to do, so this is a line rather than a card: when the next round
		lands, and a way into the last one's report. A player who has done
		everything asked of them should not be shown an outstanding-looking box.
	-->
	<section class="mt-6 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
		<div class="flex items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="text-xs tracking-wide text-surface-600-400 uppercase">
					Round {cycle.current_number}
				</p>
				<p class="text-sm">
					Due in {days} day{days === 1 ? '' : 's'} · {cycle.due_on}
				</p>
			</div>
			<a href="/tests/rounds" class="shrink-0 text-xs font-medium text-primary-500"> Last round </a>
		</div>
	</section>
{/if}
