<script lang="ts">
	import { loadTestPhase } from '$lib/skill-tests';
	import {
		biggestMover,
		roundComparison,
		testTrend,
		weakestDimension,
		type RoundComparison
	} from '$lib/domain/retest';
	import { formatGain, formatScoreLine, scoreLine } from '$lib/domain/tests';
	import { formatAccuracy } from '$lib/domain/stats';

	const loading = loadTestPhase();

	/** Which round is being shown. Defaults to the latest once loaded. */
	let selected = $state<number | null>(null);

	function headline(comparison: RoundComparison): string {
		if (!comparison.previous)
			return 'Your starting point. Everything after this is measured on it.';
		const { improved, declined, tests } = comparison;
		if (improved === 0 && declined === 0) return 'Held steady across the board.';
		if (improved === tests.length) return 'Up on every test.';
		if (improved > 0) return `Up on ${improved} of ${tests.length}.`;
		return 'Down this round. One round is a day, not a trend.';
	}
</script>

<header class="mb-4">
	<a href="/tests" class="text-xs font-medium text-primary-500">← Tests</a>
	<h1 class="mt-1 text-2xl font-bold">Improvement</h1>
	<p class="text-sm text-surface-600-400">Each round against the one before it.</p>
</header>

{#await loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:then { cycle, results, protocols }}
	{#if !cycle || cycle.rounds.length === 0}
		<div class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center">
			<p class="text-sm text-surface-600-400">
				Nothing to compare yet. Sit your baseline and this fills in — properly after the second
				round, when there are two snapshots to hold against each other.
			</p>
			<a
				href="/tests"
				class="tap-target preset-filled-primary-500 mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
			>
				Go to tests
			</a>
		</div>
	{:else}
		{@const number = selected ?? cycle.rounds[cycle.rounds.length - 1].number}
		{@const index = cycle.rounds.findIndex((r) => r.number === number)}
		{@const comparison = roundComparison(
			cycle.rounds[index],
			cycle.rounds[index - 1],
			results,
			protocols
		)}

		{#if cycle.rounds.length > 1}
			<!-- Round picker, same shape as the window chips on Progress. -->
			<div class="mb-4 flex gap-2 overflow-x-auto pb-1">
				{#each cycle.rounds as round (round.number)}
					<button
						type="button"
						onclick={() => (selected = round.number)}
						class="shrink-0 rounded-full border px-3 py-1.5 text-sm {round.number === number
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-200-800'}"
					>
						R{round.number}
					</button>
				{/each}
			</div>
		{/if}

		<section class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4">
			<div class="flex items-baseline justify-between gap-3">
				<p class="text-xs tracking-wide text-surface-600-400 uppercase">
					Round {number}{comparison.previous ? ` vs round ${comparison.previous.number}` : ''}
				</p>
				{#if comparison.overall !== null}
					<p
						class="shrink-0 text-lg font-semibold tabular-nums {comparison.overall > 0
							? 'text-primary-500'
							: ''}"
					>
						{formatGain(comparison.overall)}
					</p>
				{/if}
			</div>
			<p class="mt-1 text-sm">{headline(comparison)}</p>
			<p class="mt-1 text-xs text-surface-500">
				{comparison.round.started_on}{comparison.round.completed_on &&
				comparison.round.completed_on !== comparison.round.started_on
					? ` – ${comparison.round.completed_on}`
					: ''}
				{#if !comparison.round.complete}
					· part-done, {comparison.round.missing.length} still to sit
				{/if}
			</p>
			{#if comparison.overall !== null}
				<p class="mt-2 text-xs text-surface-500">
					The overall figure is the average of the per-test changes, not a total — the tests score
					out of different numbers, so adding the points would let goalkicking decide it.
				</p>
			{/if}
		</section>

		{#each comparison.tests as change (change.protocol.id)}
			{@const mover = biggestMover(change.movements)}
			{@const gap = weakestDimension(change.movements)}
			{@const trend = testTrend(change.protocol, cycle.rounds.slice(0, index + 1))}
			<section class="mt-4 rounded-xl border border-surface-200-800 bg-surface-100-900 p-4">
				<div class="flex items-baseline justify-between gap-3">
					<h2 class="min-w-0 font-semibold">{change.protocol.name}</h2>
					<span class="shrink-0 font-semibold tabular-nums">
						{#if change.protocol.scoring === 'goal_behind_miss'}
							{formatScoreLine(scoreLine(change.result))}
						{:else}
							{change.score.total}{change.score.max === null ? '' : `/${change.score.max}`}
						{/if}
					</span>
				</div>

				<p class="mt-1 text-sm">
					{#if change.previous && change.change !== null}
						<span class={change.improved ? 'text-primary-500' : 'text-surface-600-400'}>
							{formatGain(change.change)} on round {comparison.previous?.number}
						</span>
						<span class="text-surface-500">
							· was {change.previous_score?.total}{change.previous_score?.max === null
								? ''
								: `/${change.previous_score?.max}`}
						</span>
						{#if change.previous.estimated === 1}
							<span class="text-surface-500"> · estimated from your junior tier</span>
						{/if}
					{:else}
						<span class="text-surface-500">First time on this test.</span>
					{/if}
				</p>

				{#if change.baseline_change !== null}
					<p class="mt-0.5 text-xs text-surface-500">
						{formatGain(change.baseline_change)} on your very first result
					</p>
				{/if}

				{#if trend.length > 1}
					<!--
						A bare bar per round. The shape is the point; exact values are in
						the rows below, so this carries no axes to read.
					-->
					{@const peak = Math.max(...trend.map((p) => p.total), 1)}
					<div class="mt-3 flex h-10 items-end gap-1" aria-hidden="true">
						{#each trend as point (point.round)}
							<div
								class="flex-1 rounded-t {point.round === number
									? 'bg-primary-500'
									: 'bg-surface-200-800'}"
								style="height: {Math.max(8, (point.total / peak) * 100)}%"
								title="Round {point.round}: {point.total}"
							></div>
						{/each}
					</div>
					<p class="mt-1 text-xs text-surface-500">
						Rounds 1–{trend[trend.length - 1].round}
					</p>
				{/if}

				{#if change.movements.length > 0}
					<ul class="mt-3 space-y-1">
						{#each change.movements as movement (movement.label)}
							<li class="flex items-center gap-2 text-sm">
								<span class="min-w-0 flex-1 truncate capitalize text-surface-600-400">
									{movement.label}
								</span>
								<span class="shrink-0 tabular-nums">
									{#if movement.previous_total !== null}
										<span class="text-surface-500">{movement.previous_total} →</span>
									{/if}
									{movement.total}/{movement.max}
								</span>
								<span
									class="w-8 shrink-0 text-right text-xs tabular-nums {movement.delta === null ||
									movement.delta === 0
										? 'text-surface-500'
										: movement.delta > 0
											? 'text-primary-500'
											: 'text-error-500'}"
								>
									{#if movement.delta === null}
										—
									{:else if movement.delta === 0}
										·
									{:else}
										{movement.delta > 0 ? '+' : '−'}{Math.abs(movement.delta)}
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				<!--
					The two lines that turn a result into a decision. Separated on
					purpose: what moved is the encouragement, the gap is the instruction.
				-->
				{#if mover && mover.delta !== null}
					<p class="mt-3 text-xs text-primary-500">
						Biggest gain: {mover.label}, up {mover.delta}.
					</p>
				{/if}
				{#if gap}
					<p class="mt-0.5 text-xs text-surface-500">
						Still the gap: {gap.label}, {formatAccuracy(gap.accuracy)}.
					</p>
				{/if}
			</section>
		{/each}

		<p class="mt-6 text-xs text-surface-500">
			Self-scored, and compared only with yourself. A single round is one day's form — two rounds in
			the same direction is a trend.
		</p>
	{/if}
{:catch error}
	<p class="text-sm text-error-500">Could not load your rounds: {error.message}</p>
{/await}
