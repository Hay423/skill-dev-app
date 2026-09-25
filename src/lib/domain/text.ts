/**
 * Sentence fragments shared by the layers that explain themselves.
 *
 * Lives on its own because both the eligibility filter (`recommend.ts`) and the
 * player's own filter (`drill-filter.ts`) build "needs a, b and c" lists, and
 * two copies would drift the first time one of them gained an Oxford comma.
 */

/** `['a']` → `a`; `['a','b']` → `a and b`; `['a','b','c']` → `a, b and c`. */
export function formatList(items: string[]): string {
	if (items.length <= 1) return items[0] ?? '';
	return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
