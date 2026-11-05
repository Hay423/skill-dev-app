<script lang="ts">
	import { repo } from '$lib/data';
	import { parseDrillsCsv, parseDrillsJson, type DrillImportError } from '$lib/domain/drill-import';
	import type { DrillInput } from '$lib/data/repo';
	import { drillTitle } from '$lib/domain/drills';
	import { SKILL_CATEGORY_LABELS, type Drill } from '$lib/types';

	let drills = $state<Drill[]>([]);
	let loading = $state(true);
	let busyId = $state<string | null>(null);

	let fileInput = $state<HTMLInputElement | undefined>(undefined);
	let pending = $state<DrillInput[]>([]);
	let importErrors = $state<DrillImportError[]>([]);
	let importing = $state(false);
	let importSummary = $state<string | null>(null);

	async function load() {
		drills = await repo.listDrills({ includeHidden: true });
	}

	$effect(() => {
		load().finally(() => (loading = false));
	});

	const active = $derived(drills.filter((d) => d.active === 1));
	const hidden = $derived(drills.filter((d) => d.active === 0));

	async function toggleActive(drill: Drill) {
		busyId = drill.id;
		try {
			await repo.setDrillActive(drill.id, drill.active === 0);
			await load();
		} finally {
			busyId = null;
		}
	}

	async function onFileSelected(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		importSummary = null;
		const text = await file.text();
		const result = file.name.toLowerCase().endsWith('.json')
			? parseDrillsJson(text)
			: parseDrillsCsv(text);
		pending = result.drills;
		importErrors = result.errors;
	}

	async function confirmImport() {
		if (pending.length === 0) return;
		importing = true;
		try {
			const { created, updated } = await repo.importDrills($state.snapshot(pending));
			importSummary = `Added ${created}, updated ${updated}.`;
			pending = [];
			importErrors = [];
			if (fileInput) fileInput.value = '';
			await load();
		} finally {
			importing = false;
		}
	}

	function cancelImport() {
		pending = [];
		importErrors = [];
		importSummary = null;
		if (fileInput) fileInput.value = '';
	}
</script>

<header class="mb-4">
	<a href="/profile" class="text-sm text-surface-600-400">← Profile</a>
	<h1 class="mt-2 text-2xl font-bold">Drill library</h1>
	<p class="text-sm text-surface-600-400">Add, edit and hide drills.</p>
</header>

<a
	href="/profile/drills/new"
	class="tap-target preset-filled-primary-500 mb-4 flex items-center justify-center rounded-xl px-4 py-3 font-semibold"
>
	+ Add a drill
</a>

<section class="mb-6 rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
	<h2 class="text-sm font-semibold tracking-wide text-surface-600-400 uppercase">Upload drills</h2>
	<p class="mt-1 text-xs text-surface-500">
		CSV or JSON file. A row whose <code>slug</code> matches an existing drill updates it; otherwise a
		new drill is created.
	</p>
	<input
		bind:this={fileInput}
		type="file"
		accept=".csv,.json,text/csv,application/json"
		onchange={onFileSelected}
		class="tap-target mt-2 w-full text-sm"
	/>

	{#if importErrors.length > 0}
		<div class="mt-2 rounded-xl border border-error-500/40 bg-error-500/10 p-2">
			<p class="text-xs font-semibold text-error-500">{importErrors.length} row(s) skipped:</p>
			<ul class="mt-1 space-y-1 text-xs text-error-500">
				{#each importErrors as err (err.row + err.message)}
					<li>Row {err.row}: {err.message}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if pending.length > 0}
		<p class="mt-2 text-sm">{pending.length} drill(s) ready to import.</p>
		<div class="mt-2 flex gap-2">
			<button
				type="button"
				onclick={confirmImport}
				disabled={importing}
				class="tap-target preset-filled-primary-500 flex-1 rounded-xl py-2 text-sm disabled:opacity-40"
			>
				{importing ? 'Importing…' : `Import ${pending.length}`}
			</button>
			<button
				type="button"
				onclick={cancelImport}
				class="tap-target preset-outlined-surface-200-800 flex-1 rounded-xl py-2 text-sm"
			>
				Cancel
			</button>
		</div>
	{/if}

	{#if importSummary}
		<p class="mt-2 text-sm text-primary-500">{importSummary}</p>
	{/if}
</section>

{#if loading}
	<p class="text-sm text-surface-500">Loading…</p>
{:else}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
			Active ({active.length})
		</h2>
		<ul class="space-y-2">
			{#each active as drill (drill.id)}
				<li class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="truncate font-semibold">{drillTitle(drill)}</p>
							<p class="text-xs text-surface-500">
								{SKILL_CATEGORY_LABELS[drill.category]}
								{drill.source === 'custom' ? ' · Your drill' : ''}
							</p>
						</div>
						<div class="flex shrink-0 gap-2">
							<a
								href="/profile/drills/{drill.id}/edit"
								class="tap-target preset-outlined-surface-200-800 rounded-xl px-3 text-sm"
							>
								Edit
							</a>
							<button
								type="button"
								onclick={() => toggleActive(drill)}
								disabled={busyId === drill.id}
								class="tap-target preset-outlined-error-500 rounded-xl px-3 text-sm disabled:opacity-40"
							>
								Hide
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</section>

	{#if hidden.length > 0}
		<section>
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-surface-600-400 uppercase">
				Hidden ({hidden.length})
			</h2>
			<p class="mb-2 text-xs text-surface-500">
				Hidden drills stay out of the library and logger, but any past reps logged against them are
				untouched.
			</p>
			<ul class="space-y-2">
				{#each hidden as drill (drill.id)}
					<li class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 opacity-70">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate font-semibold">{drillTitle(drill)}</p>
								<p class="text-xs text-surface-500">{SKILL_CATEGORY_LABELS[drill.category]}</p>
							</div>
							<div class="flex shrink-0 gap-2">
								<a
									href="/profile/drills/{drill.id}/edit"
									class="tap-target preset-outlined-surface-200-800 rounded-xl px-3 text-sm"
								>
									Edit
								</a>
								<button
									type="button"
									onclick={() => toggleActive(drill)}
									disabled={busyId === drill.id}
									class="tap-target preset-filled-primary-500 rounded-xl px-3 text-sm disabled:opacity-40"
								>
									Unhide
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}
