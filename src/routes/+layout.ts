// Local-first SPA: all data lives in IndexedDB, which only exists in the
// browser, so there is nothing meaningful to render on the server.
export const ssr = false;
export const prerender = false;
