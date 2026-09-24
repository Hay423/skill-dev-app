import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

/**
 * Configuration is validated rather than trusted, so the failure modes are
 * worth pinning down: a typo'd backend name and a half-configured Supabase both
 * have to fail loudly at boot rather than silently leaving the player writing
 * to the wrong place.
 */
describe('readConfig', () => {
	it('defaults to the local backend when nothing is set', () => {
		expect(readConfig({})).toEqual({ backend: 'local', supabase: null });
	});

	it('treats a blank value as unset', () => {
		expect(readConfig({ PUBLIC_DATA_BACKEND: '   ' }).backend).toBe('local');
	});

	it('rejects an unknown backend by name', () => {
		expect(() => readConfig({ PUBLIC_DATA_BACKEND: 'postgres' })).toThrow(/got "postgres"/);
	});

	it('reads Supabase credentials from the environment', () => {
		expect(
			readConfig({
				PUBLIC_DATA_BACKEND: 'supabase',
				PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
				PUBLIC_SUPABASE_ANON_KEY: 'anon-key'
			})
		).toEqual({
			backend: 'supabase',
			supabase: { url: 'https://example.supabase.co', anonKey: 'anon-key' }
		});
	});

	it('names every missing variable rather than failing on the first', () => {
		expect(() => readConfig({ PUBLIC_DATA_BACKEND: 'supabase' })).toThrow(
			/PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY/
		);
	});

	it('does not accept a blank credential as configured', () => {
		expect(() =>
			readConfig({
				PUBLIC_DATA_BACKEND: 'supabase',
				PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
				PUBLIC_SUPABASE_ANON_KEY: ''
			})
		).toThrow(/PUBLIC_SUPABASE_ANON_KEY/);
	});

	it('ignores Supabase variables while the backend is local', () => {
		expect(readConfig({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }).supabase).toBeNull();
	});
});
