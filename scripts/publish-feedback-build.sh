#!/usr/bin/env bash
#
# Publish the current build to GitHub Pages so other people can load the app
# over the public internet, with no Tailscale and no account of any kind.
#
# The site is served from the *user-site* repo `<user>.github.io`, not from a
# project repo, for one reason: a project repo serves at `/<repo-name>/`, and
# every `href="/drills"` in this app assumes the root. Serving at a subpath
# would mean threading `base` from `$app/paths` through ~60 links and every
# `goto()`, and `svelte-check` cannot tell when one is missed — it would work
# on this machine and break only on the shared URL. The user site serves at
# `https://<user>.github.io/`, so the build that ships is byte-for-byte the one
# `npm run preview` serves, and no link handling changes at all.
#
# This is deliberately manual rather than a push-triggered Action: the people
# testing should see a build you chose to send them, not whatever last landed
# on main.
#
#   ./scripts/publish-feedback-build.sh            # build, then publish
#   ./scripts/publish-feedback-build.sh --no-build # publish build/ as it stands
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

user="$(gh api user --jq .login)"
pages_repo="${user}.github.io"
pages_url="https://${user,,}.github.io/"

if [[ "${1:-}" == "--no-build" ]]; then
	echo "==> Skipping build, publishing build/ as it stands"
else
	echo "==> Building"
	npm run build
fi

[[ -f build/index.html ]] || {
	echo "build/index.html is missing — the build did not produce a site." >&2
	exit 1
}

# Create the Pages repo on first run. Public because GitHub Pages on a free
# account only serves public repos.
if ! gh repo view "${user}/${pages_repo}" >/dev/null 2>&1; then
	echo "==> Creating ${user}/${pages_repo}"
	gh repo create "${user}/${pages_repo}" --public \
		--description "Published build of skill-dev-app, for feedback. Source: ${user}/skill-dev-app"
fi

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

cp -R build/. "$staging/"

# Jekyll is GitHub Pages' default processor for a branch-served site, and it
# silently drops any path starting with an underscore — which is the entire
# `_app/` bundle. Without this file the site deploys "successfully" and serves
# a blank page.
touch "$staging/.nojekyll"

# GitHub Pages has no SPA fallback: it serves a static file or it 404s. A hard
# reload of, or a shared link to, a deep route like /drills/drop-punt would hit
# nothing. Pages does serve 404.html for any unmatched path, so a copy of the
# shell there boots the client router, which then resolves the real route. The
# HTTP status is 404 rather than 200 — invisible to the player, and the service
# worker declines to cache a non-200, so no stale shell is pinned either.
cp "$staging/index.html" "$staging/404.html"

commit_sha="$(git rev-parse --short HEAD)"
commit_desc="$(git log -1 --pretty=%s)"
dirty=""
git diff --quiet HEAD -- src static svelte.config.js || dirty=" + uncommitted changes"

echo "==> Publishing to ${user}/${pages_repo}"
git -C "$staging" init -q -b main
git -C "$staging" add -A
git -C "$staging" -c user.name="$(git config user.name)" \
	-c user.email="$(git config user.email)" \
	commit -q -m "Build ${commit_sha}${dirty}: ${commit_desc}"

# Force-push a single orphan commit. This repo holds build output, not history:
# the source history lives in skill-dev-app, and keeping deleted content-hashed
# assets around would only grow it.
git -C "$staging" push -q --force \
	"https://github.com/${user}/${pages_repo}.git" main

# Enabling Pages is idempotent in effect but errors if already enabled, so the
# failure is tolerated rather than checked for.
gh api "repos/${user}/${pages_repo}/pages" >/dev/null 2>&1 || {
	echo "==> Enabling GitHub Pages"
	gh api -X POST "repos/${user}/${pages_repo}/pages" \
		-f "source[branch]=main" -f "source[path]=/" >/dev/null
}

echo
echo "Published build ${commit_sha}${dirty}"
echo "  ${pages_url}"
echo
echo "First deploy can take a minute or two to go live; later ones are quick."
echo "Testers may need to close and reopen the tab to pick up a new build —"
echo "the service worker serves the cached shell until the next navigation."
