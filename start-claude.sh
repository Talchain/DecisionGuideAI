#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# --- Safe PoC defaults ---
export NODE_ENV=development
export STREAM_ALT_EVENTS=0
export TEST_ROUTES=0
export MAX_NODES=12
export WARN_NODES=10
export RATE_LIMIT_RPM=60
export DAILY_BUDGET_TOKENS=50000

echo "→ Installing node modules…"
npm ci

# --- Bring services up FIRST (then test) ---
echo "→ Starting pilot stack (Gateway, Engine, Jobs)…"
# Try to build locally if images are missing; otherwise just 'up -d'
if ! docker compose -f pilot-deploy/docker-compose.poc.yml up -d 2>/dev/null; then
  echo "⚠️  Falling back to build+up (images probably private or missing)…"
  docker compose -f pilot-deploy/docker-compose.poc.yml build
  docker compose -f pilot-deploy/docker-compose.poc.yml up -d
fi

# --- Wait for Gateway to be healthy (/health or /healthz) ---
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
echo "→ Waiting for Gateway at $GATEWAY_URL$HEALTH_PATH …"
for i in {1..30}; do
  if curl -fsS "$GATEWAY_URL$HEALTH_PATH" >/dev/null 2>&1; then
    echo "✓ Gateway is responding."
    break
  fi
  sleep 1
  if [ $i -eq 10 ]; then HEALTH_PATH="/healthz"; fi
  if [ $i -eq 30 ]; then echo "❌ Gateway did not become healthy in time"; exit 1; fi
done

# --- Quick runtime checks (do not fail startup if they're red) ---
echo "→ Running smoke/canary (non-blocking)…"
./scripts/pilot-smoke.sh || true
npm run canary || true

# --- OPTIONAL: run unit tests AFTER stack is up (do not block) ---
if [ "${RUN_TESTS:-0}" = "1" ]; then
  echo "→ Running unit tests (non-blocking)…"
  npm run typecheck || true
  npm test || true
fi

echo "✅ Ready. Charter: keep frozen SSE events (hello, token, cost, done, cancelled, limited, error); stick to additive changes; no payload logging."