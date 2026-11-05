/**
 * Runtime configuration, read from the environment rather than hardcoded.
 *
 * Read through `import.meta.env` with a `PUBLIC_` prefix (registered in
 * `vite.config.ts`) rather than SvelteKit's `$env/static/public`, because the
 * static module turns a missing variable into a build failure. Every variable
 * here is optional by design — the app must boot with no `.env` file at all —
 * so validation belongs in `readConfig`, where it can produce a message that
 * names the variable.
 *
 * ## What "secret" means in this app
 *
 * This is a static SPA: there is no server, so **anything reaching this file is
 * shipped to the browser and is public**, environment variable or not. Putting
 * a real secret in `.env` would not hide it — it would only make it harder to
 * notice.
 *
 * That makes the rule sharper, not looser:
 *
 * - A Supabase **anon key** is publishable by design. It identifies the project,
 *   and row-level security on `user_id` is what actually protects the data. It
 *   belongs here.
 * - A **service-role key**, database password, or any API key that can write
 *   without RLS must never appear in this repo, this build, or its `.env`. It
 *   belongs to a server the app calls, and if one is ever needed, that server is
 *   the thing to build — not an exception to this rule.
 *
 * Values live in `.env` (gitignored); `.env.example` documents them with no
 * real values.
 */

/** Storage backends the app knows how to construct. */
export const BACKENDS = ['local', 'supabase'] as const;
export type Backend = (typeof BACKENDS)[number];

export interface SupabaseConfig {
	url: string;
	/** Publishable by design — see the note above. Never the service-role key. */
	anonKey: string;
}

export interface AppConfig {
	backend: Backend;
	/** Null unless `backend` is `supabase`. */
	supabase: SupabaseConfig | null;
}

type Env = Record<string, string | undefined>;

/** Trims and treats a blank string as absent — `FOO=` in a `.env` is not a value. */
function read(env: Env, name: string): string | undefined {
	const value = env[name]?.trim();
	return value ? value : undefined;
}

/**
 * Parse and validate the environment.
 *
 * Pure and exported so it can be tested without a build. Throws rather than
 * falling back on a misconfiguration: a half-configured backend that silently
 * degrades to local storage would look like it was working right up until the
 * player's data failed to sync.
 */
export function readConfig(env: Env): AppConfig {
	const requested = read(env, 'PUBLIC_DATA_BACKEND') ?? 'local';
	if (!(BACKENDS as readonly string[]).includes(requested)) {
		throw new Error(
			`PUBLIC_DATA_BACKEND must be one of ${BACKENDS.join(', ')} — got "${requested}"`
		);
	}
	const backend = requested as Backend;

	if (backend !== 'supabase') return { backend, supabase: null };

	const url = read(env, 'PUBLIC_SUPABASE_URL');
	const anonKey = read(env, 'PUBLIC_SUPABASE_ANON_KEY');
	const missing = [
		url ? null : 'PUBLIC_SUPABASE_URL',
		anonKey ? null : 'PUBLIC_SUPABASE_ANON_KEY'
	].filter((name): name is string => name !== null);

	if (missing.length > 0) {
		throw new Error(
			`PUBLIC_DATA_BACKEND=supabase requires ${missing.join(' and ')} — see .env.example`
		);
	}

	return { backend, supabase: { url: url!, anonKey: anonKey! } };
}

export const config: AppConfig = readConfig(import.meta.env as unknown as Env);
