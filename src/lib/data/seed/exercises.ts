import type { Exercise } from '$lib/types';

/**
 * The starting exercise library.
 *
 * Reference content, and meant to be replaced: the Phase 2 content importer
 * (see plans/player-profile.md) will emit this same shape from CSV. Until then
 * these are a considered starting point authored to cover the bundled programs
 * in `programs.ts`, not an exhaustive library.
 *
 * Ids are hard-coded and permanent, for the same reason drill ids are: program
 * items reference them, and an id that moved between releases would silently
 * repoint a prescription at a different lift. `slug` is the natural key.
 *
 * Two fields carry the duty of care and are not cosmetic:
 *
 * - `min_age_group` is the floor this movement may be prescribed at. Nothing
 *   holding external load sits below `u17`, which is also the floor the
 *   recommendation layer applies to strength programs as a whole
 *   (`STRENGTH_MIN_AGE_GROUP` in `domain/recommend.ts`).
 * - `equipment_required` is the *minimum* kit the movement needs, not the kit
 *   it is nicest with. A walking lunge needs nothing because it works
 *   unloaded; the program that prescribes it loaded is what declares the
 *   dumbbells.
 *
 * `contraindicated_regions` is authored but not currently read — injury flags
 * are forked out to `src/lib/injuries/` (dormant). It costs nothing to keep the
 * content honest so re-enabling stays a wiring job.
 */
