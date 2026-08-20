import { SKILL_CATEGORIES, type Difficulty, type SkillCategory } from '$lib/types';
import type { DrillInput } from '$lib/data/repo';

export interface DrillImportError {
	/** 1-indexed data row, matching what a spreadsheet user would count (header excluded). */
	row: number;
	message: string;
}

export interface DrillImportResult {
	drills: DrillInput[];
	errors: DrillImportError[];
}

const REQUIRED_CSV_COLUMNS = [
	'name',
	'category',
	'summary',
	'setup',
	'min_players',
	'duration_minutes',
	'difficulty',
	'tracks_reps'
] as const;

/** Splits one CSV line into fields, honouring double-quoted fields with embedded commas and `""` escapes. */
function splitCsvLine(line: string): string[] {
	const fields: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"' && line[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			fields.push(field);
			field = '';
		} else {
			field += char;
		}
	}
	fields.push(field);
	return fields.map((f) => f.trim());
}

function splitList(value: string): string[] {
	return value
		.split(';')
		.map((v) => v.trim())
		.filter(Boolean);
}

/**
 * Parses drills from a CSV file: one header row, then one drill per row.
 * List fields (`coaching_points`, `equipment`, `position_tags`, `equipment_required`)
 * are semicolon-separated within their cell, since commas appear in free text.
 * Every row is validated independently — one bad row does not block the rest.
 */
export function parseDrillsCsv(text: string): DrillImportResult {
	const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
	if (lines.length === 0) return { drills: [], errors: [{ row: 0, message: 'File is empty' }] };

	const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
	const missing = REQUIRED_CSV_COLUMNS.filter((c) => !header.includes(c));
	if (missing.length > 0) {
		return {
			drills: [],
			errors: [{ row: 0, message: `Missing required column(s): ${missing.join(', ')}` }]
		};
	}

	const drills: DrillInput[] = [];
	const errors: DrillImportError[] = [];

	for (let i = 1; i < lines.length; i++) {
		const row = i; // 1-indexed data row, header already excluded
		const fields = splitCsvLine(lines[i]);
		const cell = (name: string): string => {
			const idx = header.indexOf(name);
			return idx === -1 ? '' : (fields[idx] ?? '');
		};

		const parsed = toDrillInput(
			{
				slug: cell('slug') || undefined,
				name: cell('name'),
				category: cell('category'),
				summary: cell('summary'),
				setup: cell('setup'),
				coaching_points: splitList(cell('coaching_points')),
				equipment: splitList(cell('equipment')),
				min_players: cell('min_players'),
				duration_minutes: cell('duration_minutes'),
				difficulty: cell('difficulty'),
				tracks_reps: cell('tracks_reps'),
				target_reps: cell('target_reps')
			},
			row
		);

		if ('error' in parsed) errors.push(parsed.error);
		else drills.push(parsed.drill);
	}

	return { drills, errors };
}

/** Parses drills from a JSON file: an array of objects shaped like `DrillInput`. */
export function parseDrillsJson(text: string): DrillImportResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { drills: [], errors: [{ row: 0, message: 'Not valid JSON' }] };
	}
	if (!Array.isArray(raw)) {
		return { drills: [], errors: [{ row: 0, message: 'Expected a JSON array of drills' }] };
	}

	const drills: DrillInput[] = [];
	const errors: DrillImportError[] = [];

	raw.forEach((entry, i) => {
		const row = i + 1;
		if (typeof entry !== 'object' || entry === null) {
			errors.push({ row, message: 'Not an object' });
			return;
		}
		const e = entry as Record<string, unknown>;
		const asString = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
		const asStringArray = (v: unknown) => (Array.isArray(v) ? v.map(asString) : []);

		const parsed = toDrillInput(
			{
				slug: typeof e.slug === 'string' ? e.slug : undefined,
				name: asString(e.name),
				category: asString(e.category),
				summary: asString(e.summary),
				setup: asString(e.setup),
				coaching_points: asStringArray(e.coaching_points),
				equipment: asStringArray(e.equipment),
				min_players: asString(e.min_players),
				duration_minutes: asString(e.duration_minutes),
				difficulty: asString(e.difficulty),
				tracks_reps: typeof e.tracks_reps === 'boolean' ? String(e.tracks_reps) : asString(e.tracks_reps),
				target_reps: e.target_reps == null ? '' : asString(e.target_reps),
				position_tags: asStringArray(e.position_tags),
				equipment_required: asStringArray(e.equipment_required)
			},
			row
		);

		if ('error' in parsed) errors.push(parsed.error);
		else drills.push(parsed.drill);
	});

	return { drills, errors };
}

interface RawDrillFields {
	slug?: string;
	name: string;
	category: string;
	summary: string;
	setup: string;
	coaching_points: string[];
	equipment: string[];
	min_players: string;
	duration_minutes: string;
	difficulty: string;
	tracks_reps: string;
	target_reps: string;
	position_tags?: string[];
	equipment_required?: string[];
}

function toDrillInput(
	raw: RawDrillFields,
	row: number
): { drill: DrillInput } | { error: DrillImportError } {
	const fail = (message: string) => ({ error: { row, message } });

	if (!raw.name.trim()) return fail('name is required');
	if (!SKILL_CATEGORIES.includes(raw.category as SkillCategory)) {
		return fail(`category '${raw.category}' is not one of: ${SKILL_CATEGORIES.join(', ')}`);
	}
	if (!raw.summary.trim()) return fail('summary is required');
	if (!raw.setup.trim()) return fail('setup is required');

	const minPlayers = Number(raw.min_players);
	if (!Number.isInteger(minPlayers) || minPlayers < 1) {
		return fail(`min_players must be a positive whole number, got '${raw.min_players}'`);
	}

	const durationMinutes = Number(raw.duration_minutes);
	if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
		return fail(`duration_minutes must be a positive number, got '${raw.duration_minutes}'`);
	}

	const difficultyNum = Number(raw.difficulty);
	if (![1, 2, 3].includes(difficultyNum)) {
		return fail(`difficulty must be 1, 2 or 3, got '${raw.difficulty}'`);
	}

	const tracksRepsNormalised = raw.tracks_reps.trim().toLowerCase();
	if (!['true', 'false'].includes(tracksRepsNormalised)) {
		return fail(`tracks_reps must be 'true' or 'false', got '${raw.tracks_reps}'`);
	}
	const tracksReps = tracksRepsNormalised === 'true';

	let targetReps: number | null = null;
	if (raw.target_reps.trim()) {
		const n = Number(raw.target_reps);
		if (!Number.isInteger(n) || n < 1) {
			return fail(`target_reps must be a positive whole number, got '${raw.target_reps}'`);
		}
		targetReps = n;
	}

	return {
		drill: {
			slug: raw.slug?.trim() || undefined,
			name: raw.name.trim(),
			category: raw.category as SkillCategory,
			summary: raw.summary.trim(),
			setup: raw.setup.trim(),
			coaching_points: raw.coaching_points,
			equipment: raw.equipment,
			min_players: minPlayers,
			duration_minutes: durationMinutes,
			difficulty: difficultyNum as Difficulty,
			tracks_reps: tracksReps,
			target_reps: targetReps,
			position_tags: (raw.position_tags ?? []) as DrillInput['position_tags'],
			equipment_required: (raw.equipment_required ?? []) as DrillInput['equipment_required']
		}
	};
}
