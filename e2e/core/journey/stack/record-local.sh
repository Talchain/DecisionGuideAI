#!/usr/bin/env bash
# J1 · record the frozen LLM set, LOCALLY (macOS), with the same stack as CI.
#
# Paul, 5 Oct (via DL 0df0e1): no provider key in any GitHub field. So recording
# happens here: the staging OpenAI key is read from Render straight into the CEE
# process environment. It is never printed, stored or committed. Only the
# recordings (synthetic J1 brief) are committed, and CI replays them with 0 calls.
#
# Same pieces as .github/workflows/journey-j1.yml, adapted for a Mac:
#   - ports are offset (CEE 13101, PLoT 14311, ISL 18000, UI 15173, Supabase 55321/55322)
#     so the run cannot collide with another lane's local servers;
#   - no sudo for /etc/hosts, so CEE's fetch is redirected by llm-redirect-preload.mjs
#     to the boundary's plain-HTTP listener (record mode);
#   - psql runs inside the Supabase DB container.
#
# Heavy: Docker + four services + a browser for ~15-20 min. Brief F / DL: declare a
# HEAVY WINDOW on #87 first and run only when vm.loadavg < 45.
#
# usage: record-local.sh            (from the DGAI checkout root)
#   J1_RECORD_MODE=fill  keep the frozen set; replay every recorded call (CI timing) and record ONLY
#                        calls it lacks, appended after the last file (DL-approved gap fills).
#   J1_TUPLE=pinned      check CEE/PLoT/ISL out at fixtures/j1/tuple.json (default: staging tips),
#                        and leave tuple.json as it is.
set -euo pipefail

DGAI="$(pwd)"
STACK="$DGAI/e2e/core/journey/stack"
W="${J1_REC_DIR:-/private/tmp/jb-rec}"
FIX="$DGAI/e2e/core/journey/fixtures/j1/llm"
CEE_PORT=13101 PLOT_PORT=14311 ISL_PORT=18000 UI_PORT=15173 LLM_PORT=18787 SB_API=55321 SB_DB=55322
PIDS=()

say() { printf '[record] %s\n' "$*"; }
cleanup() {
  say "teardown"
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  (cd "$W/sb" 2>/dev/null && supabase stop --no-backup > /dev/null 2>&1) || true
}
trap cleanup EXIT

[ -f "$STACK/record-local.sh" ] || { echo "run from the DGAI checkout root"; exit 2; }
load=$(sysctl -n vm.loadavg | awk '{print $2}')
awk -v l="$load" 'BEGIN { exit !(l < 45) }' || { say "load $load ≥ 45: not starting (DL rule)"; exit 3; }
docker info > /dev/null 2>&1 || { say "Docker is not running: start Docker Desktop first"; exit 3; }

rm -rf "$W"; mkdir -p "$W/logs" "$W/keys"
# Each repo's .npmrc expands a token for the @talchain registry (DGAI NODE_AUTH_TOKEN,
# CEE NPM_PACKAGES_TOKEN, PLoT GITHUB_TOKEN); unset, the install fails before it starts.
# The local gh login's token is handed to the INSTALL commands only, as CI hands its job token.
PKG_TOKEN="$(gh auth token)"
REC_MODE="${J1_RECORD_MODE:-record}"; TUPLE="${J1_TUPLE:-tips}"
case "$REC_MODE" in record|fill) ;; *) say "J1_RECORD_MODE must be record or fill"; exit 2 ;; esac
for repo in olumi-assistants-service:cee plot-lite-service:plot Inference-Service-Layer:isl; do
  name="${repo%%:*}"; dir="${repo##*:}"
  if [ "$TUPLE" = pinned ]; then
    sha="$(node -e 'process.stdout.write(String(require(process.argv[1])[process.argv[2]] ?? ""))' "$DGAI/e2e/core/journey/fixtures/j1/tuple.json" "$dir")"
    [ "${#sha}" -eq 40 ] || { say "pinned $dir is not a 40-char SHA"; exit 1; }
    git init -q "$W/$dir" && git -C "$W/$dir" fetch -q --depth 1 "https://github.com/Talchain/$name.git" "$sha" && git -C "$W/$dir" checkout -q FETCH_HEAD
  else
    git clone -q --depth 1 --branch staging "https://github.com/Talchain/$name.git" "$W/$dir"
  fi
