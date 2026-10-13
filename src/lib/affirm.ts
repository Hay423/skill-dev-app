import { repo } from '$lib/data';
import {
	affirmation,
	type Affirmation,
	type AffirmationContext,
	type RepsEvent,
	type SessionEvent,
	type TestEvent
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
export async function loadAffirmation(
	event: RepsEvent | SessionEvent | TestEvent
): Promise<Affirmation> {
	const today = localDate();
	const [name, repLogs, sessionLogs, testResults] = await Promise.all([
		repo.getDisplayName(),
		repo.listRepLogs({}),
		repo.listSessionLogs({}),
		repo.listTestResults()
	]);

	const completedSessions = sessionLogs.filter((log) => log.completed_at !== null);
	// Every query already includes the record this call is reacting to, so a
	// total of exactly one means there was nothing before it. A sat test counts:
	// for most players the baseline is the first thing they ever record, and
	// being told "first one's in the book" afterwards should not depend on
	// whether they happened to log reps first.
	const is_first = repLogs.length + completedSessions.length + testResults.length <= 1;

	const ctx: AffirmationContext = {
		name,
		today,
		is_first,
		streak: currentStreak(repLogs, today, trainingDatesFromLogs(completedSessions)),
		event
	};
	return affirmation(ctx);
}
