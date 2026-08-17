<script lang="ts">
	import StatCard from '$lib/components/StatCard.svelte';
	import { repo } from '$lib/data';
	import { currentStreak, formatAccuracy, totals, totalsByCategory } from '$lib/domain/stats';
	import { SKILL_CATEGORY_LABELS, type RepLog } from '$lib/types';
	import { addDays, localDate } from '$lib/util/time';

	const today = localDate();

	let allLogs = $state<RepLog[]>([]);
	let loading = $state(true);

	$effect(() => {
		// A 90-day window covers the streak and every summary on this page
		// without pulling the entire history into memory.
		repo
			.listRepLogs({ from: addDays(today, -90) })
			.then((logs) => (allLogs = logs))
			.finally(() => (loading = false));
	});

	const todayLogs = $derived(allLogs.filter((l) => l.local_date === today));
	const todayTotals = $derived(totals(todayLogs));
	const streak = $derived(currentStreak(allLogs, today));
	const byCategory = $derived(totalsByCategory(todayLogs));
</script>

<header class="mb-4">
	<h1 class="text-2xl font-bold">Today</h1>
	<p class="text-sm text-surface-600-400">
		{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
	</p>
</header>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else}
	<div class="grid grid-cols-3 gap-2">
		<StatCard label="Streak" value={streak} hint={streak === 1 ? 'day' : 'days'} />
		<StatCard label="Reps" value={todayTotals.attempts} hint="today" />
		<StatCard label="Accuracy" value={formatAccuracy(todayTotals.accuracy)} hint="today" />
	</div>

	<div class="mt-4 grid grid-cols-2 gap-2">
		<a
			href="/log"
			class="tap-target preset-filled-primary-500 flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
		>
			Log reps
		</a>
		<a
			href="/drills"
			class="tap-target preset-outlined-surface-200-800 flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
		>
			Browse drills
		</a>
	</div>

	<section class="mt-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Today by skill
		</h2>
		{#if byCategory.length === 0}
			<p
				class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center text-sm text-surface-500"
			>
				Nothing logged yet today. Twenty kicks is enough to keep the streak.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each byCategory as row (row.category)}
					<li class="flex items-center gap-3 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
						<div class="min-w-0 flex-1">
							<p class="font-medium">{SKILL_CATEGORY_LABELS[row.category]}</p>
							<p class="text-xs text-surface-600-400">
								{row.successes} / {row.attempts}
							</p>
						</div>
						<span class="text-lg font-semibold tabular-nums">{formatAccuracy(row.accuracy)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
