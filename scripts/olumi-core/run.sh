#!/usr/bin/env bash
# Run DecisionGuideAI on olumi-core locally, as it runs on Render: olumi-core serves DGAI's production build on its own origin
# (OLUMI_UI_DIST), DGAI at / and core's own page at /s/<scenario>, with one cookie and no server of DGAI's own.
# No AI provider is ever called: the olumi-core here has a SCRIPTED AI (test-harness/scripted-core.ts.txt, the dev-seed pattern).
#
#   scripts/olumi-core/run.sh build                                                  # `pnpm run build` with the lane's env (about 5 GB)
#   CORE_DIR=<checkout of olumi-core wip/v3.1> scripts/olumi-core/run.sh core        # scripted core serving ./dist on :3951
#   scripts/olumi-core/run.sh link <name> [<scenario id>]                            # a person's private link (admin route)
#
# A private link signs the browser in; DGAI's address for a scenario is /#/scenario/<its UUID form>, core's page for it /s/<scenario
# id>. Two people = two links in two browsers (or two private windows).
set -euo pipefail
unset GH_TOKEN GITHUB_TOKEN
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DATA="${DATA:-/private/tmp/dgai-core-data}"
CORE_PORT="${CORE_PORT:-3951}"
ADMIN_KEY="${OLUMI_ADMIN_KEY:-dgai-core-admin-key-0123456789abcdef}"
mkdir -p "$DATA"
case "${1:-core}" in
  build)
    cd "$ROOT"
    # shellcheck source=env.sh
    source "$HERE/env.sh"
    pnpm run build ;;
  core)
    : "${CORE_DIR:?set CORE_DIR to a checkout of olumi-core wip/v3.1}"
    [ -f "$ROOT/dist/index.html" ] || { echo "no $ROOT/dist: run '$0 build' first" >&2; exit 1; }
    cd "$CORE_DIR"
    cp "$HERE/test-harness/scripted-core.ts.txt" scripts/scripted-core.ts
    OLUMI_CONTROL="$DATA/control.json" OLUMI_BURST_LIMIT="${OLUMI_BURST_LIMIT:-1000}" OLUMI_DB="$DATA/core.db" OLUMI_UI_DIST="$ROOT/dist" \
      OLUMI_ADMIN_KEY="$ADMIN_KEY" PORT="$CORE_PORT" exec pnpm -s tsx scripts/scripted-core.ts ;;
  link)
    : "${2:?usage: run.sh link <name> [<scenario id>]}"
    body="{\"name\":\"$2\"${3:+,\"scenario\":\"$3\"}}"
    link="$(curl -s -X POST "http://127.0.0.1:$CORE_PORT/api/admin/people" -H "x-olumi-admin: $ADMIN_KEY" -H 'content-type: application/json' -d "$body" | sed -n 's/.*"link":"\([^"]*\)".*/\1/p')"
    [ -n "$link" ] || { echo "core made no link" >&2; exit 1; }
    # While core serves a UI, a link with a scenario lands on DGAI's address for it, its UUID form (API v1.9; sid.ts); else on core's page.
    echo "link: http://127.0.0.1:$CORE_PORT$link"
    [ -z "${3:-}" ] || echo "DGAI: http://127.0.0.1:$CORE_PORT/#/scenario/00000000-0000-4000-8000-${3#s_}" ;;
  *) echo "usage: $0 build|core|link" >&2; exit 2 ;;
esac
