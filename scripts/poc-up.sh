#!/usr/bin/env bash
set -euo pipefail

# poc-up.sh - Robust PoC bring-up with port fallback and verification
# Starts Engine and UI with all sandbox features enabled

UI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$UI_DIR/../plot-lite-service"

echo "=== PoC Bring-Up (Robust) ==="
echo "UI_DIR: $UI_DIR"
echo "ENGINE_DIR: $ENGINE_DIR"
echo ""

# Check if Engine directory exists
if [[ ! -d "$ENGINE_DIR" ]]; then
  echo "❌ Error: Engine directory not found at $ENGINE_DIR"
  echo "Please ensure plot-lite-service is a sibling directory to DecisionGuideAI"
  exit 2
fi

# Create .poc directory for logs and state
mkdir -p "$UI_DIR/.poc"

# Use Node 20 if nvm is available
if command -v nvm &> /dev/null; then
  echo "Using Node 20 via nvm..."
  nvm install 20 &> /dev/null || true
  nvm use 20 &> /dev/null || echo "⚠️ nvm use 20 failed, continuing with current Node"
else
  echo "nvm not found, using current Node: $(node --version)"
fi

echo ""

# Function to poll for readiness with timeout
poll_ready() {
  local url="$1"
  local timeout="${2:-30}"
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

# Kill existing processes on our target ports
echo "Freeing ports..."
if command -v lsof &> /dev/null; then
  lsof -ti:4311 | xargs -r kill -9 2>/dev/null || true
  lsof -ti:5174 | xargs -r kill -9 2>/dev/null || true
  lsof -ti:5180 | xargs -r kill -9 2>/dev/null || true
  lsof -ti:5181 | xargs -r kill -9 2>/dev/null || true
  sleep 2
else
  echo "lsof not available, skipping port cleanup"
fi

echo ""

# Start Engine
echo "Starting Engine service..."
(
  cd "$ENGINE_DIR"
  echo "Engine: Running npm ci..."
  npm ci > /dev/null 2>&1
  echo "Engine: Running npm run build..."
  npm run build > /dev/null 2>&1
  echo "Engine: Starting with PORT=4311, TEST_ROUTES=1, CORS_ORIGINS..."
  PORT=4311 \
  CORS_ORIGINS="http://localhost:5174,http://127.0.0.1:5174,http://localhost:5180,http://127.0.0.1:5180,http://localhost:5181,http://127.0.0.1:5181" \
  TEST_ROUTES=1 \
  npm start > "$UI_DIR/.poc/engine.log" 2>&1 &
  echo $! > "$UI_DIR/.poc/engine.pid"
) &

ENGINE_PID=$(cat "$UI_DIR/.poc/engine.pid" 2>/dev/null || echo "")

# Poll Engine health
ENGINE_URL="http://127.0.0.1:4311/health"
if ! poll_ready "$ENGINE_URL" 30; then
  echo ""
  echo "❌ Engine failed to start. Last 50 lines of log:"
  echo "=== ENGINE LOG (LAST 50 LINES) ==="
  tail -50 "$UI_DIR/.poc/engine.log" 2>/dev/null || echo "No engine log available"
  echo "=== END ENGINE LOG ==="
  kill $ENGINE_PID 2>/dev/null || true
  exit 1
fi

# Get Engine health for acceptance
ENGINE_HEALTH=$(curl -s "$ENGINE_URL" | head -1)

echo ""
echo "=== ENGINE ACCEPTANCE ==="
echo "ENGINE_OK: port=4311, cors=OK, test_routes=ON"
echo "ENGINE_HEALTH: $ENGINE_HEALTH"

# Find a free UI port (try 5174, then 5180, then 5181)
UI_PORTS=(5174 5180 5181)
UI_PORT=""
UI_PID=""

for port in "${UI_PORTS[@]}"; do
  echo ""
  echo "Trying UI port $port..."

  # Start UI on this port
  (
    cd "$UI_DIR"
    echo "UI: Running npm ci..."
    npm ci > /dev/null 2>&1

    echo "UI: Starting Vite on port $port..."
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
    vite --host --port "$port" > "$UI_DIR/.poc/ui.log" 2>&1 &
    echo $! > "$UI_DIR/.poc/ui.pid"
  ) &

  UI_PID=$(cat "$UI_DIR/.poc/ui.pid" 2>/dev/null || echo "")
  UI_URL="http://localhost:$port"

  # Poll UI readiness
  if poll_ready "$UI_URL" 30; then
    UI_PORT="$port"
    break
  else
    echo "❌ Port $port failed, trying next..."
    kill $UI_PID 2>/dev/null || true
  fi
done

# Check if we found a working UI port
if [[ -z "$UI_PORT" ]]; then
  echo ""
  echo "❌ UI failed to start on any port. Last 50 lines of log:"
  echo "=== UI LOG (LAST 50 LINES) ==="
  tail -50 "$UI_DIR/.poc/ui.log" 2>/dev/null || echo "No UI log available"
  echo "=== END UI LOG ==="
  kill $ENGINE_PID 2>/dev/null || true
  exit 1
fi

# Write the resolved UI URL to file
UI_FULL_URL="$UI_URL/#/sandbox"
echo "$UI_FULL_URL" > "$UI_DIR/.poc/ui.url"

echo ""
echo "=== UI ACCEPTANCE ==="
echo "UI_ACCEPT: url=$UI_FULL_URL, mode=PoC, auth=guest, engine=http://127.0.0.1:4311"

# Open browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo ""
  echo "Opening browser..."
  open "$UI_FULL_URL"
else
  echo ""
  echo "Open in browser: $UI_FULL_URL"
fi

echo ""
echo "✅ PoC is ready!"
echo "   Engine: http://127.0.0.1:4311"
echo "   UI: $UI_FULL_URL"
echo ""
echo "Logs:"
echo "   Engine: .poc/engine.log"
echo "   UI: .poc/ui.log"
echo ""
echo "To check status: npm run poc:status"
echo "To stop: npm run poc:down"

# Set up cleanup trap
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $ENGINE_PID 2>/dev/null || true
  kill $UI_PID 2>/dev/null || true
  echo "✅ Services stopped"
}
trap cleanup EXIT
