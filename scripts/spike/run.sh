#!/usr/bin/env bash
# SPIKE: run DecisionGuideAI's UI against olumi-core through the shim. Three processes, no AI provider calls:
#   1. olumi-core with a SCRIPTED AI (scripts/scripted-core.ts in a clean clone of olumi-core origin/staging), port 3948
#   2. the shim (scripts/spike/olumi-core-shim.mjs), port 3949
#   3. vite dev (this repo), port 5173, same-origin proxy: /bff/orchestrate -> shim, /bff/cee -> shim
# Usage: scripts/spike/run.sh ui|shim|core   (set CORE_DIR to the olumi-core clone, DATA to a scratch dir)
set -euo pipefail
unset GH_TOKEN GITHUB_TOKEN
CORE_DIR="${CORE_DIR:-/private/tmp/spike-core}"
DATA="${DATA:-/private/tmp/spike-core-data}"
ADMIN_KEY="${OLUMI_ADMIN_KEY:-spike-admin-key-0123456789abcdef}"
mkdir -p "$DATA"
case "${1:-ui}" in
  core)
    cd "$CORE_DIR"
    cp -n /private/tmp/olumi-core-ui-dev/scripts/scripted-core.ts scripts/scripted-core.ts || true
    OLUMI_DB="$DATA/ui.db" OLUMI_ADMIN_KEY="$ADMIN_KEY" PORT=3948 exec pnpm -s tsx scripts/scripted-core.ts ;;
  shim)
    # one private link for the shim to hold (the browser never sees it)
    if [ ! -s "$DATA/token.txt" ]; then
      curl -s -X POST localhost:3948/api/admin/people -H "x-olumi-admin: $ADMIN_KEY" -H 'content-type: application/json' -d '{"name":"Paul"}' \
        | sed 's/.*\/k\/\([^"?]*\).*/\1/' > "$DATA/token.txt"
    fi
    exec node "$(dirname "$0")/olumi-core-shim.mjs" ;;
  ui)
    export ENGINE_SERVICE_URL=http://127.0.0.1:3949 CEE_SERVICE_URL=http://127.0.0.1:3949 ISL_SERVICE_URL=http://127.0.0.1:3949 \
           PLOT_API_URL=http://127.0.0.1:3949 ASSIST_BFF_URL=http://127.0.0.1:3949
    # the staging build's flags (netlify.toml [build.environment] + [context.staging.environment]) plus the V5 endpoint (.env.staging.example)
    export VITE_V5_ENDPOINT=/bff/orchestrate/v2/turn VITE_ENABLE_V5_ORCHESTRATOR=true VITE_ENABLE_ORCHESTRATOR_V2=true \
           VITE_AUTH_MODE=guest VITE_DISABLE_OPENAI=1 VITE_POC_ONLY=0 VITE_PLC_LAB=1 VITE_APP_ENV=staging \
           VITE_FEATURE_AI_PANEL_V2=true VITE_V5_CANONICAL_ANALYSIS=true VITE_FEATURE_GRAPH_LENS=true \
           VITE_FEATURE_DECISION_OVERVIEW=1 VITE_FEATURE_STRENGTHEN_PANEL=1 VITE_FEATURE_COMPARE_TAB=1 VITE_FEATURE_PRE_ANALYSIS_V3=1 \
           VITE_SUPABASE_URL=http://127.0.0.1:3949 VITE_SUPABASE_ANON_KEY=dummy-local-key
    cd "$(dirname "$0")/../.."
    exec pnpm exec vite --host 127.0.0.1 ;;
esac
