<script lang="ts">
	import { loadTestPhase } from '$lib/skill-tests';
	import { groupByFamily } from '$lib/domain/tests';
	import { daysUntilDue } from '$lib/domain/retest';
	import { EQUIPMENT_ACCESS_LABELS, TEST_FAMILY_LABELS } from '$lib/types';

	const loading = loadTestPhase();
</script>

<header class="mb-4">
	<h1 class="text-2xl font-bold">Tests</h1>
	<p class="text-sm text-surface-600-400">
		The same four protocols, every four weeks. Same rules every time, so the numbers mean something.
	</p>
</header>

{#await loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:then { phase, cycle, today }}
	{#if !phase || !cycle}
		<div class="rounded-xl border border-dashed border-surface-200-800 p-6 text-center">
			<p class="text-sm text-surface-600-400">
				Set up your profile first — the kicking test has a junior and a senior version, and your age
				group picks which one you sit.
			</p>
			<a
				href="/onboarding"
				class="tap-target preset-filled-primary-500 mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
			>
				Start onboarding
			</a>
		</div>
	{:else}
		{@const outstanding = new Set(cycle.outstanding.map((p) => p.slug))}
		{@const listed = phase.tests.filter((t) => t.available)}
		{@const days = daysUntilDue(cycle, today)}
		<!--
			Which round each test was last sat in. Rounds come oldest first, so the
			later entry for a slug wins and the map ends up holding the most recent.
		-->
		{@const lastRoundOf = new Map(
			cycle.rounds.flatMap((r) => r.results.map((x) => [x.protocol_slug, r.number]))
		)}

		<div class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4">
			<div class="flex items-baseline justify-between gap-3">
				<p class="text-xs tracking-wide text-surface-600-400 uppercase">
					{cycle.current_number === 1 ? 'Baseline' : `Round ${cycle.current_number}`}
				</p>
				<p class="shrink-0 text-sm font-semibold tabular-nums">
					{listed.length - cycle.outstanding.length} of {listed.length}
				</p>
			</div>
			<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200-800">
				<div
					class="h-full rounded-full bg-primary-500 transition-[width]"
					style="width: {listed.length === 0
						? 0
						: ((listed.length - cycle.outstanding.length) / listed.length) * 100}%"
				></div>
			</div>
			<p class="mt-2 text-xs text-surface-500">
				{#if cycle.current_number === 1 && !cycle.rounds[0]?.complete}
					Until the baseline is complete, there is nothing for progress to compare against.
				{:else if cycle.due}
					Sit the lot and you get a straight comparison with round {cycle.current_number - 1}.
				{:else if days !== null}
					Round {cycle.current_number} comes due in {days} day{days === 1 ? '' : 's'}, on {cycle.due_on}.
				{/if}
			</p>

			{#if cycle.rounds.length > 0}
				<a
					href="/tests/rounds"
					class="tap-target preset-outlined-surface-200-800 mt-3 flex items-center justify-center rounded-xl py-2 text-sm font-semibold"
				>
					{cycle.rounds.length > 1 ? 'Round-by-round improvement' : 'See your baseline'}
				</a>
			{/if}
		</div>

		{#each groupByFamily(phase.tests) as group (group.family)}
			<section class="mt-6">
				<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
					{TEST_FAMILY_LABELS[group.family]}
				</h2>
				<ul class="space-y-2">
					{#each group.tests as test (test.protocol.id)}
						{@const todo = test.available && outstanding.has(test.protocol.slug)}
						<li
							class="rounded-xl border bg-surface-100-900 {todo
								? 'border-primary-500'
								: 'border-surface-200-800'}"
						>
							<a href="/tests/{test.protocol.slug}" class="tap-target block p-3">
								<div class="flex items-baseline justify-between gap-3">
									<span class="min-w-0 font-semibold">{test.protocol.name}</span>
									{#if test.score}
										<span class="shrink-0 font-semibold tabular-nums">
											{test.score.total}{test.score.max === null ? '' : `/${test.score.max}`}
										</span>
									{:else}
										<span class="shrink-0 text-xs text-primary-500">Not sat</span>
									{/if}
								</div>
								<p class="mt-1 text-sm text-surface-600-400">{test.protocol.summary}</p>
								<p class="mt-1 text-xs text-surface-500">
									{test.protocol.duration_minutes} min · {test.protocol.attempts.length > 0
										? `${test.protocol.attempts.length} attempts`
										: `${test.protocol.window_seconds}s window`}
									{#if test.protocol.tier !== 'open'}
										· {test.protocol.tier} tier
									{/if}
								</p>

								{#if test.missing_equipment.length > 0 && !test.done}
									<!--
										A note, not a lock. The profile is a best guess at what
										somebody can get to, and a player standing at a ground they
										never ticked should be able to just do the test.
									-->
									<p class="mt-2 text-xs text-surface-500">
										Needs {test.missing_equipment
											.map((item) => EQUIPMENT_ACCESS_LABELS[item].toLowerCase())
											.join(' and ')} — not ticked on your profile, but go ahead if you have it.
									</p>
								{/if}

								{#if test.seed}
									<p class="mt-2 text-xs text-surface-500">
										Carrying an estimated starting point from your junior result until you sit this
										one.
									</p>
								{/if}

								{#if todo && test.done}
									<p class="mt-2 text-xs text-primary-500">
										Due this round — last sat {test.latest?.local_date}
									</p>
								{:else if !todo && test.done}
									<p class="mt-2 text-xs text-surface-500">
										Round {lastRoundOf.get(test.protocol.slug)} · {test.latest?.local_date}
									</p>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		<p class="mt-6 text-xs text-surface-500">
			Results are yours alone for now. Comparing them against published figures for your age group
			and level is coming — there is no honest benchmark to show you until the numbers behind it
			have been reviewed.
		</p>
	{/if}
{:catch error}
	<p class="text-sm text-error-500">Could not load tests: {error.message}</p>
{/await}
