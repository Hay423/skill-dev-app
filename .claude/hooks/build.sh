#!/usr/bin/env bash
#
# Build the app, and hand the running preview server the result.
#
# Wired to the Stop hook (see .claude/settings.local.json), so it runs at the
# end of every turn. CLAUDE.md explains why the build matters: `vite preview` on
# port 4173 is what `tailscale serve` proxies the HTTPS site to, so an unbuilt
# change never reaches the phone.
#
# Two things here are not obvious:
#
# 1. It skips the build when nothing was edited. A Stop hook fires on every
#    turn, including ones that only answered a question, and on /clear and
#    compact. Building each time would cost five seconds and bounce the server
#    for no reason.
#
# 2. It restarts the preview server rather than leaving it running. A rebuild
#    replaces the content-hashed assets underneath it, and the server dies with
#    an unhandled ENOENT the next time anything asks for a hash that no longer
#    exists. Preview reads a file per request, so it does pick up new content —
#    right up until it is asked for an old asset and crashes. Restarting is the
#    only way a build leaves the site both current *and* standing.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 0

PORT=4173
STAMP=.svelte-kit/.last-hook-build

# Emit a line for the user in the Claude Code UI. A Stop hook's stdout is
# otherwise invisible unless it errors.
note() {
	printf '{"systemMessage": %s}\n' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')"
}

# --- 1. Is there anything to build? ------------------------------------------
#
# Compared against a stamp this script owns rather than against build/index.html,
# because a build writes its own output and would otherwise always look current.
# No stamp (a fresh clone, a cleaned tree) counts as stale.
if [ -f "$STAMP" ]; then
	changed=$(find src static package.json svelte.config.js vite.config.ts \
		-type f -newer "$STAMP" -print -quit 2>/dev/null)
	if [ -z "$changed" ]; then
		exit 0
	fi
fi

# --- 2. Build ----------------------------------------------------------------
if ! build_output=$(npm run build 2>&1); then
	# Deliberately loud, and deliberately not fatal to the turn: a broken build
	# is worth interrupting for, but the work in the transcript is still sound.
	#
	# The whole output goes to a log and only the line naming the problem goes
	# in the message. The tail of a rolldown failure is stack frames inside
	# node_modules, which says nothing about what is actually wrong.
	log="$STAMP.log"
	mkdir -p "$(dirname "$log")"
	printf '%s\n' "$build_output" >"$log"
	reason=$(printf '%s' "$build_output" |
		sed 's/\x1b\[[0-9;]*m//g' |
		grep -vE '^\s*at |^\s*errors:|^Build failed with|^error during build' |
		grep -iE 'error|expected|cannot|unexpected|not found' |
		head -1 | cut -c1-200)
	# Deliberately not "the previous build still serves". A failed build empties
	# `.svelte-kit/output` before it fails, and that is exactly what preview
	# reads — so a running server dies on its next request and a new one refuses
	# to start at all ("Server files not found"). The site is down until the
	# build is fixed, and saying otherwise would send somebody looking at
	# Tailscale instead of at their own last edit.
	note "Build FAILED — the site is DOWN until this is fixed. ${reason:-No error line found} — full output in $log"
	exit 0
fi

mkdir -p "$(dirname "$STAMP")"
touch "$STAMP"

# --- 3. Hand it to the preview server ----------------------------------------
#
# Only restarts a server that was already up. Starting one the user never asked
# for would be a hook quietly launching a long-lived process.
pid=$(netstat -ano 2>/dev/null | grep -E "LISTENING" | grep -E ":$PORT\b" | awk '{print $NF}' | head -1)

if [ -z "${pid:-}" ]; then
	note "Built. Preview is not running, so the HTTPS site is not serving this — start it with: npm run preview"
	exit 0
fi

taskkill //PID "$pid" //F >/dev/null 2>&1

# Detached, and its output thrown away: this has to outlive the hook, which
# exits in a moment.
(
	cd "$(pwd)" || exit
	nohup npm run preview >/dev/null 2>&1 &
) >/dev/null 2>&1

# Wait for it to answer rather than assuming it came back, so the message is
# true. Preview binds in well under a second; five is slack, not an expectation.
for _ in $(seq 1 25); do
	if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/"; then
		note "Built, and preview restarted on $PORT — the HTTPS site is serving this change."
		exit 0
	fi
	sleep 0.2
done

note "Built, but preview did not come back on $PORT — the site is down until you run: npm run preview"
exit 0