export const SEED_EXERCISES: Exercise[] = [
	// --- Bodyweight and movement-skill work. Prescribable at any age. ---
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d01',
		slug: 'bodyweight-squat',
		name: 'Bodyweight squat',
		movement_pattern: 'squat',
		primary_qualities: ['mobility', 'robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['knee'],
		coaching_points: [
			'Feet about shoulder width, toes turned out slightly',
			'Sit between the hips rather than folding forward at the waist',
			'Knees track over the middle toes, never collapsing inward',
			'Stop at the depth you can hold, not the depth you can reach'
		],
		regression_slug: null,
		progression_slug: 'goblet-squat'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d02',
		slug: 'split-squat',
		name: 'Split squat',
		movement_pattern: 'lunge',
		primary_qualities: ['robustness', 'max_strength'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['knee', 'hip'],
		coaching_points: [
			'Front shin close to vertical, back knee dropping straight down',
			'Trunk tall — resist leaning onto the front thigh',
			'Even reps both sides, weaker leg first'
		],
		regression_slug: null,
		progression_slug: 'walking-lunge'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d03',
		slug: 'push-up',
		name: 'Push-up',
		movement_pattern: 'push',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Body in one line from ear to ankle, ribs down',
			'Elbows back at about 45°, not flared square',
			'Raise the hands onto a bench before letting the hips sag'
		],
		regression_slug: null,
		progression_slug: 'db-bench-press'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d04',
		slug: 'inverted-row',
		name: 'Inverted row',
		movement_pattern: 'pull',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Any waist-height bar or sturdy rail will do',
			'Squeeze the shoulder blades before the arms bend',
			'Walk the feet in to make it easier, out to make it harder'
		],
		regression_slug: null,
		progression_slug: 'chin-up'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d05',
		slug: 'glute-bridge',
		name: 'Glute bridge',
		movement_pattern: 'hinge',
		primary_qualities: ['robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['back'],
		coaching_points: [
			'Drive through the heels and finish with the hips, not the lower back',
			'Ribs stay down — the finish is a straight line, not an arch',
			'Hold the top for a beat each rep'
		],
		accessory_dose: { sets: 3, reps: '12', rest_seconds: 45 },
		regression_slug: null,
		progression_slug: 'barbell-hip-thrust'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d06',
		slug: 'plank',
		name: 'Plank',
		movement_pattern: 'core',
		primary_qualities: ['robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['back', 'shoulder'],
		coaching_points: [
			'Elbows under the shoulders, hips level with the shoulders',
			'Brace as if about to be bumped, then breathe normally',
			'End the set when the hips drop, not when the clock does'
		],
		accessory_dose: { sets: 3, reps: '30 s hold', rest_seconds: 45 },
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d07',
		slug: 'side-plank',
		name: 'Side plank',
		movement_pattern: 'core',
		primary_qualities: ['robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['shoulder', 'back'],
		coaching_points: [
			'Stack the shoulders, hips and ankles in one line',
			'Push the bottom shoulder away from the ear',
			'Both sides, weaker side first'
		],
		accessory_dose: { sets: 3, reps: '30 s each side', rest_seconds: 45 },
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d08',
		slug: 'dead-bug',
		name: 'Dead bug',
		movement_pattern: 'core',
		primary_qualities: ['robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['back'],
		coaching_points: [
			'Lower back stays flat on the ground for the whole set',
			'Opposite arm and leg, slow and controlled',
			'Exhale as the limbs reach away'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d09',
		slug: 'single-leg-balance',
		name: 'Single-leg balance',
		movement_pattern: 'core',
		primary_qualities: ['robustness', 'agility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['ankle'],
		coaching_points: [
			'Soft knee, weight spread across the whole foot',
			'Progress by closing the eyes or standing on grass',
			'Ankle insurance — do both legs'
		],
		accessory_dose: { sets: 2, reps: '30 s each leg', rest_seconds: 30 },
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d0a',
		slug: 'a-skip',
		name: 'A-skip',
		movement_pattern: 'plyometric',
		primary_qualities: ['speed', 'acceleration'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['ankle', 'quad'],
		coaching_points: [
			'Tall posture, knee up to hip height',
			'Strike down under the hip, not out in front',
			'Rhythm over height'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d0b',
		slug: 'ankling',
		name: 'Ankling',
		movement_pattern: 'plyometric',
		primary_qualities: ['speed'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['ankle'],
		coaching_points: [
			'Short, quick foot contacts straight under the hips',
			'Ankles stay stiff and springy — no heel collapse',
			'Cover ground slowly; the point is the contact, not the pace'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d0c',
		slug: 'pogo-hops',
		name: 'Pogo hops',
		movement_pattern: 'plyometric',
		primary_qualities: ['power', 'robustness'],
		equipment_required: [],
		min_age_group: 'u13',
		contraindicated_regions: ['ankle', 'knee'],
		coaching_points: [
			'Straight legs, all the movement at the ankle',
			'Minimum time on the ground — think hot sand',
			'On grass, in runners'
		],
		regression_slug: null,
		progression_slug: 'box-jump'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d0d',
		slug: 'drop-landing',
		name: 'Drop landing',
		movement_pattern: 'plyometric',
		primary_qualities: ['robustness', 'power'],
		equipment_required: [],
		min_age_group: 'u13',
		contraindicated_regions: ['knee', 'ankle'],
		coaching_points: [
			'Step off a low box and stick the landing — no jump up',
			'Land quietly through the whole foot, hips back, knees out',
			'Hold the landing for two seconds before resetting'
		],
		regression_slug: null,
		progression_slug: 'box-jump'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d0e',
		slug: 'band-pull-apart',
		name: 'Band pull-apart',
		movement_pattern: 'pull',
		primary_qualities: ['robustness', 'mobility'],
		equipment_required: ['bands'],
		min_age_group: 'u11',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Arms long, pull the band apart at chest height',
			'Shoulder blades do the work, not the neck',
			'Light band, high reps — this is shoulder maintenance'
		],
		regression_slug: null,
		progression_slug: null
	},

	// --- Loaded work. Nothing below u17, and nothing at %1RM below senior. ---
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d10',
		slug: 'goblet-squat',
		name: 'Goblet squat',
		movement_pattern: 'squat',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: ['home_weights'],
		min_age_group: 'u17',
		contraindicated_regions: ['knee', 'back'],
		coaching_points: [
			'One dumbbell or kettlebell at the chest, elbows tucked in',
			'The weight is a counterbalance — it lets you sit deeper, not load heavier',
			'End the set when depth or knee position changes'
		],
		regression_slug: 'bodyweight-squat',
		progression_slug: 'back-squat'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d11',
		slug: 'db-romanian-deadlift',
		name: 'Dumbbell Romanian deadlift',
		movement_pattern: 'hinge',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: ['home_weights'],
		min_age_group: 'u17',
		contraindicated_regions: ['back', 'hamstring'],
		coaching_points: [
			'Push the hips back, dumbbells tracking down the thighs',
			'Soft knees, flat back — the stretch belongs in the hamstring',
			'Only go as low as the back stays flat'
		],
		regression_slug: 'glute-bridge',
		progression_slug: 'trap-bar-deadlift'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d12',
		slug: 'db-bench-press',
		name: 'Dumbbell bench press',
		movement_pattern: 'push',
		primary_qualities: ['max_strength'],
		equipment_required: ['home_weights'],
		min_age_group: 'u17',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Shoulder blades pinned into the bench before the first rep',
			'Lower to chest height under control, no bouncing',
			'Keep a rep or two in reserve on every set'
		],
		regression_slug: 'push-up',
		progression_slug: 'barbell-bench-press'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d13',
		slug: 'db-row',
		name: 'Dumbbell row',
		movement_pattern: 'pull',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: ['home_weights'],
		min_age_group: 'u17',
		contraindicated_regions: ['back', 'shoulder'],
		coaching_points: [
			'Hinge to about 45°, back flat, free hand braced on a bench',
			'Pull to the hip, not the shoulder',
			'No twisting through the trunk to finish the rep'
		],
		regression_slug: 'inverted-row',
		progression_slug: 'barbell-row'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d14',
		slug: 'walking-lunge',
		name: 'Walking lunge',
		movement_pattern: 'lunge',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['knee', 'hip'],
		coaching_points: [
			'Step out far enough that the front shin stays near vertical',
			'Trunk upright, back knee low and controlled',
			'Add dumbbells only once the unloaded version is smooth'
		],
		regression_slug: 'split-squat',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d15',
		slug: 'nordic-curl-assisted',
		name: 'Assisted nordic curl',
		movement_pattern: 'hinge',
		primary_qualities: ['robustness', 'max_strength'],
		equipment_required: [],
		min_age_group: 'u17',
		contraindicated_regions: ['hamstring', 'knee'],
		coaching_points: [
			'Ankles anchored, hips locked in line with the shoulders',
			'Lower as slowly as you can, then push off the hands to return',
			'Build reps up slowly — expect soreness in the first fortnight'
		],
		accessory_dose: { sets: 3, reps: '5', rest_seconds: 90 },
		regression_slug: 'glute-bridge',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d16',
		slug: 'chin-up',
		name: 'Chin-up',
		movement_pattern: 'pull',
		primary_qualities: ['max_strength'],
		equipment_required: [],
		min_age_group: 'u17',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Full hang to chin over the bar, no kipping',
			'Use a band or a partner rather than cutting the range short',
			'Shoulder blades down and back before the pull starts'
		],
		regression_slug: 'inverted-row',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d20',
		slug: 'back-squat',
		name: 'Back squat',
		movement_pattern: 'squat',
		primary_qualities: ['max_strength', 'power'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: ['knee', 'back', 'hip'],
		coaching_points: [
			'Bar tight on the upper back, whole foot driving into the floor',
			'Brace before the descent, not on the way up',
			'Squat in a rack with the safety pins set, every set'
		],
		regression_slug: 'goblet-squat',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d21',
		slug: 'trap-bar-deadlift',
		name: 'Trap bar deadlift',
		movement_pattern: 'hinge',
		primary_qualities: ['max_strength', 'power'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: ['back', 'hamstring'],
		coaching_points: [
			'Hips between a squat and a deadlift, chest proud, lats tight',
			'Push the floor away rather than pulling with the back',
			'Reset the brace between every rep'
		],
		regression_slug: 'db-romanian-deadlift',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d22',
		slug: 'barbell-bench-press',
		name: 'Barbell bench press',
		movement_pattern: 'push',
		primary_qualities: ['max_strength'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Feet planted, shoulder blades retracted, small natural arch',
			'Bar to the lower chest, elbows at about 45°',
			'Never press heavy without a spotter or the safety pins set'
		],
		regression_slug: 'db-bench-press',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d23',
		slug: 'barbell-row',
		name: 'Barbell row',
		movement_pattern: 'pull',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: ['back', 'shoulder'],
		coaching_points: [
			'Hinge to roughly 45°, back flat and locked there for the set',
			'Pull to the belly button, pause, lower under control',
			'Drop the weight before the back rounds'
		],
		regression_slug: 'db-row',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d24',
		slug: 'barbell-hip-thrust',
		name: 'Barbell hip thrust',
		movement_pattern: 'hinge',
		primary_qualities: ['power', 'max_strength'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: ['back', 'hip'],
		coaching_points: [
			'Shoulder blades on the bench, chin tucked, pad on the hips',
			'Finish with the glutes and hold — ribs stay down',
			'Shins vertical at the top'
		],
		regression_slug: 'glute-bridge',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d25',
		slug: 'power-clean',
		name: 'Power clean',
		movement_pattern: 'olympic',
		primary_qualities: ['power', 'speed'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: ['back', 'shoulder', 'knee'],
		coaching_points: [
			'Technique before load, every session — this is a skill lift',
			'Bar close to the body, extend the hips fully before the arms bend',
			'Get coached in person before loading this one up'
		],
		regression_slug: 'trap-bar-deadlift',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d26',
		slug: 'box-jump',
		name: 'Box jump',
		movement_pattern: 'plyometric',
		primary_qualities: ['power', 'acceleration'],
		equipment_required: ['full_gym'],
		min_age_group: 'u17',
		contraindicated_regions: ['knee', 'ankle'],
		coaching_points: [
			'Jump high, land soft and tall on the box — never crash into a deep landing',
			'Step down, never jump down',
			'End the set the moment height drops off'
		],
		regression_slug: 'pogo-hops',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d30',
		slug: 'lateral-bound',
		name: 'Lateral bound',
		movement_pattern: 'plyometric',
		primary_qualities: ['agility', 'acceleration', 'power'],
		equipment_required: [],
		min_age_group: 'u13',
		contraindicated_regions: ['ankle', 'knee', 'groin'],
		coaching_points: [
			'Push sideways off the outside foot and stick the landing',
			'Land with the knee out over the foot, not falling inwards',
			'Quality over distance — stop when the landings get noisy'
		],
		accessory_dose: { sets: 3, reps: '5 each side', rest_seconds: 90 },
		regression_slug: 'single-leg-balance',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d31',
		slug: 'single-leg-hop-and-stick',
		name: 'Single-leg hop and stick',
		movement_pattern: 'plyometric',
		primary_qualities: ['agility', 'robustness'],
		equipment_required: [],
		min_age_group: 'u13',
		contraindicated_regions: ['ankle', 'knee'],
		coaching_points: [
			'Hop forward and hold the landing for two full seconds',
			'Soft knee, hip back, no wobble before you reset',
			'This is what an ankle needs to survive a contest'
		],
		accessory_dose: { sets: 3, reps: '4 each leg', rest_seconds: 60 },
		regression_slug: 'single-leg-balance',
		progression_slug: 'lateral-bound'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d32',
		slug: 'copenhagen-adductor',
		name: 'Copenhagen adductor hold',
		movement_pattern: 'core',
		primary_qualities: ['robustness'],
		equipment_required: [],
		min_age_group: 'u17',
		contraindicated_regions: ['groin', 'hip'],
		coaching_points: [
			'Top leg on a bench, body in one line, hold',
			'Start with the bottom knee down and build from there',
			'Groins go in round one — this is the cheapest insurance in football'
		],
		accessory_dose: { sets: 3, reps: '20 s each side', rest_seconds: 45 },
		regression_slug: 'side-plank',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d33',
		slug: 'farmers-carry',
		name: "Farmer's carry",
		movement_pattern: 'carry',
		primary_qualities: ['max_strength', 'robustness'],
		equipment_required: ['home_weights'],
		min_age_group: 'u17',
		contraindicated_regions: ['back', 'shoulder'],
		coaching_points: [
			'Heaviest dumbbells you can hold, tall posture, walk',
			'Shoulders back and down, ribs stacked over the hips',
			'Stop the set when the posture goes, not when the grip does'
		],
		accessory_dose: { sets: 3, reps: '20 m', rest_seconds: 60 },
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d34',
		slug: 'db-overhead-press',
		name: 'Dumbbell overhead press',
		movement_pattern: 'push',
		primary_qualities: ['max_strength', 'power'],
		equipment_required: ['home_weights'],
		min_age_group: 'u17',
		contraindicated_regions: ['shoulder', 'back'],
		coaching_points: [
			'Ribs down and glutes tight before the dumbbells move',
			'Press to a full lockout with the arms beside the ears',
			'The overhead position a ruck lives in — own it under control'
		],
		accessory_dose: { sets: 3, reps: '8', rest_seconds: 90 },
		regression_slug: 'push-up',
		progression_slug: null
	},

	// --- Reactive plyometrics. Bodyweight, but the most demanding work here:
	// every one of these is prescribed by quality and stops when the landings
	// get loud. See the plyometric blocks in `programs.ts`. ---
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d35',
		slug: 'broad-jump',
		name: 'Standing broad jump',
		movement_pattern: 'plyometric',
		primary_qualities: ['power', 'acceleration'],
		equipment_required: [],
		min_age_group: 'u13',
		contraindicated_regions: ['knee', 'ankle', 'hamstring'],
		coaching_points: [
			'Swing the arms back, then drive them forward and jump for distance',
			'Land on both feet and stick it — a stumble forward is a jump you were not in control of',
			'Reset fully between jumps; the last one should go as far as the first'
		],
		accessory_dose: { sets: 3, reps: '4', rest_seconds: 90 },
		regression_slug: 'pogo-hops',
		progression_slug: 'bounding'
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d36',
		slug: 'bounding',
		name: 'Bounding',
		movement_pattern: 'plyometric',
		primary_qualities: ['power', 'speed', 'acceleration'],
		equipment_required: [],
		min_age_group: 'u15',
		contraindicated_regions: ['hamstring', 'knee', 'ankle', 'quad'],
		coaching_points: [
			'Long, exaggerated strides — reach for ground rather than pushing off it',
			'Drive the opposite knee up and through, arms working hard',
			'On grass only, and never on a leg that is already sore'
		],
		accessory_dose: { sets: 4, reps: '20 m', rest_seconds: 90 },
		regression_slug: 'broad-jump',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d37',
		slug: 'hurdle-hop',
		name: 'Hurdle hop',
		movement_pattern: 'plyometric',
		primary_qualities: ['power', 'agility', 'robustness'],
		equipment_required: [],
		min_age_group: 'u15',
		contraindicated_regions: ['ankle', 'knee'],
		coaching_points: [
			'Low obstacles — a line of cones or a folded towel is plenty',
			'Land and leave: stiff ankles, minimum ground contact, no pause between hops',
			'Stop the set the moment the contacts get loud or the rhythm breaks'
		],
		accessory_dose: { sets: 3, reps: '5 hops', rest_seconds: 90 },
		regression_slug: 'pogo-hops',
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d38',
		slug: 'depth-jump',
		name: 'Depth jump',
		movement_pattern: 'plyometric',
		primary_qualities: ['power', 'speed'],
		equipment_required: ['full_gym'],
		min_age_group: 'u17',
		contraindicated_regions: ['knee', 'ankle', 'hamstring', 'back'],
		coaching_points: [
			'Step off a low box, then jump straight back up the instant you land',
			'The ground contact is the whole point — if you sink into it, the box is too high',
			'Five jumps is a set. This is the most demanding thing in the block, and the first to be cut when the legs are flat'
		],
		accessory_dose: { sets: 3, reps: '4', rest_seconds: 150 },
		regression_slug: 'drop-landing',
		progression_slug: null
	},
	// --- Warm-up and cool-down. Range-of-motion work stamped into sessions by
	// the routines in `routines.ts`, never prescribed as main work. Bodyweight
	// and open to every age: a warm-up is the last thing to withhold from a
	// junior. ---
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d39',
		slug: 'leg-swings',
		name: 'Leg swings',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hip', 'groin'],
		coaching_points: [
			'Hold something steady and swing one leg front to back, then across the body',
			'Start small and let each swing get a little bigger',
			'Tall through the standing leg — the hip moves, the back does not'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d3a',
		slug: 'walking-knee-hug',
		name: 'Walking knee hug',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hip', 'knee'],
		coaching_points: [
			'Step, pull one knee to the chest and rise onto the toes of the standing foot',
			'Hold for a beat, then step through and swap legs',
			'Stand tall — pull the knee up to you rather than bending down to it'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d3b',
		slug: 'walking-hip-openers',
		name: 'Walking hip openers',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hip', 'groin'],
		coaching_points: [
			'Lift the knee to the front and circle it out to the side, like stepping over a gate',
			'Then reverse it: knee out to the side and round to the front',
			'Slow and wide — this is the groin you will be asking to change direction later'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d3c',
		slug: 'worlds-greatest-stretch',
		name: 'World’s greatest stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hip', 'groin', 'back'],
		coaching_points: [
			'Step into a long lunge and put the same-side hand down inside the front foot',
			'Drop the elbow towards the instep, then rotate and reach that arm to the sky',
			'Back knee off the ground, and follow the hand with your eyes'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d3d',
		slug: 'inchworm',
		name: 'Inchworm',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility', 'robustness'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hamstring', 'shoulder', 'back'],
		coaching_points: [
			'Fold forward, walk the hands out to a push-up position, then walk the feet up to them',
			'Legs as straight as the hamstrings allow — bend the knees rather than force it',
			'Keep the hips level when the hands are out front'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d3e',
		slug: 'arm-circles',
		name: 'Arm circles',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Arms out to the side, small circles growing into big ones',
			'Forwards, then backwards',
			'Keep the shoulders down away from the ears'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d3f',
		slug: 'open-book',
		name: 'Open book',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['back', 'shoulder'],
		coaching_points: [
			'Lie on your side, knees bent and stacked, arms out straight in front',
			'Open the top arm across to the other side, following it with your eyes',
			'Let the upper back turn; the knees stay together on the ground'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d40',
		slug: 'carioca',
		name: 'Carioca',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility', 'agility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['groin', 'knee'],
		coaching_points: [
			'Move sideways, the trailing leg crossing in front then behind',
			'Let the hips turn while the shoulders stay square',
			'Lead with both sides — one length each way'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d41',
		slug: 'calf-stretch',
		name: 'Calf stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['ankle'],
		coaching_points: [
			'Hands on a wall, post or fence, one foot back with the heel pressed down',
			'Straight back knee for the calf, then bend it slightly for the lower calf and Achilles',
			'Ease into it — a stretch, not a pain'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d42',
		slug: 'hamstring-stretch',
		name: 'Hamstring stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hamstring', 'back'],
		coaching_points: [
			'Lie on your back and raise one straight leg, hands behind the thigh',
			'Draw it towards you until you feel the back of the leg — then stop there',
			'The other leg stays long on the ground'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d43',
		slug: 'quad-stretch',
		name: 'Quad stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['quad', 'knee'],
		coaching_points: [
			'Stand on one leg and hold the other ankle behind you',
			'Knees together and hips pushed slightly forward',
			'Hold onto something if the balance is the hard part'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d44',
		slug: 'hip-flexor-stretch',
		name: 'Kneeling hip flexor stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hip', 'knee'],
		coaching_points: [
			'Half-kneel, back knee on the ground and front foot flat',
			'Tuck the tail under and squeeze the glute of the back leg, then shift forward a little',
			'You should feel it across the front of the back hip, not in the lower back'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d45',
		slug: 'glute-stretch',
		name: 'Figure-four glute stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['hip', 'back'],
		coaching_points: [
			'Lie on your back and cross one ankle over the opposite knee',
			'Pull the bottom thigh towards your chest',
			'Keep the head and shoulders relaxed on the ground'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d46',
		slug: 'groin-stretch',
		name: 'Butterfly groin stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['groin', 'hip'],
		coaching_points: [
			'Sit tall with the soles of the feet together',
			'Let the knees drop towards the ground — elbows can press them gently',
			'Tall through the spine rather than rounding over'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d47',
		slug: 'chest-stretch',
		name: 'Chest stretch',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['shoulder'],
		coaching_points: [
			'Forearm flat against a post or a doorway, elbow at shoulder height',
			'Turn the chest slowly away from the arm',
			'Hold both sides'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d48',
		slug: 'childs-pose',
		name: 'Child’s pose',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: ['back', 'knee'],
		coaching_points: [
			'Kneel, sit back onto the heels and reach the arms long in front',
			'Walk the hands to one side, then the other, to find the lats',
			'Breathe into the back of the ribs'
		],
		regression_slug: null,
		progression_slug: null
	},
	{
		id: '2d7e5b14-8c3a-4d62-9e05-1f2a3b4c5d49',
		slug: 'recovery-breathing',
		name: 'Recovery breathing',
		movement_pattern: 'mobility',
		primary_qualities: ['mobility'],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: [],
		coaching_points: [
			'Lie on your back, knees bent, one hand on the belly',
			'In through the nose for four, out through the mouth for six',
			'The long breath out is what brings the heart rate down'
		],
		regression_slug: null,
		progression_slug: null
	}
];
