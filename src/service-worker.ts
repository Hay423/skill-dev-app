/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;
// `build` is the JS/CSS bundle, `files` is everything in static/. Both are
// content-hashed or versioned, so they can be cached indefinitely.
const PRECACHE = [...build, ...files, ...prerendered];

// The SPA shell, and the one asset the manifest does not know about. The app
// sets `prerender = false` everywhere, so adapter-static writes its
// `fallback: index.html` outside the build manifest: it is absent from `build`
// and `files`, and `prerendered` is empty. Nothing caches it unless it is named
// here, and without it an offline navigation to any route has nothing to fall
// back to.
//
// Requested as the bare root, not as `/index.html`: `vite preview` — which is
// what the phone actually reads — serves the fallback for `/` and for every
// unmatched route but answers the literal `/index.html` with a 404, so asking
// for it by filename would fail the install and leave no worker at all.
const SHELL = `${base}/`;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);

			// Fetched rather than listed, so it lands under SHELL whichever path
			// the host served it from. `reload` keeps a stale HTTP-cached copy
			// pointing at the previous build's asset hashes.
			const shell = await fetch(SHELL, { cache: 'reload' });
			if (!shell.ok) throw new Error(`cannot precache app shell: ${shell.status}`);
			await cache.put(SHELL, shell);

			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Precached assets never change for a given version — serve them directly.
			if (PRECACHE.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// Everything else: network first, falling back to cache when offline.
			try {
				const response = await fetch(event.request);
				if (response.status === 200 && response.type === 'basic') {
					// Not awaited — the response should not wait on the write — so
					// swallow the rejection rather than leave it unhandled.
					cache.put(event.request, response.clone()).catch(() => {});
				}
				return response;
			} catch {
				const cached = await cache.match(event.request);
				if (cached) return cached;

				// Offline navigation to a route that was never visited online.
				// Every route is the same shell, so serve it and let the client
				// router resolve the path.
				if (event.request.mode === 'navigate') {
					const shell = await cache.match(SHELL);
					if (shell) return shell;
				}

				// Genuinely nothing to serve. Rejecting here would surface in the
				// page as an opaque "FetchEvent resulted in a network error" with
				// no hint of the cause, so answer with something readable.
				return new Response('Offline, and no cached response for this request.', {
					status: 503,
					statusText: 'Offline',
					headers: { 'content-type': 'text/plain; charset=utf-8' }
				});
			}
		})()
	);
});
