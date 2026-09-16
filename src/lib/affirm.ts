import { repo } from '$lib/data';
import {
	affirmation,
	type Affirmation,
	type AffirmationContext,
	type RepsEvent,
	type SessionEvent
} from '$lib/domain/affirmations';
import { currentStreak } from '$lib/domain/stats';
import { trainingDatesFromLogs } from '$lib/domain/schedule';
import { localDate } from '$lib/util/time';

/**
 * Assembles an `AffirmationContext` from storage and returns the line to show.
 *
 * Call this *after* the log or the tick has been saved — the streak and the
 * "is this the first thing ever" check both read back through the repo, so
 * they need the just-saved record to already be there. Composition only, same
 * as `plan.ts`: the actual rule for what to say lives in
 * `domain/affirmations.ts`.
 */
export async function loadAffirmation(event: RepsEvent | SessionEvent): Promise<Affirmation> {
	const today = localDate();
	const [name, repLogs, sessionLogs] = await Promise.all([
		repo.getDisplayName(),
		repo.listRepLogs({}),
		repo.listSessionLogs({})
	]);

	const completedSessions = sessionLogs.filter((log) => log.completed_at !== null);
	// Both queries already include the record this call is reacting to, so a
	// total of exactly one means there was nothing before it.
	const is_first = repLogs.length + completedSessions.length <= 1;

	const ctx: AffirmationContext = {
		name,
		today,
		is_first,
		streak: currentStreak(repLogs, today, trainingDatesFromLogs(completedSessions)),
		event
	};
	return affirmation(ctx);
}
