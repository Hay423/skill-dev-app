import { describe, expect, it } from 'vitest';
import { describeInjuryExclusion, injuryExclusion } from './eligibility';
import type { InjuryFlag } from './types';

/**
 * These cover dormant code (see ./README.md) and are kept running so the logic
 * cannot rot while it is switched off. They exercise pure functions over
 * in-test fixtures — no injury data is stored anywhere by running them.
 */
function flag(overrides: Partial<InjuryFlag> & Pick<InjuryFlag, 'region'>): InjuryFlag {
	return { status: 'current', note: null, since: null, ...overrides };
}

describe('injuryExclusion', () => {
	it('excludes an item contraindicated by a current injury', () => {
		expect(
			injuryExclusion({ contraindicated_regions: ['hamstring'] }, [flag({ region: 'hamstring' })])
		).toEqual({ kind: 'injury', regions: ['hamstring'] });
	});

	it('excludes on a recent injury too', () => {
		expect(
			injuryExclusion({ contraindicated_regions: ['knee'] }, [
				flag({ region: 'knee', status: 'recent' })
			])
		).toEqual({ kind: 'injury', regions: ['knee'] });
	});

	it('does not exclude on an injury marked historical', () => {
		expect(
			injuryExclusion({ contraindicated_regions: ['knee'] }, [
				flag({ region: 'knee', status: 'historical' })
			])
		).toBeNull();
	});

	it('ignores flags for regions the item is not contraindicated for', () => {
		expect(
			injuryExclusion({ contraindicated_regions: ['shoulder'] }, [flag({ region: 'ankle' })])
		).toBeNull();
	});

	it('reports every colliding region, not just the first', () => {
		expect(
			injuryExclusion({ contraindicated_regions: ['knee', 'ankle', 'back'] }, [
				flag({ region: 'knee' }),
				flag({ region: 'back' })
			])
		).toEqual({ kind: 'injury', regions: ['knee', 'back'] });
	});

	it('excludes nothing when the item declares no contraindications', () => {
		expect(injuryExclusion({}, [flag({ region: 'groin' })])).toBeNull();
	});
});

describe('describeInjuryExclusion', () => {
	it('never implies an injury is resolved', () => {
		expect(describeInjuryExclusion({ kind: 'injury', regions: ['hamstring'] })).toBe(
			'set aside while your hamstring is flagged'
		);
	});

	it('lists multiple regions readably', () => {
		expect(describeInjuryExclusion({ kind: 'injury', regions: ['knee', 'ankle', 'back'] })).toBe(
			'set aside while your knee, ankle and back is flagged'
		);
	});
});
