<script lang="ts">
	/**
	 * The standing note on loaded lifting content.
	 *
	 * Deliberately not dismissable and deliberately not a modal: one clear
	 * statement at the point of use, every time, rather than a wall on first run
	 * that gets tapped through and never seen again. See "Duty of care" in
	 * plans/player-profile.md.
	 */
	interface Props {
		/** Tightens the copy for a list of programs rather than a session you are about to do. */
		context?: 'browse' | 'session';
	}

	let { context = 'browse' }: Props = $props();
</script>

<p
	class="rounded-xl border border-surface-200-800 bg-surface-100-900 p-3 text-xs text-surface-600-400"
>
	<span class="font-semibold text-surface-900-100">General guidance, not a prescription.</span>
	{#if context === 'session'}
		Get your technique checked by a qualified coach before loading these lifts up, and leave a rep
		or two in reserve on every set. Stop a set the moment your technique changes.
	{:else}
		These are general programs, not individualised programming. Get your lifting technique checked
		by a qualified coach before adding load.
	{/if}
</p>
