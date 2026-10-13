#!/usr/bin/env bash
#
# Bring the app up from a cold boot: build, then start preview (4173, what
# `tailscale serve` proxies to the phone) and dev (5173, hot reload) detached
# so they survive after this script exits.
#
# Wired to a Windows Scheduled Task that fires at logon (see
# scripts/register-boot-task.ps1) — not a Claude Code hook. Nothing here
# depends on Claude Code being open.
#
# Mirrors .claude/hooks/build.sh's restart logic (CLAUDE.md explains why a
# build and a running preview can't coexist without a restart), but this is
# a cold start rather than a rebuild-after-edit: it always builds, and starts
# both servers unconditionally rather than only restarting one already up.

set -uo pipefail

# Backslashes normalised first: when Task Scheduler invokes this with a
# Windows-style path, `dirname` sees no separators and returns ".", which would
# put the build one directory above the repo.
self="${BASH_SOURCE[0]//\\//}"
cd "$(dirname "$self")/.." || exit 1

# The repo root is where this script builds and kills ports, so refuse to do
# either from the wrong place rather than guessing.
if [ ! -f package.json ]; then
	echo "boot-app.sh: not in the repo root (pwd=$(pwd)) - refusing to build" >&2
	exit 1
fi

LOG_DIR=.boot-logs
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$LOG_DIR"

# Give networking (and Tailscale) a moment to come up after login before we
# bind ports or get judged by anything checking reachability.
sleep 10

kill_port() {
	local port="$1"
	local pid
	pid=$(netstat -ano 2>/dev/null | grep -E "LISTENING" | grep -E ":$port\b" | awk '{print $NF}' | head -1)
	if [ -n "${pid:-}" ]; then
		taskkill //PID "$pid" //F >/dev/null 2>&1
	fi
}

kill_port 4173
kill_port 5173

if ! npm run build >"$LOG_DIR/build-$STAMP.log" 2>&1; then
	echo "Build failed at $STAMP — not starting preview against a stale/missing build. See $LOG_DIR/build-$STAMP.log" >>"$LOG_DIR/boot.log"
	exit 1
fi

(nohup npm run preview >"$LOG_DIR/preview-$STAMP.log" 2>&1 &)
(nohup npm run dev >"$LOG_DIR/dev-$STAMP.log" 2>&1 &)

for _ in $(seq 1 25); do
	if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:4173/"; then
		echo "$STAMP: preview up on 4173" >>"$LOG_DIR/boot.log"
		break
	fi
	sleep 0.2
done

for _ in $(seq 1 25); do
	if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:5173/"; then
		echo "$STAMP: dev up on 5173" >>"$LOG_DIR/boot.log"
		exit 0
	fi
	sleep 0.2
done

echo "$STAMP: dev did not come up on 5173 — check $LOG_DIR/dev-$STAMP.log" >>"$LOG_DIR/boot.log"
