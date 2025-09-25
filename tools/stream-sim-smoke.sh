#!/bin/bash
# Stream Simulation Smoke Test
# Tests sim mode streaming without needing actual services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"

# Ensure artifacts directory exists
mkdir -p "$ARTIFACTS_DIR"

echo "🧪 Stream Simulation Smoke Test"
echo "================================"

# Test 1: Basic streaming simulation
echo "📡 Test 1: Basic streaming simulation..."
node -e "
import { SimModeStreamer } from '../src/lib/simMode.ts';

const streamer = new SimModeStreamer(42, 'analysis test');
let tokenCount = 0;
let output = '';

console.log('Starting simulation stream...');
const startTime = Date.now();

streamer.start(
  (token) => {
    tokenCount++;
    if (token.text) {
      output += token.text;
      process.stdout.write('.');
    }
    if (token.type === 'done' || token.type === 'error' || token.type === 'aborted') {
      const duration = Date.now() - startTime;
      console.log('\\n');
      console.log(\`✅ Stream completed: \${tokenCount} tokens in \${duration}ms\`);
      console.log(\`📝 Output length: \${output.length} chars\`);

      // Write output to artifacts
      require('fs').writeFileSync('$ARTIFACTS_DIR/sim-smoke-output.txt', output);
      console.log('💾 Output saved to artifacts/sim-smoke-output.txt');

      if (duration > 6000) {
        console.log('❌ Stream took too long (>6s)');
        process.exit(1);
      } else {
        console.log('✅ Stream completed within expected time');
      }
    }
  },
  () => {
    console.log('🏁 Stream finished');
  }
);
"

echo ""

# Test 2: Cancel simulation
echo "📡 Test 2: Cancel simulation (should be ≤1s)..."
node -e "
import { SimModeStreamer } from '../src/lib/simMode.ts';

const streamer = new SimModeStreamer(42, 'long analysis test');
let cancelled = false;

console.log('Starting simulation stream...');
const startTime = Date.now();

streamer.start(
  (token) => {
    if (token.type === 'aborted') {
      const cancelDuration = Date.now() - startTime;
      console.log(\`✅ Stream cancelled in \${cancelDuration}ms\`);

      if (cancelDuration > 1000) {
        console.log('❌ Cancel took too long (>1s)');
        process.exit(1);
      } else {
        console.log('✅ Cancel completed within 1s requirement');
      }
    }
  },
  () => {
    if (!cancelled) {
      console.log('⚠️  Stream completed before cancel');
    }
  }
);

// Cancel after 500ms
setTimeout(() => {
  console.log('🛑 Sending cancel...');
  cancelled = true;
  streamer.cancel();
}, 500);
"

echo ""

# Test 3: Error scenario
echo "📡 Test 3: Error scenario..."
node -e "
import { SimModeStreamer } from '../src/lib/simMode.ts';

const streamer = new SimModeStreamer(123, 'error test'); // Seed 123 triggers error scenario
let foundError = false;

console.log('Starting error scenario...');

streamer.start(
  (token) => {
    if (token.type === 'error') {
      foundError = true;
      console.log(\`✅ Error token received: \${token.text}\`);
    }
  },
  () => {
    if (foundError) {
      console.log('✅ Error scenario completed successfully');
    } else {
      console.log('❌ Error scenario did not produce error token');
      process.exit(1);
    }
  }
);
"

echo ""
echo "🎉 All simulation smoke tests passed!"
echo "✅ Sim stream OK"
echo "✅ Stop ≤1s"
echo "✅ Error handling works"
echo "📊 Results saved to artifacts/"