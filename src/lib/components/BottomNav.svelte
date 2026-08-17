<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/', label: 'Today', icon: '◎' },
		{ href: '/drills', label: 'Drills', icon: '▦' },
		{ href: '/log', label: 'Log', icon: '＋' },
		{ href: '/progress', label: 'Progress', icon: '📈' },
		{ href: '/profile', label: 'Profile', icon: '☺' }
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-50 border-t border-surface-200-800 bg-surface-100-900/95 backdrop-blur"
	style="padding-bottom: var(--inset-bottom)"
>
	<ul class="mx-auto flex max-w-lg">
		{#each links as link (link.href)}
			<li class="flex-1">
				<a
					href={link.href}
					class="tap-target flex flex-col items-center gap-0.5 py-2 text-xs transition-colors {isActive(
						link.href
					)
						? 'text-primary-500'
						: 'text-surface-600-400'}"
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					<span class="text-lg leading-none" aria-hidden="true">{link.icon}</span>
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
