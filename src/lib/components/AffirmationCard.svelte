<script lang="ts">
	import type { Affirmation } from '$lib/domain/affirmations';

	interface Props {
		affirmation: Affirmation;
		/** Lets the player put it away without waiting for it to be replaced by something else. */
		ondismiss?: () => void;
	}

	let { affirmation, ondismiss }: Props = $props();
</script>

<!--
	Inline, not a toast: it stays exactly where the player finished the work
	until they navigate away or dismiss it, rather than fading out while their
	hands are still full of a ball.
-->
<div
	class="relative rounded-xl border p-4 text-center {affirmation.milestone
		? 'border-primary-500 preset-tonal-primary'
		: 'border-surface-200-800 bg-surface-100-900'}"
	role="status"
>
	{#if ondismiss}
		<button
			type="button"
			onclick={ondismiss}
			aria-label="Dismiss"
			class="tap-target absolute top-0 right-0 flex items-center justify-center text-surface-500"
		>
			✕
		</button>
	{/if}
	<p class="text-lg font-bold">{affirmation.headline}</p>
	{#if affirmation.detail}
		<p class="mt-1 text-sm text-surface-600-400">{affirmation.detail}</p>
	{/if}
</div>
