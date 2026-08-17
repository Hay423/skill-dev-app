import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// SPA build: every route falls back to index.html so the app boots
		// offline from the service worker cache without a server.
		adapter: adapter({ fallback: 'index.html', strict: false })
	}
};

export default config;
