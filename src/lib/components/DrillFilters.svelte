<script lang="ts">
	import { drillFilter } from '$lib/filters.svelte';
	import {
		activeFilterCount,
		describeFilter,
		describeHeadcount,
		describeOpenBudget,
		describeTimeBudget,
		placeLabel,
		placeOptions,
		playerOptions,
		timeOptions,
		type DrillFilter
	} from '$lib/domain/drill-filter';
	import type { Drill, EquipmentAccess } from '$lib/types';

	interface Props {
		/**
		 * The library the options are derived from. Chips are offered only for
		 * headcounts, durations and places the drills actually distinguish
		 * between — the same rule the category row on `/drills` already follows.
		 */
		drills: Drill[];
	}

	let { drills }: Props = $props();

	/**
	 * Collapsed by default, on both screens that use it. Mid-session the answer
	 * is usually still whatever it was last time, so the common case is reading
	 * the summary line and moving on — and on Today the block underneath is what
	 * the player came for.
	 */
	let open = $state(false);

	const filter = $derived(drillFilter.current);
	const count = $derived(activeFilterCount(filter));

	const players = $derived(playerOptions(drills));
	const times = $derived(timeOptions(drills));
	const places = $derived(placeOptions(drills));

	const summary = $derived(describeFilter(filter, times.open ?? undefined));

	/** Nothing to filter on — a one-drill library, or one that draws no distinctions. */
	const usable = $derived(players.length > 1 || times.open !== null || places.length > 0);

	function update(patch: Partial<DrillFilter>) {
		drillFilter.set({ ...filter, ...patch });
	}

	/** Tapping the chip that is already on clears it, so every filter is one tap out of. */
	function setPlayers(value: number) {
		update({ players: filter.players === value ? null : value });
	}

	function setBudget(value: number | 'open') {
		update({ max_minutes: filter.max_minutes === value ? null : value });
	}

	/** One place at a time: picking a new one replaces the old rather than adding to it. */
	function setPlace(item: EquipmentAccess) {
		update({ place: filter.place === item ? null : item });
	}

	const CHIP = 'shrink-0 rounded-full border px-3 py-1.5 text-sm';
</script>

{#if usable}
	<div class="mb-3 rounded-xl border border-surface-200-800 bg-surface-100-900">
		<div class="flex items-center">
			<button
				type="button"
				onclick={() => (open = !open)}
				aria-expanded={open}
				class="tap-target flex min-w-0 flex-1 items-center gap-2 px-3 text-left"
			>
				<span class="shrink-0 text-sm font-medium">Filters</span>
				{#if count > 0}
					<span class="shrink-0 rounded-full preset-filled-primary-500 px-2 py-0.5 text-xs">
						{count}
					</span>
					<span class="truncate text-xs text-surface-500">{summary}</span>
				{:else}
					<span class="truncate text-xs text-surface-500">Who's with you, how long, where</span>
				{/if}
				<span class="ml-auto shrink-0 text-xs text-surface-500" aria-hidden="true">
					{open ? '▲' : '▼'}
				</span>
			</button>
			{#if count > 0}
				<button
					type="button"
					onclick={() => drillFilter.clear()}
					class="tap-target shrink-0 px-3 text-xs font-medium text-primary-500"
				>
					Clear
				</button>
			{/if}
		</div>

		{#if open}
			<div class="space-y-3 border-t border-surface-200-800 p-3">
				{#if players.length > 1}
					<div>
						<span class="text-xs tracking-wide text-surface-600-400 uppercase">Who's training</span>
						<div class="-mx-3 mt-1 flex gap-2 overflow-x-auto px-3 pb-1">
							{#each players as value (value)}
								<button
									type="button"
									onclick={() => setPlayers(value)}
									aria-pressed={filter.players === value}
									class="{CHIP} {filter.players === value
										? 'preset-filled-primary-500'
										: 'preset-outlined-surface-200-800'}"
								>
									{describeHeadcount(value)}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if times.open !== null}
					<div>
						<span class="text-xs tracking-wide text-surface-600-400 uppercase">Time you have</span>
						<div class="-mx-3 mt-1 flex gap-2 overflow-x-auto px-3 pb-1">
							{#each times.caps as value (value)}
								<button
									type="button"
									onclick={() => setBudget(value)}
									aria-pressed={filter.max_minutes === value}
									class="{CHIP} {filter.max_minutes === value
										? 'preset-filled-primary-500'
										: 'preset-outlined-surface-200-800'}"
								>
									{describeTimeBudget(value)}
								</button>
							{/each}
							<!--
								The open end of the ladder. It keeps every drill, which is the
								point: "I have plenty of time" is an answer, and a row that can
								only be left blank cannot record one.
							-->
							<button
								type="button"
								onclick={() => setBudget('open')}
								aria-pressed={filter.max_minutes === 'open'}
								class="{CHIP} {filter.max_minutes === 'open'
									? 'preset-filled-primary-500'
									: 'preset-outlined-surface-200-800'}"
							>
								{describeOpenBudget(times.open)}
							</button>
						</div>
					</div>
				{/if}

				{#if places.length > 0}
					<div>
						<span class="text-xs tracking-wide text-surface-600-400 uppercase">Where you are</span>
						<!--
							`radiogroup` rather than a row of toggles, because one place is
							now genuinely exclusive — you are in one place at a time.
						-->
						<div class="-mx-3 mt-1 flex gap-2 overflow-x-auto px-3 pb-1" role="radiogroup">
							{#each places as item (item)}
								<button
									type="button"
									role="radio"
									onclick={() => setPlace(item)}
									aria-checked={filter.place === item}
									class="{CHIP} {filter.place === item
										? 'preset-filled-primary-500'
										: 'preset-outlined-surface-200-800'}"
								>
									{placeLabel(item)}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!--
					Two things the rows cannot say for themselves: that the places nest
					(so naming the biggest one you are at is enough), and that an
					untouched row is not the same as an empty one.
				-->
				<p class="text-xs text-surface-500">
					Pick the one place you are at — a bigger one covers the drills written for a smaller one.
					Leave a row alone and it rules nothing out.
				</p>
			</div>
		{/if}
	</div>
{/if}
