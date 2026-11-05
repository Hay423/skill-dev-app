<script lang="ts">
	import { describeProgramShape, describeQualities } from '$lib/domain/program-plan';
	import type { TrainingProgram } from '$lib/types';

	/**
	 * One discipline's worth of recommended programs.
	 *
	 * Extracted when plyometrics became a third discipline: the same card was
	 * already written out twice, and a third copy is where the three quietly
	 * start to differ — one section growing a chip the others never get.
	 */
	interface Props {
		programs: Array<{
			program: TrainingProgram;
			reason: string | null;
			caution: string | null;
		}>;
		/** Ids of programs the player is already running, which take a badge instead of a reason. */
		enrolledIds: Set<string>;
	}

	let { programs, enrolledIds }: Props = $props();
</script>

<ul class="space-y-2">
	{#each programs as { program, reason, caution } (program.id)}
		<li>
			<a
				href="/train/{program.slug}"
				class="tap-target block rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 active:bg-surface-200-800"
			>
				<h3 class="font-semibold">{program.name}</h3>
				<p class="mt-1 text-sm text-surface-600-400">{program.summary}</p>
				<p class="mt-2 text-xs text-surface-500">{describeProgramShape(program)}</p>
				<p class="text-xs text-surface-500">{describeQualities(program)}</p>
				<!--
					Running now beats a caution beats a reason: a player already in a
					block does not need to be sold it, and a caution is the more useful
					of the two things left to say.
				-->
				{#if enrolledIds.has(program.id)}
					<p class="mt-2 inline-block rounded-full preset-filled-primary-500 px-2 py-0.5 text-xs">
						Running now
					</p>
				{:else if caution}
					<p class="mt-2 inline-block rounded-full preset-tonal-surface px-2 py-0.5 text-xs">
						{caution}
					</p>
				{:else if reason}
					<p class="mt-2 inline-block rounded-full preset-tonal-primary px-2 py-0.5 text-xs">
						{reason}
					</p>
				{/if}
			</a>
		</li>
	{/each}
</ul>
