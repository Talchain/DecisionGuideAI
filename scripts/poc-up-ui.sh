#!/usr/bin/env bash
set -euo pipefail

# poc-up-ui.sh - Bulletproof PoC UI bring-up
# Starts Vite dev server with proper port fallback and verification

UI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== PoC UI Bring-Up ==="
echo "UI_DIR: $UI_DIR"
echo ""

# Create .poc directory for logs and state
mkdir -p "$UI_DIR/.poc"

# Choose a port: try VITE_PORT env var, else 5174, else 5180, else 5181
CHOSEN_PORT="${VITE_PORT:-5174}"

if command -v lsof &> /dev/null; then
  # Check if port is free
  if lsof -i:$CHOSEN_PORT > /dev/null 2>&1; then
    echo "Port $CHOSEN_PORT is busy, trying fallback ports..."
    if lsof -i:5180 > /dev/null 2>&1; then
      if lsof -i:5181 > /dev/null 2>&1; then
        echo "❌ All candidate ports (5174, 5180, 5181) are busy"
        exit 1
      else
        CHOSEN_PORT=5181
      fi
    else
      CHOSEN_PORT=5180
    fi
  fi
else
  echo "lsof not available, assuming port $CHOSEN_PORT is free"
fi

echo "Using port: $CHOSEN_PORT"
echo ""

# Kill any existing process on our chosen port
if command -v lsof &> /dev/null; then
  lsof -ti:$CHOSEN_PORT | xargs -r kill -9 2>/dev/null || true
  sleep 1
fi

echo "Starting Vite dev server..."

# Start Vite with environment variables
(
  cd "$UI_DIR"
  VITE_PORT="$CHOSEN_PORT" \
  VITE_POC_ONLY=1 \
  VITE_AUTH_MODE=guest \
  VITE_FEATURE_SSE=1 \
  VITE_FEATURE_SCENARIO_SANDBOX=1 \
  VITE_FEATURE_SANDBOX_DECISION_CTA=1 \
  VITE_FEATURE_SANDBOX_MAPPING=1 \
  VITE_FEATURE_SANDBOX_PROJECTIONS=1 \
  VITE_FEATURE_SANDBOX_REALTIME=1 \
  VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE=1 \
  VITE_FEATURE_SANDBOX_TRIGGERS_BASIC=1 \
  VITE_FEATURE_SANDBOX_VOTING=1 \
  VITE_FEATURE_WHITEBOARD=1 \
  VITE_EDGE_GATEWAY_URL="http://127.0.0.1:4311" \
  VITE_SUPABASE_URL="http://example.invalid" \
  VITE_SUPABASE_ANON_KEY="dummy" \
  npm run dev -- --host --port "$CHOSEN_PORT" > "$UI_DIR/.poc/ui.log" 2>&1 &
  echo $! > "$UI_DIR/.poc/ui.pid"
) &

UI_PID=$(cat "$UI_DIR/.poc/ui.pid" 2>/dev/null || echo "")

# Function to poll for readiness
poll_ready() {
  local url="$1"
  local timeout="${2:-40}"
  local start_time=$(date +%s)

  echo "Polling $url for readiness..."
  while [[ $(( $(date +%s) - start_time )) -lt "$timeout" ]]; do
    if curl -s -f --max-time 2 "$url" > /dev/null 2>&1; then
      echo "✅ $url is ready"
      return 0
    fi
    sleep 1
  done
  echo "❌ $url not ready after ${timeout}s"
  return 1
}

# Poll UI readiness
UI_URL="http://127.0.0.1:$CHOSEN_PORT"
if ! poll_ready "$UI_URL" 40; then
  echo ""
  echo "❌ UI failed to start. Last 80 lines of log:"
  echo "=== UI LOG (LAST 80 LINES) ==="
  tail -80 "$UI_DIR/.poc/ui.log" 2>/dev/null || echo "No UI log available"
  echo "=== END UI LOG ==="
  kill $UI_PID 2>/dev/null || true
  exit 1
fi

# Write the resolved UI URL to file
UI_FULL_URL="$UI_URL/#/sandbox"
echo "$UI_FULL_URL" > "$UI_DIR/.poc/ui.url"

echo ""
echo "=== UI ACCEPTANCE ==="
echo "UI_ACCEPT: url=$UI_FULL_URL"

# Cleanup trap
cleanup() {
  echo ""
  echo "Stopping UI service..."
  kill $UI_PID 2>/dev/null || true
  echo "✅ UI service stopped"
}
trap cleanup EXIT

echo ""
echo "✅ UI is ready!"
echo "   URL: $UI_FULL_URL"
echo "   Logs: .poc/ui.log"
echo ""
echo "To check status: npm run poc:status"
echo "To stop: npm run poc:down"
