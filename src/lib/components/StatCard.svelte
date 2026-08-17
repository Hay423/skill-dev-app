<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		hint?: string;
	}

	let { label, value, hint }: Props = $props();
</script>

<div class="rounded-xl border border-slate-800 bg-slate-900 p-3">
	<p class="text-xs tracking-wide text-slate-400 uppercase">{label}</p>
	<p class="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
	{#if hint}
		<p class="mt-0.5 text-xs text-slate-500">{hint}</p>
	{/if}
</div>
