<script lang="ts">
	import { drillTitle } from '$lib/domain/drills';
	import { groupExcludedDrills } from '$lib/domain/drill-filter';
	import type { Drill } from '$lib/types';

	interface Props {
		/**
		 * The drills kept off the list, each with the reason already in words.
		 * Callers describe their own reasons — the profile's rules and the
		 * player's filter have different vocabularies — and the grouping below
		 * joins any that land on the same sentence.
		 */
		items: Array<{ drill: Drill; text: string }>;
	}

	let { items }: Props = $props();

	const groups = $derived(groupExcludedDrills(items));
</script>

<!--
	Exclusions are shown, not hidden. A short list that explains itself tells the
	player what would unlock more; one that does not reads as a broken app.
-->
{#if items.length > 0}
	<details class="mt-2">
		<summary class="tap-target flex items-center text-xs text-surface-500">
			{items.length}
			{items.length === 1 ? 'drill' : 'drills'} not shown
		</summary>
		<ul class="mt-1 space-y-1 pl-1">
			{#each groups as group (group.text)}
				<li class="text-xs text-surface-500">
					{group.drills.map(drillTitle).join(', ')} — {group.text}
				</li>
			{/each}
		</ul>
	</details>
{/if}
