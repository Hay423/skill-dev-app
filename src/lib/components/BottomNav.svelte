<script lang="ts">
	import { page } from '$app/state';
	import { BOTTOM_NAV_HREFS, NAV_LINKS, isNavActive } from '$lib/nav';

	// The four links every player needs one tap away. Drills and Profile live in
	// the burger menu instead — see `nav.ts` for why.
	const links = NAV_LINKS.filter((link) => BOTTOM_NAV_HREFS.includes(link.href));
</script>

<!--
	`sticky`, not `fixed`. A fixed bar is positioned against the viewport, which
	on iOS is not the same box on a page that scrolls as on one that exactly
	fills the screen — Progress, the one tab short enough not to scroll, ended up
	drawing its bar ~49px above the bottom edge in the installed app.

	Sticky keeps the bar the last row of the layout's flex column: the column is
	`min-h-dvh` and `main` above it is `flex-1`, so on a short page the bar sits
	at the bottom because flow put it there, and on a long one it pins to the
	bottom of the scrollport while the content runs underneath. Neither case asks
	the viewport anything.
-->
<nav
	class="sticky bottom-0 z-50 border-t border-surface-200-800 bg-surface-100-900/95 backdrop-blur [view-transition-name:bottom-nav]"
	style="padding-bottom: var(--inset-bottom)"
>
	<ul class="flex">
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
