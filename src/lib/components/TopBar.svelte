<script lang="ts">
	import { page } from '$app/state';
	import { fade, fly } from 'svelte/transition';
	import { NAV_LINKS, isNavActive } from '$lib/nav';

	let open = $state(false);
	let closeButton = $state<HTMLButtonElement | undefined>(undefined);

	function close() {
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	// Moves focus into the drawer for keyboard and screen-reader users. The
	// close button is the first focusable element, so it doubles as the landing
	// spot rather than needing a separate off-screen target.
	$effect(() => {
		if (open) closeButton?.focus();
	});
</script>

<svelte:window onkeydown={open ? onKeydown : undefined} />

<!--
	A slim, mostly-empty bar. Every page already carries its own <h1> in its own
	header, so this one's only job is the menu trigger — anything more would be
	the same title said twice at 390px.
-->
<header
	class="fixed inset-x-0 top-0 z-40 border-b border-surface-200-800 bg-surface-100-900/95 backdrop-blur [view-transition-name:top-bar]"
	style="padding-top: var(--inset-top)"
>
	<div class="mx-auto flex h-12 max-w-lg items-center px-2">
		<button
			type="button"
			onclick={() => (open = true)}
			aria-label="Open menu"
			aria-haspopup="true"
			aria-expanded={open}
			class="tap-target flex items-center justify-center rounded-xl text-xl text-surface-600-400 active:bg-surface-200-800"
		>
			<span aria-hidden="true">☰</span>
		</button>
	</div>
</header>

{#if open}
	<div class="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Navigation menu">
		<button
			type="button"
			aria-label="Dismiss menu"
			onclick={close}
			class="absolute inset-0 bg-black/50"
			transition:fade={{ duration: 150 }}
		></button>

		<nav
			class="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-surface-200-800 bg-surface-100-900"
			style="padding-top: var(--inset-top); padding-bottom: var(--inset-bottom)"
			transition:fly={{ x: -280, duration: 200 }}
		>
			<div class="flex items-center justify-between px-3 py-2">
				<span class="px-1 text-xs font-semibold tracking-wide text-surface-600-400 uppercase">
					Menu
				</span>
				<button
					bind:this={closeButton}
					type="button"
					onclick={close}
					aria-label="Close menu"
					class="tap-target flex items-center justify-center rounded-xl text-lg text-surface-600-400 active:bg-surface-200-800"
				>
					<span aria-hidden="true">✕</span>
				</button>
			</div>

			<ul class="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
				{#each NAV_LINKS as link (link.href)}
					{@const active = isNavActive(link.href, page.url.pathname)}
					<li>
						<a
							href={link.href}
							onclick={close}
							aria-current={active ? 'page' : undefined}
							class="tap-target flex items-center gap-3 rounded-xl px-3 text-sm font-medium {active
								? 'preset-tonal-primary text-primary-500'
								: 'text-surface-600-400 active:bg-surface-200-800'}"
						>
							<span class="text-lg leading-none" aria-hidden="true">{link.icon}</span>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
{/if}
