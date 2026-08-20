<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { repo } from '$lib/data';
	import type { DrillInput } from '$lib/data/repo';
	import type { Drill } from '$lib/types';
	import DrillForm from '$lib/components/DrillForm.svelte';

	let drill = $state<Drill | undefined>(undefined);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const id = page.params.id;
		loading = true;
		if (!id) {
			drill = undefined;
			loading = false;
			return;
		}
		repo
			.getDrill(id)
			.then((d) => (drill = d))
			.finally(() => (loading = false));
	});

	async function save(input: DrillInput) {
		if (!drill) return;
		saving = true;
		error = null;
		try {
			await repo.updateDrill(drill.id, input);
			await goto('/profile/drills');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save';
			saving = false;
		}
	}
</script>

<header class="mb-4">
	<a href="/profile/drills" class="text-sm text-surface-600-400">← Drill library</a>
	<h1 class="mt-2 text-2xl font-bold">Edit drill</h1>
</header>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else if !drill}
	<p class="text-sm text-surface-600-400">
		Drill not found. <a class="underline" href="/profile/drills">Back to drill library</a>
	</p>
{:else}
	{#key drill.id}
		<DrillForm initial={drill} submitLabel="Save changes" {saving} {error} onsubmit={save} />
	{/key}
{/if}
