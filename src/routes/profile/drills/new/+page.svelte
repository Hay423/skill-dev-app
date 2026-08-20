<script lang="ts">
	import { goto } from '$app/navigation';
	import { repo } from '$lib/data';
	import type { DrillInput } from '$lib/data/repo';
	import DrillForm from '$lib/components/DrillForm.svelte';

	let saving = $state(false);
	let error = $state<string | null>(null);

	async function create(input: DrillInput) {
		saving = true;
		error = null;
		try {
			await repo.createDrill(input);
			await goto('/profile/drills');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save';
			saving = false;
		}
	}
</script>

<header class="mb-4">
	<a href="/profile/drills" class="text-sm text-surface-600-400">← Drill library</a>
	<h1 class="mt-2 text-2xl font-bold">Add a drill</h1>
</header>

<DrillForm submitLabel="Add drill" {saving} {error} onsubmit={create} />
