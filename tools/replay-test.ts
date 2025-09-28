#!/usr/bin/env tsx

/**
 * Edge Replay Mode Test Script
 * Tests the replay mode functionality locally
 */

import { replayModeApi } from '../src/lib/replay/replay-mode.js';
import {
  handleReplayStartRequest,
  handleReplayStreamRequest,
  handleReplayCancelRequest,
  handleReplayReportRequest,
  handleReplaySnapshotsRequest,
  getReplayModeStatus
} from '../src/lib/replay/replay-api.js';

/**
 * Test replay mode functionality
 */
async function testReplayMode() {
  console.log('🎬 Testing Edge Replay Mode...\n');

  // Check if replay mode is enabled
  console.log('1️⃣  Checking replay mode status:');
  const status = getReplayModeStatus();
  console.log(JSON.stringify(status, null, 2));

  if (!status.enabled) {
    console.log('\n❌ Replay mode is disabled. Set REPLAY_MODE=1 to enable.');
    console.log('Example: REPLAY_MODE=1 tsx tools/replay-test.ts');
    process.exit(1);
  }

  console.log('\n2️⃣  Listing available snapshots:');
  const snapshotsResult = await handleReplaySnapshotsRequest();
  console.log(`Status: ${snapshotsResult.status}`);
  console.log(JSON.stringify(snapshotsResult.body, null, 2));

  if (snapshotsResult.status !== 200 || !snapshotsResult.body.snapshots?.length) {
    console.log('\n❌ No snapshots available for testing.');
    process.exit(1);
  }

  // Test with first available snapshot
  const testRunId = snapshotsResult.body.snapshots[0].runId;
  console.log(`\n3️⃣  Testing replay with runId: ${testRunId}`);

  // Start replay session
  console.log('\n🚀 Starting replay session...');
  const startResult = await handleReplayStartRequest({ runId: testRunId });
  console.log(`Status: ${startResult.status}`);
  console.log(JSON.stringify(startResult.body, null, 2));

  if (startResult.status !== 200) {
    console.log('\n❌ Failed to start replay session.');
    process.exit(1);
  }

  // Test streaming events
  console.log('\n📡 Testing event streaming...');
  const streamResult = await handleReplayStreamRequest({ runId: testRunId });
  console.log(`Status: ${streamResult.status}`);
  console.log(`Headers: ${JSON.stringify(streamResult.headers, null, 2)}`);

  if (streamResult.status === 200 && streamResult.body) {
    console.log('\n🔄 Streaming events:');
    let eventCount = 0;
    const maxEvents = 5; // Limit for testing

    try {
      for await (const chunk of streamResult.body()) {
        if (typeof chunk === 'string') {
          // Parse SSE format
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log(`Event ${++eventCount}: ${JSON.stringify(data, null, 2)}`);

                if (eventCount >= maxEvents) {
                  console.log('🛑 Stopping stream after max events for test...');
                  break;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }

          if (eventCount >= maxEvents) break;
        }
      }
    } catch (error) {
      console.log(`Stream error: ${error.message}`);
    }
  }

  // Test report retrieval
  console.log('\n📋 Testing report retrieval...');
  const reportResult = await handleReplayReportRequest({ runId: testRunId });
  console.log(`Status: ${reportResult.status}`);
  if (reportResult.status === 200) {
    console.log('Report summary:', {
      schema: reportResult.body.schema,
      runId: reportResult.body.runId,
      status: reportResult.body.status,
      summary: reportResult.body.summary
    });
  } else {
    console.log(JSON.stringify(reportResult.body, null, 2));
  }

  // Test cancel functionality
  console.log('\n🛑 Testing cancel functionality...');
  const cancelResult = await handleReplayCancelRequest({ runId: testRunId });
  console.log(`Status: ${cancelResult.status}`);
  console.log(JSON.stringify(cancelResult.body, null, 2));

  // Test cleanup
  console.log('\n🧹 Testing session cleanup...');
  replayModeApi.cleanupSessions();
  console.log('Cleanup completed.');

  console.log('\n✅ All replay mode tests completed successfully!');
}

/**
 * Main function
 */
async function main() {
  try {
    await testReplayMode();
  } catch (error) {
    console.error('❌ Replay test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}