done
DGAI_SHA=$(git -C "$DGAI" rev-parse HEAD); CEE_SHA=$(git -C "$W/cee" rev-parse HEAD)
PLOT_SHA=$(git -C "$W/plot" rev-parse HEAD); ISL_SHA=$(git -C "$W/isl" rev-parse HEAD)
for s in "$DGAI_SHA" "$CEE_SHA" "$PLOT_SHA" "$ISL_SHA"; do [ "${#s}" -eq 40 ] || { say "bad sha $s"; exit 1; }; done
say "tuple ui=$DGAI_SHA cee=$CEE_SHA plot=$PLOT_SHA isl=$ISL_SHA"

node "$STACK/gen-tls-and-keys.mjs" "$W/keys"

# ── LLM boundary, record mode, plain HTTP for the preload ──
[ "$REC_MODE" = fill ] || rm -f "$FIX"/[0-9]*.json
# JOURNEY_LLM_MAX_CALLS: the DL's call budget for this record run (record 3: 15). Call 16 is refused.
JOURNEY_LLM_MODE="$REC_MODE" JOURNEY_LLM_FIXTURES="$FIX" JOURNEY_LLM_LEDGER="$W/ledger.ndjson" \
JOURNEY_LLM_MAX_CALLS="${J1_MAX_CALLS:-15}" JOURNEY_LLM_HTTP_PORT=$LLM_PORT node "$STACK/llm-replay-server.mjs" > "$W/logs/llm-boundary.log" 2>&1 &
PIDS+=($!)

# ── Supabase: empty start, then both repos' migrations with a per-file report ──
mkdir -p "$W/sb/supabase" && cd "$W/sb"
cat > supabase/config.toml <<EOF
project_id = "j1-journey"
[api]
enabled = true
port = $SB_API
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = $SB_DB
shadow_port = 55320
major_version = 15
[studio]
enabled = false
[analytics]
enabled = false
[inbucket]
enabled = false
[realtime]
enabled = false
[storage]
enabled = false
[edge_runtime]
enabled = false
[auth]
enabled = true
site_url = "http://localhost:$UI_PORT"
additional_redirect_urls = ["http://localhost:$UI_PORT"]
jwt_expiry = 3600
enable_signup = true
signing_keys_path = "./signing_keys.json"
[auth.email]
enable_signup = true
enable_confirmations = false
EOF
cp "$W/keys/signing_keys.json" supabase/signing_keys.json
node "$STACK/merge-migrations.mjs" "$DGAI/supabase/migrations" "$W/cee/supabase/migrations" "$W/merged/migrations" "$STACK/hosted-drift-pre"
supabase start -x studio,imgproxy,vector,logflare,edge-runtime,supavisor > "$W/logs/supabase-start.log" 2>&1
J1_PSQL="docker exec -i supabase_db_j1-journey psql -U postgres -d postgres" \
  bash "$STACK/apply-migrations.sh" "$W/merged/migrations" "$W/logs/MIGRATION-REPORT.tsv"
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=' | sed 's/^/SB_/')"
cd "$DGAI"

# ── ISL ──
(cd "$W/isl" && poetry config virtualenvs.in-project true --local && poetry install --only main --no-root -q) > "$W/logs/isl-install.log" 2>&1
(set -a; . "$STACK/isl.staging-flags.env"; set +a; cd "$W/isl" && ISL_API_KEYS=journey-local \
  exec .venv/bin/python -m uvicorn src.api.main:app --host 127.0.0.1 --port $ISL_PORT) > "$W/logs/isl.log" 2>&1 &
PIDS+=($!)

