<script lang="ts">
	import { page } from '$app/state';
	import { BOTTOM_NAV_HREFS, NAV_LINKS, isNavActive } from '$lib/nav';

	// The four links every player needs one tap away. Drills and Profile live in
	// the burger menu instead — see `nav.ts` for why.
	const links = NAV_LINKS.filter((link) => BOTTOM_NAV_HREFS.includes(link.href));
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-50 border-t border-surface-200-800 bg-surface-100-900/95 backdrop-blur [view-transition-name:bottom-nav]"
	style="padding-bottom: var(--inset-bottom)"
>
	<ul class="mx-auto flex max-w-lg">
		{#each links as link (link.href)}
			<li class="flex-1">
				<a
					href={link.href}
					class="tap-target flex flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] transition-colors {isNavActive(
						link.href,
						page.url.pathname
					)
						? 'text-primary-500'
						: 'text-surface-600-400'}"
					aria-current={isNavActive(link.href, page.url.pathname) ? 'page' : undefined}
				>
					<span class="text-lg leading-none" aria-hidden="true">{link.icon}</span>
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
