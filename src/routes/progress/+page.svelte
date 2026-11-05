<script lang="ts">
	import StatCard from '$lib/components/StatCard.svelte';
	import { repo } from '$lib/data';
	import {
		accuracyTrend,
		currentStreak,
		dailySeries,
		formatAccuracy,
		totals,
		totalsByCategory
	} from '$lib/domain/stats';
	import { formatGain, rollingBaseline } from '$lib/domain/tests';
	import { daysUntilDue } from '$lib/domain/retest';
	import { SKILL_CATEGORY_LABELS, type RepLog } from '$lib/types';
	import { loadTestPhase, type LoadedTestPhase } from '$lib/skill-tests';
	import { addDays, localDate } from '$lib/util/time';

	const today = localDate();
	const WINDOWS = [7, 28, 90] as const;

	let windowDays = $state<(typeof WINDOWS)[number]>(28);
	let logs = $state<RepLog[]>([]);
	let loading = $state(true);
	let tests = $state<LoadedTestPhase | null>(null);

	// Loaded once, outside the window selector: a test result is a landmark, not
	// something to slice by the last seven days.
	$effect(() => {
		loadTestPhase().then((loaded) => (tests = loaded));
	});

	const testPhase = $derived(tests?.phase ?? null);
	const cycle = $derived(tests?.cycle ?? null);

	/** Each sat test with its latest result measured against the rolling baseline. */
	const testRows = $derived(
		(testPhase?.tests ?? [])
			.filter((test) => test.done)
			.map((test) => {
				const walked = rollingBaseline(test.protocol, test.history);
				return { test, latest: walked.at(-1) };
			})
			.filter((row) => row.latest !== undefined)
	);

	$effect(() => {
		const days = windowDays;
		loading = true;
		repo
			.listRepLogs({ from: addDays(today, -(days - 1)) })
			.then((rows) => (logs = rows))
			.finally(() => (loading = false));
	});

	const summary = $derived(totals(logs));
	const streak = $derived(currentStreak(logs, today));
	const trend = $derived(accuracyTrend(logs, windowDays, today));
	const byCategory = $derived(totalsByCategory(logs));
	const series = $derived(dailySeries(logs, windowDays, today));
	// Bars are scaled against the busiest day so the shape stays readable.
	const peak = $derived(Math.max(1, ...series.map((p) => p.attempts)));
</script>

<header class="mb-3">
	<h1 class="text-2xl font-bold">Progress</h1>
</header>

<div class="mb-4 flex gap-2">
	{#each WINDOWS as days (days)}
		<button
			type="button"
			onclick={() => (windowDays = days)}
			class="flex-1 rounded-full border px-3 py-1.5 text-sm {windowDays === days
				? 'preset-filled-primary-500'
				: 'preset-outlined-surface-200-800'}"
		>
			{days}d
		</button>
	{/each}
</div>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if logs.length === 0}
	<p
		class="rounded-xl border border-dashed border-surface-200-800 p-8 text-center text-sm text-surface-500"
	>
		No reps logged in this window yet.
	</p>
{:else}
	<div class="grid grid-cols-3 gap-2">
		<StatCard label="Reps" value={summary.attempts} />
		<StatCard
			label="Accuracy"
			value={formatAccuracy(summary.accuracy)}
			hint={trend === null ? undefined : `${trend >= 0 ? '+' : ''}${trend.toFixed(0)} pts`}
		/>
		<StatCard label="Streak" value={streak} hint={streak === 1 ? 'day' : 'days'} />
	</div>

	<section class="mt-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Daily volume
		</h2>
		<div
			class="flex h-24 items-end gap-px rounded-xl border border-surface-200-800 bg-surface-100-900 p-2"
		>
			{#each series as point (point.date)}
				<div
					class="flex-1 rounded-t {point.attempts > 0 ? 'bg-primary-500' : 'bg-surface-200-800'}"
					style="height: {point.attempts > 0 ? Math.max(6, (point.attempts / peak) * 100) : 3}%"
					title="{point.date}: {point.attempts} reps"
				></div>
			{/each}
		</div>
	</section>

	<section class="mt-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			By skill
		</h2>
		<ul class="space-y-2">
			{#each byCategory as row (row.category)}
				<li class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
					<div class="flex items-center justify-between">
						<span class="font-medium">{SKILL_CATEGORY_LABELS[row.category]}</span>
						<span class="font-semibold tabular-nums">{formatAccuracy(row.accuracy)}</span>
					</div>
					<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200-800">
						<div
							class="bg-primary-500 h-full rounded-full"
							style="width: {(row.accuracy ?? 0) * 100}%"
						></div>
					</div>
					<p class="mt-1 text-xs text-surface-500">{row.successes} of {row.attempts}</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!--
	Skill tests sit outside the window selector and outside the "no reps logged"
	branch above. A result is a landmark rather than a daily tally, and a player
	who has sat their baseline but not logged a set this week should still see it.
-->
{#if testPhase && !testPhase.blocked}
	<section class="mt-8">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Skill tests
		</h2>

		{#if !testPhase.complete}
			<!--
				Locked, and honest about why. This panel is the one thing the testing
				phase actually gates: an accuracy figure next to nothing is a number,
				and the point of the baseline is to turn it into a comparison.
			-->
			<div class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center">
				<p class="text-sm text-surface-600-400">
					{testPhase.done} of {testPhase.required} tests sat. Finish your baseline and this becomes a
					comparison instead of a number.
				</p>
				<a
					href="/tests"
					class="tap-target preset-filled-primary-500 mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
				>
					Go to tests
				</a>
			</div>
		{:else}
			{@const outstanding = new Set((cycle?.outstanding ?? []).map((p) => p.slug))}
			<ul class="space-y-2">
				{#each testRows as row (row.test.protocol.id)}
					<li class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
						<a href="/tests/{row.test.protocol.slug}" class="tap-target block">
							<div class="flex items-center justify-between gap-3">
								<span class="min-w-0 truncate font-medium">{row.test.protocol.name}</span>
								<span class="shrink-0 font-semibold tabular-nums">
									{row.latest?.score.total}{row.latest?.score.max === null
										? ''
										: `/${row.latest?.score.max}`}
								</span>
							</div>
							<p class="mt-1 text-xs text-surface-500">
								{row.test.latest?.local_date}
								{#if row.latest?.baseline}
									· <span class={row.latest.improved ? 'text-primary-500' : ''}
										>{formatGain(row.latest.gain)} on baseline</span
									>
								{:else}
									· baseline
								{/if}
								{#if outstanding.has(row.test.protocol.slug)}
									· <span class="text-primary-500">due this round</span>
								{/if}
							</p>
						</a>
					</li>
				{/each}
			</ul>

			{#if cycle}
				<a
					href="/tests/rounds"
					class="tap-target preset-outlined-surface-200-800 mt-3 flex items-center justify-center rounded-xl py-2 text-sm font-semibold"
				>
					{cycle.rounds.length > 1
						? `Round-by-round improvement · ${cycle.rounds.length} rounds`
						: 'Round-by-round improvement'}
				</a>
				<p class="mt-2 text-xs text-surface-500">
					{#if cycle.due}
						Round {cycle.current_number} is due now.
					{:else if daysUntilDue(cycle, today) !== null}
						Round {cycle.current_number} in {daysUntilDue(cycle, today)} days.
					{/if}
				</p>
			{/if}

			<p class="mt-3 text-xs text-surface-500">
				Measured against yourself only. There is no published benchmark for your age group and level
				in the app yet, and a borrowed one from another group would be worse than none.
			</p>
		{/if}
	</section>
{/if}
