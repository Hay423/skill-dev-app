import { describe, expect, it } from 'vitest';
import { AGE_GROUPS, LOCAL_USER_ID, type AgeGroup, type PlayerProfile } from '$lib/types';
import {
	canOptInToSeniorPrograms,
	describeSeniorOptIn,
	SENIOR_OPT_IN_MIN_AGE_YEARS,
	seniorProgramsUnlocked
} from './senior-opt-in';

const TODAY = '2026-08-01';

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: 'me',
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'utility',
		secondary_position: null,
		age_group: 'u17',
		// Sixteen on TODAY, and sixteen with a month to spare.
		date_of_birth: '2010-07-01',
		experience: 'developing',
		senior_programs_opt_in: 0,
		senior_programs_opt_in_at: null,
		sessions_per_week: 3,
		available_days: [],
		equipment_access: [],
		retest_interval_weeks: 4,
		schema_version: 5,
		created_at: '2026-08-01T00:00:00.000Z',
		updated_at: '2026-08-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 1,
		_deleted: 0,
		...overrides
	};
}

describe('canOptInToSeniorPrograms', () => {
	it('offers it to a U17 who has reached the age floor', () => {
		expect(canOptInToSeniorPrograms(profile(), TODAY)).toBe(true);
	});

	it('is offered on the sixteenth birthday and not the day before', () => {
		// Born 2010-08-01: fifteen on 31 July 2026, sixteen on 1 August.
		const p = profile({ date_of_birth: '2010-08-01' });
		expect(canOptInToSeniorPrograms(p, '2026-07-31')).toBe(false);
		expect(canOptInToSeniorPrograms(p, '2026-08-01')).toBe(true);
	});

	it('withholds it from a fifteen year old in the U17 band', () => {
		expect(canOptInToSeniorPrograms(profile({ date_of_birth: '2011-07-01' }), TODAY)).toBe(false);
	});

	it('withholds it with no date of birth, however old the band implies', () => {
		// The whole point of the floor is that it is not inferred from the band.
		expect(canOptInToSeniorPrograms(profile({ date_of_birth: null }), TODAY)).toBe(false);
	});

	it('applies to the U17 band only', () => {
		// Nobody else needs it: the younger bands have strength withheld outright
		// and the older ones already have the programs.
		const others = AGE_GROUPS.filter((g): g is AgeGroup => g !== 'u17');
		for (const age_group of others) {
			expect(canOptInToSeniorPrograms(profile({ age_group }), TODAY)).toBe(false);
		}
	});

	it('names sixteen as the floor', () => {
		expect(SENIOR_OPT_IN_MIN_AGE_YEARS).toBe(16);
	});
});

describe('seniorProgramsUnlocked', () => {
	it('needs the choice as well as the entitlement', () => {
		expect(seniorProgramsUnlocked(profile({ senior_programs_opt_in: 0 }), TODAY)).toBe(false);
		expect(seniorProgramsUnlocked(profile({ senior_programs_opt_in: 1 }), TODAY)).toBe(true);
	});

	it('re-earns the entitlement every call rather than trusting a stored flag', () => {
		// The three ways a stored 1 stops meaning anything, each of which has to
		// take effect immediately and without a migration.
		const optedIn = { senior_programs_opt_in: 1 } as const;
		expect(seniorProgramsUnlocked(profile({ ...optedIn, age_group: 'u15' }), TODAY)).toBe(false);
		expect(seniorProgramsUnlocked(profile({ ...optedIn, date_of_birth: null }), TODAY)).toBe(false);
		expect(
			seniorProgramsUnlocked(profile({ ...optedIn, date_of_birth: '2011-07-01' }), TODAY)
		).toBe(false);
	});

	it('does not let the flag unlock anything for a band it was never offered to', () => {
		// A U15 cannot reach the setting, so this is defence against a hand-edited
		// or mis-synced row rather than a reachable state.
		expect(
			seniorProgramsUnlocked(
				profile({ age_group: 'u15', senior_programs_opt_in: 1, date_of_birth: '2010-07-01' }),
				TODAY
			)
		).toBe(false);
	});
});

describe('describeSeniorOptIn', () => {
	it('explains the senior content only to the player who asked for it', () => {
		expect(describeSeniorOptIn(profile({ senior_programs_opt_in: 1 }), TODAY)).toContain(
			'one-rep max'
		);
		expect(describeSeniorOptIn(profile({ senior_programs_opt_in: 0 }), TODAY)).toBeNull();
	});

	it('says nothing without a profile', () => {
		expect(describeSeniorOptIn(undefined, TODAY)).toBeNull();
	});
});