# ── PLoT ──
(cd "$W/plot" && GITHUB_TOKEN="$PKG_TOKEN" npm ci --no-audit --no-fund && npm run build) > "$W/logs/plot-build.log" 2>&1
(set -a; . "$STACK/plot.staging-flags.env"; set +a; cd "$W/plot" && \
  NODE_ENV=staging PORT=$PLOT_PORT ISL_BASE_URL="http://127.0.0.1:$ISL_PORT" ISL_API_KEY=journey-local \
  CEE_BASE_URL="http://127.0.0.1:$CEE_PORT" CEE_API_KEY=journey-local \
  PLOT_AUTH_TOKEN=journey-local-plot-token AUTH_TOKEN=journey-local-plot-token AUTH_V2_ENABLED=0 \
  TOKEN_HMAC_SECRET="$(openssl rand -hex 32)" PRINCIPAL_HMAC_SECRET_ACTIVE="$(openssl rand -hex 32)" \
  CORS_ORIGINS="http://localhost:$UI_PORT" exec node dist/main.js) > "$W/logs/plot.log" 2>&1 &
PIDS+=($!)

# ── CEE, with the staging OpenAI key in ITS environment only ──
(cd "$W/cee" && NPM_PACKAGES_TOKEN="$PKG_TOKEN" npx -y pnpm@10.18.0 install --frozen-lockfile && npx -y pnpm@10.18.0 build) > "$W/logs/cee-build.log" 2>&1
# The key reader is written to the run dir and run once; it prints only the value,
# straight into a shell variable that is handed to CEE's environment and then unset.
cat > "$W/openai-key.py" <<'PY'
import json, urllib.request
key = [l.split('=', 1)[1].strip().strip('"\'') for l in open('/Users/paulslee/.olumi/render.env') if l.startswith('RENDER_API_KEY=')][0]
def get(p):
    r = urllib.request.Request('https://api.render.com/v1' + p, headers={'Authorization': 'Bearer ' + key, 'Accept': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=30))
sid = [s['service']['id'] for s in get('/services?limit=100') if s['service']['name'] == 'cee-staging'][0]
print([e['envVar']['value'] for e in get('/services/%s/env-vars?limit=100' % sid) if e['envVar']['key'] == 'OPENAI_API_KEY'][0], end='')
PY
OPENAI_KEY="$(python3 "$W/openai-key.py")"
rm -f "$W/openai-key.py"
[ -n "$OPENAI_KEY" ] || { say "could not read the staging OpenAI key from Render"; exit 1; }
(set -a; . "$STACK/cee.staging-flags.env"; set +a; cd "$W/cee" && \
  NODE_ENV=staging PORT=$CEE_PORT LOG_LEVEL=info SUPABASE_URL="$SB_API_URL" SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY" \
  PLOT_BASE_URL="http://127.0.0.1:$PLOT_PORT" PLOT_AUTH_TOKEN=journey-local-plot-token \
  ISL_BASE_URL="http://127.0.0.1:$ISL_PORT" ISL_API_KEY=journey-local \
  OPENAI_API_KEY="$OPENAI_KEY" PROXY_V5_TARGET=agent ASSIST_API_KEYS=journey-local \
  ALLOWED_ORIGINS="http://localhost:$UI_PORT" BROWSER_PROXY_ALLOWED_ORIGINS="http://localhost:$UI_PORT" \
  JOURNEY_LLM_REDIRECT="http://127.0.0.1:$LLM_PORT" \
  exec node --import "$STACK/llm-redirect-preload.mjs" dist/src/server.js) > "$W/logs/cee.log" 2>&1 &
PIDS+=($!)
unset OPENAI_KEY

# ── UI ──
[ -d node_modules ] || NODE_AUTH_TOKEN="$PKG_TOKEN" npx -y pnpm@10.18.0 install --frozen-lockfile > "$W/logs/ui-install.log" 2>&1
unset PKG_TOKEN
(set -a; . "$STACK/ui.staging-flags.env"; set +a; \
  VITE_V5_ENDPOINT="http://localhost:$CEE_PORT/proxy/v5/turn" VITE_SUPABASE_URL="$SB_API_URL" VITE_SUPABASE_ANON_KEY="$SB_ANON_KEY" \
  NODE_OPTIONS=--max-old-space-size=6144 npm run build) > "$W/logs/ui-build.log" 2>&1
