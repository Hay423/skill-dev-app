import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// `PUBLIC_` joins Vite's default so `src/lib/config.ts` can read configuration
	// from `import.meta.env`. The prefix marks these as browser-visible: this is a
	// static SPA, so anything exposed here ships in the bundle. Secrets never go
	// in a `PUBLIC_` variable — see the note in `src/lib/config.ts`.
	envPrefix: ['VITE_', 'PUBLIC_'],
	// Bind to every interface so phones and tablets on the Tailscale network can
	// reach the dev server, not just this machine. `allowedHosts` covers the host
	// check: Vite rejects requests whose Host header it doesn't recognise, and a
	// MagicDNS name (`<machine>.<tailnet>.ts.net`) is not localhost.
	server: {
		host: '0.0.0.0',
		allowedHosts: ['.ts.net']
	},
	preview: {
		host: '0.0.0.0',
		allowedHosts: ['.ts.net']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
