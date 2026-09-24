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
	import { SKILL_CATEGORY_LABELS, type RepLog } from '$lib/types';
	import { addDays, localDate } from '$lib/util/time';

	const today = localDate();
	const WINDOWS = [7, 28, 90] as const;

	let windowDays = $state<(typeof WINDOWS)[number]>(28);
	let logs = $state<RepLog[]>([]);
	let loading = $state(true);

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
