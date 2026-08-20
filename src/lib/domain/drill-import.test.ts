import { describe, expect, it } from 'vitest';
import { parseDrillsCsv, parseDrillsJson } from './drill-import';

describe('parseDrillsCsv', () => {
	it('parses a valid row into a DrillInput', () => {
		const csv = [
			'name,category,summary,setup,coaching_points,equipment,min_players,duration_minutes,difficulty,tracks_reps,target_reps',
			'Kick to a fence,kicking,"Repeat, low-effort kicking against a fence",Stand 10m from a fence,"Ball down, laces up;Follow through",Football;Fence,1,10,1,true,20'
		].join('\n');

		const { drills, errors } = parseDrillsCsv(csv);

		expect(errors).toEqual([]);
		expect(drills).toHaveLength(1);
		expect(drills[0]).toMatchObject({
			name: 'Kick to a fence',
			category: 'kicking',
			summary: 'Repeat, low-effort kicking against a fence',
			coaching_points: ['Ball down, laces up', 'Follow through'],
			equipment: ['Football', 'Fence'],
			min_players: 1,
			duration_minutes: 10,
			difficulty: 1,
			tracks_reps: true,
			target_reps: 20
		});
	});

	it('reports the failing row without blocking the rest of the file', () => {
		const csv = [
			'name,category,summary,setup,min_players,duration_minutes,difficulty,tracks_reps',
			'Good drill,kicking,Summary,Setup,1,10,1,true',
			'Bad drill,not_a_category,Summary,Setup,1,10,1,true',
			'Also good,handball,Summary,Setup,2,15,2,false'
		].join('\n');

		const { drills, errors } = parseDrillsCsv(csv);

		expect(drills).toHaveLength(2);
		expect(drills.map((d) => d.name)).toEqual(['Good drill', 'Also good']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ row: 2 });
		expect(errors[0].message).toMatch(/category/);
	});

	it('fails fast when a required column is missing', () => {
		const csv = ['name,category,summary', 'Drill,kicking,Summary'].join('\n');
		const { drills, errors } = parseDrillsCsv(csv);
		expect(drills).toEqual([]);
		expect(errors[0].message).toMatch(/Missing required column/);
	});

	it('rejects an empty file', () => {
		const { errors } = parseDrillsCsv('');
		expect(errors[0].message).toMatch(/empty/i);
	});
});

describe('parseDrillsJson', () => {
	it('parses a valid array of drills', () => {
		const json = JSON.stringify([
			{
				name: 'Backyard handball wall',
				category: 'handball',
				summary: 'Handball against a wall for accuracy',
				setup: 'Stand 5m from a wall',
				coaching_points: ['Punch through the ball'],
				equipment: ['Football'],
				min_players: 1,
				duration_minutes: 10,
				difficulty: 1,
				tracks_reps: true,
				target_reps: 30
			}
		]);

		const { drills, errors } = parseDrillsJson(json);
		expect(errors).toEqual([]);
		expect(drills).toHaveLength(1);
		expect(drills[0]).toMatchObject({ name: 'Backyard handball wall', category: 'handball' });
	});

	it('reports invalid JSON', () => {
		const { errors } = parseDrillsJson('{not valid json');
		expect(errors[0].message).toMatch(/valid JSON/);
	});

	it('requires a top-level array', () => {
		const { errors } = parseDrillsJson('{"name": "not an array"}');
		expect(errors[0].message).toMatch(/array/);
	});

	it('reports per-entry errors without blocking valid entries', () => {
		const json = JSON.stringify([
			{
				name: 'Valid drill',
				category: 'marking',
				summary: 'Summary',
				setup: 'Setup',
				min_players: 1,
				duration_minutes: 10,
				difficulty: 1,
				tracks_reps: true
			},
			{ name: '', category: 'marking', summary: 'x', setup: 'x', min_players: 1, duration_minutes: 10, difficulty: 1, tracks_reps: true }
		]);

		const { drills, errors } = parseDrillsJson(json);
		expect(drills).toHaveLength(1);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ row: 2 });
	});
});