echo "{\"commit\":\"$DGAI_SHA\",\"short\":\"${DGAI_SHA:0:8}\",\"branch\":\"local-record\",\"deploy_id\":\"j1-local\",\"deploy_url\":\"\"}" > dist/version.json
(CEE_SERVICE_URL="http://127.0.0.1:$CEE_PORT" ENGINE_SERVICE_URL="http://127.0.0.1:$PLOT_PORT" ISL_SERVICE_URL="http://127.0.0.1:$ISL_PORT" ASSIST_API_KEY=journey-local \
  exec npx vite preview --port $UI_PORT --strictPort) > "$W/logs/ui-preview.log" 2>&1 &
PIDS+=($!)

for u in "http://127.0.0.1:$ISL_PORT/" "http://127.0.0.1:$PLOT_PORT/" "http://127.0.0.1:$CEE_PORT/" "http://localhost:$UI_PORT/version.json"; do
  for i in $(seq 1 90); do [ "$(curl -s -o /dev/null -w '%{http_code}' "$u" || true)" != 000 ] && break; sleep 2; done
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$u" || true)" != 000 ] || { say "never answered: $u"; tail -30 "$W"/logs/*.log; exit 1; }
done
npx playwright install chromium > "$W/logs/playwright-install.log" 2>&1
say "stack up; recording"

# One boundary records J1 AND the isolation rows, in the SAME ORDER CI replays them: J1 first,
# then the isolation rows (two invocations; one invocation ran the isolation file first). Requests
# that are identical across specs (J1's and ISO-1's first draft call) get different LLM answers,
# and the replay serves the first unused exact match, so record order must equal replay order or a
# spec inherits another spec's model (record 3: J1 took ISO-1's draft and its Run drifted).
# Thin client (#2511) or not, read from the build like the workflow does.
UI_THIN=0; [ -f "$DGAI/src/canvas/thinClient/thinClient.ts" ] && UI_THIN=1
REC_ENV=(J1_UI_THIN="$UI_THIN" DGAI_SHA="$DGAI_SHA" CEE_SHA="$CEE_SHA" PLOT_SHA="$PLOT_SHA" ISL_SHA="$ISL_SHA" J1_MODE="$REC_MODE"
  JOURNEY_LLM_LEDGER="$W/ledger.ndjson" JOURNEY_LLM_FIXTURES="$FIX"
  CORE_UI_URL="http://localhost:$UI_PORT" CORE_SUPABASE_URL="$SB_API_URL" CORE_SUPABASE_KEY="$SB_ANON_KEY"
  J1_SB_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY" J1_CEE_URL="http://127.0.0.1:$CEE_PORT")
env "${REC_ENV[@]}" npx playwright test --config playwright.journey.config.ts J1-whole-poc 2>&1 | tee "$W/logs/playwright.log" || true
env "${REC_ENV[@]}" npx playwright test --config playwright.journey.config.ts isolation-same-browser --output test-results/isolation 2>&1 | tee "$W/logs/playwright-isolation.log" || true

# The tuple this set was recorded on: the pinned leg of the CI workflow replays against exactly these.
# A fill on the pinned tuple leaves it as it is.
[ "$TUPLE" = pinned ] || node -e 'const [f, ui, cee, plot, isl] = process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({ cee, plot, isl, recorded_with_ui: ui, recorded_at: new Date().toISOString() }, null, 1) + "\n")' \
  "$DGAI/e2e/core/journey/fixtures/j1/tuple.json" "$DGAI_SHA" "$CEE_SHA" "$PLOT_SHA" "$ISL_SHA"
say "ledger: $(node -e 'const c={};for(const l of require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n")){const r=JSON.parse(l);c[r.outcome]=(c[r.outcome]||0)+1};console.log(JSON.stringify(c))' "$W/ledger.ndjson")"
say "recordings: $(ls "$FIX"/[0-9]*.json 2>/dev/null | wc -l | tr -d ' ') in $FIX (commit these only)"
say "evidence: test-results/journey/evidence, logs: $W/logs"
# Bank only a clean recording (DL 0df0e1): J1 passed, no upstream error, no 429, none under timeouts.
say "bank only if: J1 passed in playwright.log, ledger has 0 upstream_error/rate_limited, scan-recordings.sh is clean"
