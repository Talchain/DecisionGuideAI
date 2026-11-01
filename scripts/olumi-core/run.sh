#!/usr/bin/env bash
# Run DecisionGuideAI on olumi-core locally, as it runs on Render: a production build served by scripts/olumi-core/server.mjs.
# No AI provider is ever called: the olumi-core here has a SCRIPTED AI (test-harness/scripted-core.ts.txt, the dev-seed pattern).
#
#   CORE_DIR=<clone of olumi-core origin/staging> scripts/olumi-core/run.sh core     # scripted olumi-core on :3951 (scratch store)
#   scripts/olumi-core/run.sh build                                                  # `pnpm run build` with the lane's env (about 70 s, 5 GB)
#   scripts/olumi-core/run.sh serve                                                  # the one-origin server on :3952
#   scripts/olumi-core/run.sh link <name> [<scenario id>]                            # make a person's private link (admin route, on core)
#
# Then open http://127.0.0.1:3952<link>. Two people = two links in two browsers (or two private windows).
set -euo pipefail
unset GH_TOKEN GITHUB_TOKEN
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DATA="${DATA:-/private/tmp/dgai-core-data}"
CORE_PORT="${CORE_PORT:-3951}"
PORT="${PORT:-3952}"
ADMIN_KEY="${OLUMI_ADMIN_KEY:-dgai-core-admin-key-0123456789abcdef}"
mkdir -p "$DATA"
case "${1:-serve}" in
  core)
    : "${CORE_DIR:?set CORE_DIR to a clone of olumi-core origin/staging}"
    cd "$CORE_DIR"
    cp "$HERE/test-harness/scripted-core.ts.txt" scripts/scripted-core.ts
    OLUMI_CONTROL="$DATA/control.json" OLUMI_BURST_LIMIT="${OLUMI_BURST_LIMIT:-1000}" OLUMI_DB="$DATA/core.db" \
      OLUMI_ADMIN_KEY="$ADMIN_KEY" PORT="$CORE_PORT" exec pnpm -s tsx scripts/scripted-core.ts ;;
  build)
    cd "$ROOT"
    # shellcheck source=env.sh
    source "$HERE/env.sh"
    pnpm run build ;;
  serve)
    cd "$ROOT"
    OLUMI_CORE_URL="${OLUMI_CORE_URL:-http://127.0.0.1:$CORE_PORT}" PORT="$PORT" exec node "$HERE/server.mjs" ;;
  link)
    : "${2:?usage: run.sh link <name> [<scenario id>]}"
    body="{\"name\":\"$2\"${3:+,\"scenario\":\"$3\"}}"
    curl -s -X POST "http://127.0.0.1:$CORE_PORT/api/admin/people" -H "x-olumi-admin: $ADMIN_KEY" -H 'content-type: application/json' -d "$body"; echo ;;
  *) echo "usage: $0 core|build|serve|link" >&2; exit 2 ;;
esac
