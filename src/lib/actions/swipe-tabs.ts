import { goto } from '$app/navigation';
import { nextTabHref } from '$lib/nav';

/**
 * How far the thumb travels before the gesture picks an axis. Below this the
 * travel is all noise — the first few pixels of a tap-and-scroll point
 * whichever way the thumb happened to roll.
 */
const AXIS_LOCK = 12;

/**
 * How far a horizontal drag goes before it changes tab, while the finger is
 * still down. Deliberately short: the page starts moving under the thumb mid
 * gesture, so the swipe feels answered rather than reviewed after the fact.
 */
const DISTANCE = 40;

/**
 * A fast flick is over before it travels far, so at lift-off a shorter drag
 * still counts if it was quick — distance in px, speed in px/ms.
 */
const FLICK_DISTANCE = 20;
const FLICK_VELOCITY = 0.3;

/**
 * Both screen edges are the OS's: iOS Safari reads an edge drag as back/forward
 * and there is no winning that fight, so gestures starting there are ignored
 * rather than half-handled by both.
 */
const EDGE_GUARD = 28;

/**
 * Anything that owns its own horizontal drag: the drills filter chip row
 * scrolls sideways, form controls drag their own values, and `data-no-swipe`
 * opts anything else out.
 */
function ownsHorizontalDrag(target: EventTarget | null): boolean {
	let el = target instanceof Element ? target : null;
	while (el) {
		if (el.closest('input, textarea, select, [data-no-swipe]')) return true;
		if (el.scrollWidth > el.clientWidth + 1) {
			const overflow = getComputedStyle(el).overflowX;
			if (overflow === 'auto' || overflow === 'scroll') return true;
		}
		el = el.parentElement;
	}
	return false;
}

/**
 * Horizontal swipes move between the bottom bar's tabs — the same four
 * destinations, reachable without moving the thumb up to the bar. Touch only:
 * these handlers never fire for a mouse, so nothing changes on a desktop.
 *
 * The gesture commits as soon as it is unambiguous, part way through the drag,
 * rather than at lift-off. Waiting for the finger to leave the glass adds the
 * length of the rest of the swipe to how long the app appears to take, which
 * reads as lag even when the navigation itself is instant.
 *
 * Deciding early means deciding on less evidence, so the axis is locked first:
 * once the thumb has moved `AXIS_LOCK` pixels, whichever way it went the
 * furthest is the way it is going, and a gesture that set off vertically is a
 * scroll and never reconsidered. Without that lock a short sideways wobble at
 * the top of a long scroll would change tab under the player.
 *
 * `pathname` has to be read at commit time rather than closed over, because the
 * action is attached once to the layout's `<main>` and outlives every page.
 */
export function swipeTabs(node: HTMLElement, pathname: () => string) {
	/**
	 * `pending` is a live gesture that has not travelled far enough to have an
	 * axis yet; `horizontal` is one that has, and is still eligible to fire.
	 * `idle` covers both a gesture that already fired and one ruled out.
	 */
	let phase: 'idle' | 'pending' | 'horizontal' = 'idle';
	let startX = 0;
	let startY = 0;
	let startedAt = 0;

	function commit(dx: number) {
		phase = 'idle';
		const href = nextTabHref(pathname(), dx < 0 ? 'left' : 'right');
		if (href) goto(href);
	}

	function onTouchStart(event: TouchEvent) {
		phase = 'idle';
		// A second finger means a pinch or a two-hand hold, not a swipe.
		if (event.touches.length !== 1) return;

		const touch = event.touches[0];
		if (touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) return;
		if (ownsHorizontalDrag(event.target)) return;

		startX = touch.clientX;
		startY = touch.clientY;
		startedAt = event.timeStamp;
		phase = 'pending';
	}

	function onTouchMove(event: TouchEvent) {
		if (phase === 'idle') return;
		if (event.touches.length !== 1) {
			phase = 'idle';
			return;
		}

		const touch = event.touches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;

		if (phase === 'pending') {
			if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
			// Ties go to scrolling: it is the gesture the page is really for.
			if (Math.abs(dx) <= Math.abs(dy)) {
				phase = 'idle';
				return;
			}
			phase = 'horizontal';
		}

		if (Math.abs(dx) >= DISTANCE) commit(dx);
	}

	function onTouchEnd(event: TouchEvent) {
		if (phase !== 'horizontal') {
			phase = 'idle';
			return;
		}
		phase = 'idle';

		const touch = event.changedTouches[0];
		if (!touch) return;

		// Anything past DISTANCE already fired mid-drag, so all that is left here
		// is the short, fast flick.
		const dx = touch.clientX - startX;
		const elapsed = event.timeStamp - startedAt;
		if (Math.abs(dx) < FLICK_DISTANCE) return;
		if (elapsed <= 0 || Math.abs(dx) / elapsed < FLICK_VELOCITY) return;

		commit(dx);
	}

	function onTouchCancel() {
		phase = 'idle';
	}

	// Passive throughout: the gesture never cancels the browser's own scrolling,
	// it only watches where the thumb went and decides whether that was sideways.
	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });
	node.addEventListener('touchcancel', onTouchCancel, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchCancel);
		}
	};
}
