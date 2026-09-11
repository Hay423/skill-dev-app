import type { PositionProfile } from '$lib/types';

/**
 * Position weightings — the reference content that drives every recommendation.
 *
 * Keyed by `position`, which is the primary key and is drawn from the fixed
 * `POSITIONS` taxonomy, so these rows need no generated ids. Weights are 0–1
 * emphasis, read relative to each other within a position rather than as an
 * absolute: the recommendation layer normalises against the highest weight, so
 * only the ordering and the gaps between entries matter.
 *
 * This is content, and it is meant to be replaced. The Phase 2 content importer
 * (see plans/player-profile.md) will emit this same shape from CSV; until then
 * these values are a considered starting point, not a fixed truth. A category
 * omitted from `skill_weights` scores zero — every category is listed
 * explicitly so a gap reads as a deliberate zero rather than an oversight.
 */
export const SEED_POSITIONS: PositionProfile[] = [
	{
		position: 'key_defender',
		group: 'defence',
		label: 'Key defender',
		summary:
			'Holds down the tall forward. Wins the contest in the air or kills it, then uses the ball cleanly coming out.',
		skill_weights: {
			marking: 1,
			kicking: 0.8,
			ground_ball: 0.55,
			tackling: 0.5,
			handball: 0.4,
			evasion: 0.2,
			goalkicking: 0.1,
			ruckwork: 0.1
		},
		physical_weights: {
			max_strength: 0.85,
			power: 0.8,
			robustness: 0.75,
			mobility: 0.55,
			agility: 0.5,
			acceleration: 0.5,
			aerobic_capacity: 0.5,
			aerobic_power: 0.4,
			repeat_sprint: 0.4,
			speed: 0.4
		}
	},
	{
		position: 'general_defender',
		group: 'defence',
		label: 'General defender',
		summary:
			'Rebounds off half-back. Reads the drop of the ball, wins it at ground level and sets up the counter with foot skills.',
		skill_weights: {
			kicking: 1,
			ground_ball: 0.8,
			evasion: 0.7,
			marking: 0.6,
			handball: 0.6,
			tackling: 0.55,
			goalkicking: 0.2,
			ruckwork: 0
		},
		physical_weights: {
			repeat_sprint: 0.9,
			aerobic_capacity: 0.85,
			acceleration: 0.8,
			aerobic_power: 0.75,
			agility: 0.7,
			speed: 0.7,
			robustness: 0.55,
			power: 0.5,
			max_strength: 0.5,
			mobility: 0.5
		}
	},
	{
		position: 'inside_midfielder',
		group: 'midfield',
		label: 'Inside midfielder',
		summary:
			'Lives in the contest. Wins the hard ball, hits a teammate by hand under pressure and lays the tackle when the ball goes the other way.',
		skill_weights: {
			ground_ball: 1,
			handball: 0.95,
			tackling: 0.9,
			kicking: 0.7,
			evasion: 0.6,
			marking: 0.35,
			goalkicking: 0.3,
			ruckwork: 0.1
		},
		physical_weights: {
			repeat_sprint: 1,
			max_strength: 0.9,
			aerobic_capacity: 0.9,
			aerobic_power: 0.8,
			power: 0.75,
			robustness: 0.7,
			acceleration: 0.7,
			agility: 0.6,
			speed: 0.5,
			mobility: 0.5
		}
	},
	{
		position: 'outside_midfielder',
		group: 'midfield',
		label: 'Outside midfielder',
		summary:
			'Runs the wing. Wins the ball on the outside with time and space, so the kick has to hit the target every time.',
		skill_weights: {
			kicking: 1,
			marking: 0.7,
			handball: 0.7,
			evasion: 0.65,
			ground_ball: 0.6,
			tackling: 0.4,
			goalkicking: 0.4,
			ruckwork: 0
		},
		physical_weights: {
			aerobic_capacity: 1,
			aerobic_power: 0.9,
			repeat_sprint: 0.9,
			speed: 0.85,
			acceleration: 0.7,
			agility: 0.6,
			power: 0.5,
			max_strength: 0.5,
			robustness: 0.5,
			mobility: 0.5
		}
	},
	{
		position: 'ruck',
		group: 'ruck',
		label: 'Ruck',
		summary:
			'Contests every bounce and throw-in, hits the drop zone for the mids, then works as a marking target around the ground.',
		skill_weights: {
			ruckwork: 1,
			marking: 0.8,
			ground_ball: 0.6,
			handball: 0.5,
			tackling: 0.5,
			kicking: 0.45,
			goalkicking: 0.3,
			evasion: 0.2
		},
		physical_weights: {
			max_strength: 1,
			power: 0.9,
			robustness: 0.8,
			mobility: 0.7,
			aerobic_capacity: 0.7,
			aerobic_power: 0.6,
			repeat_sprint: 0.6,
			acceleration: 0.5,
			agility: 0.4,
			speed: 0.35
		}
	},
	{
		position: 'key_forward',
		group: 'forward',
		label: 'Key forward',
		summary:
			'The tall target inside 50. Wins the mark or brings it to ground, and converts the set shot when it comes.',
		skill_weights: {
			marking: 1,
			goalkicking: 0.95,
			kicking: 0.5,
			tackling: 0.45,
			ground_ball: 0.4,
			handball: 0.3,
			evasion: 0.3,
			ruckwork: 0.2
		},
		physical_weights: {
			power: 0.9,
			max_strength: 0.85,
			acceleration: 0.7,
			robustness: 0.7,
			mobility: 0.6,
			aerobic_power: 0.5,
			agility: 0.5,
			speed: 0.5,
			repeat_sprint: 0.45,
			aerobic_capacity: 0.4
		}
	},
	{
		position: 'medium_forward',
		group: 'forward',
		label: 'Medium forward',
		summary:
			'Works between the arcs and inside 50. Leads hard at the ball, kicks straight and pushes up the ground when the forward line is empty.',
		skill_weights: {
			marking: 0.85,
			goalkicking: 0.8,
			kicking: 0.78,
			evasion: 0.6,
			ground_ball: 0.6,
			tackling: 0.55,
			handball: 0.5,
			ruckwork: 0
		},
		physical_weights: {
			acceleration: 0.85,
			speed: 0.8,
			power: 0.75,
			agility: 0.7,
			repeat_sprint: 0.7,
			aerobic_capacity: 0.65,
			aerobic_power: 0.6,
			max_strength: 0.6,
			robustness: 0.55,
			mobility: 0.5
		}
	},
	{
		position: 'small_forward',
		group: 'forward',
		label: 'Small forward',
		summary:
			'Crumbs at ground level and finishes on the run. Applies the forward-half tackle that keeps the ball locked in.',
		skill_weights: {
			goalkicking: 1,
			ground_ball: 0.9,
			evasion: 0.9,
			tackling: 0.8,
			handball: 0.6,
			kicking: 0.5,
			marking: 0.4,
			ruckwork: 0
		},
		physical_weights: {
			acceleration: 1,
			agility: 0.9,
			speed: 0.8,
			repeat_sprint: 0.8,
			power: 0.7,
			aerobic_capacity: 0.55,
			max_strength: 0.5,
			aerobic_power: 0.5,
			robustness: 0.5,
			mobility: 0.5
		}
	},
	{
		position: 'utility',
		group: 'utility',
		label: 'Utility',
		summary:
			'Plays wherever the side needs a body that week. Broad, even skill base beats a specialist strength.',
		skill_weights: {
			kicking: 0.75,
			handball: 0.7,
			ground_ball: 0.7,
			marking: 0.65,
			tackling: 0.6,
			evasion: 0.6,
			goalkicking: 0.5,
			ruckwork: 0.25
		},
		physical_weights: {
			aerobic_capacity: 0.7,
			repeat_sprint: 0.7,
			acceleration: 0.65,
			agility: 0.65,
			power: 0.6,
			max_strength: 0.6,
			speed: 0.6,
			aerobic_power: 0.6,
			robustness: 0.6,
			mobility: 0.55
		}
	}
];
