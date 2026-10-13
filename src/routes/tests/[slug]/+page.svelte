<script lang="ts">
	import { page } from '$app/state';
	import { repo } from '$lib/data';
	import { loadTestPhase } from '$lib/skill-tests';
	import AffirmationCard from '$lib/components/AffirmationCard.svelte';
	import TestResultDetail from '$lib/components/TestResultDetail.svelte';
	import { loadAffirmation } from '$lib/affirm';
	import type { Affirmation } from '$lib/domain/affirmations';
	import {
		attemptLabel,
		attemptNoun,
		formatGain,
		rollingBaseline,
		scoreResult,
		type BaselinedResult
	} from '$lib/domain/tests';
	import {
		BEHIND,
		GOAL,
		MISS,
		type TestAttemptResult,
		type TestProtocol,
		type TestResult
	} from '$lib/types';

	const slug = $derived(page.params.slug);

	let protocol = $state<TestProtocol | undefined>(undefined);
	let history = $state<BaselinedResult[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	type Stage = 'brief' | 'running' | 'done';
	let stage = $state<Stage>('brief');

	/** Outcomes in the order they were taken, so Undo is a pop. */
	let outcomes = $state<TestAttemptResult[]>([]);
	let hits = $state(0);
	/** Epoch ms the timed window closes at, or null when it is not running. */
	let deadline = $state<number | null>(null);
	let remaining = $state(0);

	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saved = $state<TestResult | null>(null);
	let savedEntry = $state<BaselinedResult | null>(null);
	let affirmation = $state<Affirmation | null>(null);
	/** The round this result landed in, so the summary can point at the report. */
	let roundNumber = $state<number | null>(null);
	let roundComplete = $state(false);

	async function load(slug: string | undefined) {
		loading = true;
		loadError = null;
		if (!slug) {
			protocol = undefined;
			loading = false;
			return;
		}
		try {
			const found = await repo.getTestProtocolBySlug(slug);
			protocol = found;
			if (found) {
				const rows = await repo.listTestResults({ protocol_slug: found.slug });
				// Newest first for display; `rollingBaseline` sorts the other way
				// itself because the baseline chain is order-dependent.
				history = rollingBaseline(found, rows).reverse();
			}
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Could not load the test';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		// Re-reads when the slug changes, so navigating between two tests does
		// not leave the previous protocol's attempts on screen.
		load(slug);
	});

	// The countdown for a timed test. Driven off a deadline rather than a
	// decremented counter, so a backgrounded tab that stops firing timers comes
	// back with the right time left instead of a clock that paused with it.
	$effect(() => {
		if (deadline === null) return;
		const close = deadline;
		const id = setInterval(() => {
			const left = Math.max(0, Math.ceil((close - Date.now()) / 1000));
			remaining = left;
			if (left === 0) {
				deadline = null;
				void finish();
			}
		}, 100);
		return () => clearInterval(id);
	});

	const timed = $derived(protocol?.scoring === 'timed_hits');
	const nextSpec = $derived(protocol?.attempts[outcomes.length]);
	const runningTotal = $derived(outcomes.reduce((sum, o) => sum + o.score, 0));
	const latest = $derived(history[0]);

	function start() {
		outcomes = [];
		hits = 0;
		remaining = protocol?.window_seconds ?? 0;
		deadline = null;
		saved = null;
		savedEntry = null;
		affirmation = null;
		saveError = null;
		stage = 'running';
	}

	function record(score: number) {
		if (!protocol || !nextSpec) return;
		outcomes = [...outcomes, { index: nextSpec.index, score }];
		if (outcomes.length === protocol.attempts.length) void finish();
	}

	function undo() {
		outcomes = outcomes.slice(0, -1);
	}

	/** A hit on the timed test, which also starts the clock on the first one. */
	function tap() {
		hits += 1;
		if (deadline === null && remaining > 0) {
			// The protocol says the window starts on the first handball, not on
			// the tap that opens the screen — so the clock starts here.
			deadline = Date.now() + (protocol?.window_seconds ?? 0) * 1000;
		}
	}

	function abandon() {
		deadline = null;
		outcomes = [];
		hits = 0;
		stage = 'brief';
	}

	/**
	 * Save as soon as the last attempt is in, not behind a confirm button.
	 *
	 * Thirty kicks is twenty minutes of work that exists only in this tab's
	 * memory until it is written. A player who locks their phone, takes a call
	 * or wanders out of the ground before tapping "save" would lose the lot, and
	 * no amount of warning copy is worth that risk. A mis-scored test can be
	 * discarded from the summary instead, which is the cheap direction to be
	 * wrong in.
	 */
	async function finish() {
		if (!protocol || saving) return;
		saving = true;
		saveError = null;
		try {
			const result = await repo.saveTestResult({
				protocol_id: protocol.id,
				attempts: $state.snapshot(outcomes),
				timed_hits: protocol.scoring === 'timed_hits' ? hits : null
			});
			saved = result;
			stage = 'done';

			const rows = await repo.listTestResults({ protocol_slug: protocol.slug });
			const walked = rollingBaseline(protocol, rows);
			savedEntry = walked.find((entry) => entry.result.id === result.id) ?? null;
			history = [...walked].reverse();

			const score = scoreResult(protocol, result);
			// Re-read after the write, so the round this result just joined is the
			// one reported — including whether it completed it.
			const { cycle: after } = await loadTestPhase();
			const round = after?.rounds.find((r) => r.results.some((x) => x.id === result.id));
			const satInRound = round?.results.length ?? 1;
			affirmation = await loadAffirmation({
				kind: 'test',
				test_name: protocol.name,
				total: score.total,
				max: score.max,
				gain: savedEntry?.gain ?? null,
				improved: savedEntry?.improved ?? false,
				is_baseline: savedEntry?.baseline === null,
				done_in_phase: satInRound,
				tests_in_phase: satInRound + (round?.missing.length ?? 0),
				round: round?.number ?? 1
			});
			roundNumber = round?.number ?? null;
			roundComplete = round?.complete ?? false;
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Could not save the result';
			// Back to the runner with the outcomes intact, so a failed write is a
			// retry rather than a lost test.
			stage = 'running';
		} finally {
			saving = false;
		}
	}

	async function discard() {
		if (!saved) return;
		await repo.deleteTestResult(saved.id);
		saved = null;
		savedEntry = null;
		affirmation = null;
		stage = 'brief';
		await load(slug);
	}
</script>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if loadError}
	<p class="text-sm text-error-500">{loadError}</p>
{:else if !protocol}
	<p class="text-sm text-surface-600-400">No test with that name.</p>
	<a href="/tests" class="mt-3 inline-block text-sm font-medium text-primary-500">Back to tests</a>
{:else if stage === 'running'}
	<!--
		The field view. One number, one instruction, two big buttons — assume one
		thumb, bright sun, and a ball in the other hand.
	-->
	<header class="mb-4">
		<p class="text-xs tracking-wide text-surface-600-400 uppercase">{protocol.name}</p>
		{#if timed}
			<h1 class="text-2xl font-bold tabular-nums">
				{deadline === null && hits === 0 ? protocol.window_seconds : remaining}s
			</h1>
		{:else}
			<h1 class="text-2xl font-bold">
				{attemptNoun(protocol)}
				{outcomes.length + 1} of {protocol.attempts.length}
			</h1>
			<div class="mt-3 h-1 overflow-hidden rounded-full bg-surface-100-900">
				<div
					class="bg-primary-500 h-full rounded-full transition-[width]"
					style="width: {(outcomes.length / protocol.attempts.length) * 100}%"
				></div>
			</div>
		{/if}
	</header>

	{#if timed}
		<div class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4 text-center">
			<p class="text-6xl font-bold tabular-nums">{hits}</p>
			<p class="mt-1 text-sm text-surface-600-400">
				{deadline === null && hits === 0
					? 'Tap on your first handball to start the clock'
					: 'Alternating hands'}
			</p>
		</div>

		<button
			type="button"
			onclick={tap}
			disabled={deadline === null && hits > 0}
			class="preset-filled-primary-500 mt-4 w-full rounded-2xl py-16 text-2xl font-bold disabled:opacity-40"
		>
			Hit
		</button>
	{:else if nextSpec}
		<div class="rounded-xl border border-primary-500 bg-surface-100-900 p-6 text-center">
			<p class="text-2xl font-bold capitalize">{attemptLabel(protocol, nextSpec)}</p>
			<p class="mt-2 text-sm text-surface-600-400 tabular-nums">
				{runningTotal} so far
			</p>
		</div>

		{#if protocol.scoring === 'goal_behind_miss'}
			<div class="mt-4 grid grid-cols-3 gap-2">
				<button
					type="button"
					onclick={() => record(GOAL)}
					class="preset-filled-primary-500 rounded-2xl py-8 text-lg font-bold"
				>
					Goal
				</button>
				<button
					type="button"
					onclick={() => record(BEHIND)}
					class="preset-tonal-primary rounded-2xl py-8 text-lg font-bold"
				>
					Behind
				</button>
				<button
					type="button"
					onclick={() => record(MISS)}
					class="preset-filled-surface-500 rounded-2xl py-8 text-lg font-bold"
				>
					Miss
				</button>
			</div>
		{:else}
			<div class="mt-4 grid grid-cols-2 gap-3">
				<button
					type="button"
					onclick={() => record(1)}
					class="preset-filled-primary-500 rounded-2xl py-10 text-xl font-bold"
				>
					Hit
				</button>
				<button
					type="button"
					onclick={() => record(0)}
					class="preset-filled-surface-500 rounded-2xl py-10 text-xl font-bold"
				>
					Miss
				</button>
			</div>
		{/if}

		<div class="mt-3 flex gap-3">
			<button
				type="button"
				onclick={undo}
				disabled={outcomes.length === 0}
				class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-sm disabled:opacity-40"
			>
				Undo
			</button>
			<button
				type="button"
				onclick={abandon}
				class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-sm"
			>
				Stop
			</button>
		</div>
	{/if}

	{#if saveError}
		<p class="mt-3 text-sm text-error-500">{saveError}</p>
		<button
			type="button"
			onclick={finish}
			disabled={saving}
			class="tap-target preset-filled-primary-500 mt-2 w-full rounded-xl py-3 font-semibold disabled:opacity-40"
		>
			{saving ? 'Saving…' : 'Try saving again'}
		</button>
	{/if}

	{#if timed && deadline === null && hits > 0}
		<p class="mt-4 text-center text-sm text-surface-600-400">Time. Saving…</p>
	{/if}
{:else if stage === 'done' && saved}
	<header class="mb-4">
		<p class="text-xs tracking-wide text-surface-600-400 uppercase">{protocol.name}</p>
		<h1 class="text-2xl font-bold">Result</h1>
	</header>

	{#if affirmation}
		<div class="mb-4">
			<AffirmationCard {affirmation} />
		</div>
	{/if}

	<TestResultDetail
		{protocol}
		result={saved}
		baseline={savedEntry?.baseline ?? null}
		gain={savedEntry?.gain ?? null}
		improved={savedEntry?.improved ?? false}
	/>

	{#if roundComplete && roundNumber !== null && roundNumber > 1}
		<!--
			The round just closed, so the comparison it exists for is available now.
			Offered here rather than left to be found later: this is the moment the
			player wants to know what the month did.
		-->
		<a
			href="/tests/rounds"
			class="tap-target preset-filled-primary-500 mt-4 flex items-center justify-center rounded-xl py-3 font-semibold"
		>
			See round {roundNumber} against round {roundNumber - 1}
		</a>
	{/if}

	<div class="mt-4 flex gap-3">
		<a
			href="/tests"
			class="tap-target {roundComplete && roundNumber !== null && roundNumber > 1
				? 'preset-outlined-surface-200-800'
				: 'preset-filled-primary-500'} flex-1 rounded-xl py-3 text-center font-semibold"
		>
			Done
		</a>
		<button
			type="button"
			onclick={discard}
			class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-3 text-sm"
		>
			Discard
		</button>
	</div>
	<p class="mt-2 text-xs text-surface-500">
		Discard only if you scored it wrong. A bad result is worth keeping — it is what the next one is
		measured against.
	</p>
{:else}
	<header class="mb-4">
		<a href="/tests" class="text-xs font-medium text-primary-500">← Tests</a>
		<h1 class="mt-1 text-2xl font-bold">{protocol.name}</h1>
		<p class="text-sm text-surface-600-400">{protocol.summary}</p>
	</header>

	<section class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4">
		<h2 class="text-xs font-semibold tracking-wide text-surface-600-400 uppercase">Set up</h2>
		<p class="mt-1 text-sm">{protocol.setup}</p>
		<p class="mt-2 text-xs text-surface-500">
			{protocol.equipment.join(' · ')} · about {protocol.duration_minutes} min
		</p>
	</section>

	<section class="mt-4">
		<h2 class="mb-2 text-xs font-semibold tracking-wide text-surface-600-400 uppercase">
			The protocol
		</h2>
		<ul class="space-y-2">
			{#each protocol.rules as rule (rule)}
				<li class="flex gap-2 text-sm">
					<span class="text-primary-500" aria-hidden="true">•</span>
					<span class="text-surface-600-400">{rule}</span>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-xs text-surface-500">
			These rules never change. That is the only reason today's result can be compared with one from
			six months ago.
		</p>
	</section>

	<button
		type="button"
		onclick={start}
		class="tap-target preset-filled-primary-500 mt-4 w-full rounded-xl py-4 font-semibold"
	>
		{latest ? 'Sit it again' : 'Start test'}
	</button>

	{#if latest}
		<section class="mt-6">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
				Last result · {latest.result.local_date}
			</h2>
			<TestResultDetail
				{protocol}
				result={latest.result}
				baseline={latest.baseline}
				gain={latest.gain}
				improved={latest.improved}
			/>
		</section>
	{/if}

	{#if history.length > 1}
		<section class="mt-6">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
				History
			</h2>
			<ul class="space-y-2">
				{#each history as entry (entry.result.id)}
					<li
						class="flex items-center gap-3 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3"
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium tabular-nums">{entry.result.local_date}</p>
							{#if entry.anchored}
								<p class="text-xs text-primary-500">Baseline from here</p>
							{/if}
						</div>
						<span class="shrink-0 font-semibold tabular-nums">
							{entry.score.total}{entry.score.max === null ? '' : `/${entry.score.max}`}
						</span>
						{#if formatGain(entry.gain)}
							<span
								class="w-14 shrink-0 text-right text-xs tabular-nums {entry.improved
									? 'text-primary-500'
									: 'text-surface-500'}"
							>
								{formatGain(entry.gain)}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}
