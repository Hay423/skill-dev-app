<script lang="ts">
	import {
		breakdown,
		formatGain,
		formatScoreLine,
		scoreLine,
		scoreResult,
		sideNoun,
		strongerSide
	} from '$lib/domain/tests';
	import { formatAccuracy } from '$lib/domain/stats';
	import type { TestProtocol, TestResult } from '$lib/types';

	interface Props {
		protocol: TestProtocol;
		result: TestResult;
		/** The rolling baseline this result was measured against, if any. */
		baseline?: TestResult | null;
		gain?: number | null;
		improved?: boolean;
	}

	let { protocol, result, baseline = null, gain = null, improved = false }: Props = $props();

	const score = $derived(scoreResult(protocol, result));
	const parts = $derived(breakdown(protocol, result));
	const line = $derived(protocol.scoring === 'goal_behind_miss' ? scoreLine(result) : null);
	const stronger = $derived(strongerSide(parts.bySide));
	const gainText = $derived(formatGain(gain));

	const sections = $derived(
		[
			{ title: `By ${sideNoun(protocol)}`, rows: parts.bySide },
			{ title: 'By distance', rows: parts.byDistance },
			{ title: 'By spot', rows: parts.bySpot }
		].filter((section) => section.rows.length > 0)
	);
</script>

<div class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-4 text-center">
	{#if line}
		<p class="text-4xl font-bold tabular-nums">{formatScoreLine(line)}</p>
		<p class="mt-1 text-sm text-surface-600-400">
			{line.goals} goal{line.goals === 1 ? '' : 's'}, {line.behinds} behind{line.behinds === 1
				? ''
				: 's'} from {result.attempts.length} shots
		</p>
	{:else if score.max === null}
		<p class="text-5xl font-bold tabular-nums">{score.total}</p>
		<p class="mt-1 text-sm text-surface-600-400">
			hits in {protocol.window_seconds} seconds
		</p>
	{:else}
		<p class="text-5xl font-bold tabular-nums">
			{score.total}<span class="text-surface-500">/{score.max}</span>
		</p>
		<p class="mt-1 text-sm text-surface-600-400">{formatAccuracy(score.accuracy)}</p>
	{/if}

	{#if result.estimated === 1}
		<p class="mt-2 text-xs text-surface-500">
			Estimated from your junior-tier result — replaced the first time you sit this test.
		</p>
	{:else if baseline && gainText}
		<p class="mt-2 text-sm {improved ? 'text-primary-500' : 'text-surface-600-400'}">
			{gainText} on baseline{improved ? ' · new baseline' : ''}
		</p>
	{:else if !baseline}
		<p class="mt-2 text-xs text-surface-500">This is your baseline — the number to beat.</p>
	{/if}
</div>

{#each sections as section (section.title)}
	<section class="mt-4">
		<h3 class="mb-2 text-xs font-semibold tracking-wide text-surface-600-400 uppercase">
			{section.title}
		</h3>
		<ul class="space-y-2">
			{#each section.rows as row (row.label)}
				<li class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
					<div class="flex items-center justify-between gap-3">
						<span class="font-medium capitalize">{row.label}</span>
						<span class="shrink-0 font-semibold tabular-nums">
							{row.total}/{row.max}
						</span>
					</div>
					<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200-800">
						<div
							class="bg-primary-500 h-full rounded-full"
							style="width: {(row.accuracy ?? 0) * 100}%"
						></div>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/each}

{#if stronger && parts.bySide.length === 2}
	<!--
		The one line the player came for. A 30-kick test split five per foot per
		rung exists precisely so weak-foot and range gaps show up separately from
		each other, instead of disappearing into one accuracy figure.
	-->
	<p
		class="mt-4 rounded-xl border border-dashed border-surface-200-800 p-3 text-sm text-surface-600-400"
	>
		Your {stronger}
		{sideNoun(protocol)} is the stronger one here. The other one is the cheapest improvement available
		to you.
	</p>
{/if}
