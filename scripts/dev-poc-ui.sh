#!/usr/bin/env bash
set -euo pipefail

echo "=== PoC UI Dev Server ==="
echo ""

# Use Node 20 if nvm is available
if command -v nvm &> /dev/null; then
  echo "Using Node 20 via nvm..."
  nvm use 20 || echo "⚠️ nvm use 20 failed, continuing with current Node version"
else
  echo "nvm not found, using current Node: $(node --version)"
fi

echo ""

# Kill any process on port 5174
echo "Freeing port 5174..."
lsof -ti:5174 | xargs kill -9 2>/dev/null || echo "Port 5174 is free"

echo ""

# Export PoC environment variables
export VITE_POC_ONLY=1
export VITE_AUTH_MODE=guest
export VITE_FEATURE_SCENARIO_SANDBOX=1
export VITE_FEATURE_SSE=1
export VITE_EDGE_GATEWAY_URL="http://127.0.0.1:4311"
export VITE_SUPABASE_URL="http://example.invalid"
export VITE_SUPABASE_ANON_KEY="dummy"

# Explicitly unset OpenAI key (use Engine only)
unset VITE_OPENAI_API_KEY 2>/dev/null || true

echo "PoC environment configured:"
echo "  VITE_POC_ONLY=$VITE_POC_ONLY"
echo "  VITE_AUTH_MODE=$VITE_AUTH_MODE"
echo "  VITE_EDGE_GATEWAY_URL=$VITE_EDGE_GATEWAY_URL"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm ci

echo ""
echo "Starting Vite dev server on port 5174..."
echo "Open: http://localhost:5174/#/sandbox"
echo ""

# Start Vite dev server
vite --host --port 5174
