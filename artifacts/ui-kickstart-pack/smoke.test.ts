/**
 * Smoke test for UI Kickstart Pack
 * Tests basic functionality without external dependencies
 */

import {
  openStreamSim,
  openJobStreamSim,
  loadReportSim,
  loadViewModelSim,
  TokenEventData,
  CompleteEventData,
  JobProgressEventData,
  ReportV1,
  MockEventSource
} from './src/index';

async function runSmokeTest() {
  console.log('🧪 Running UI Kickstart Pack Smoke Test...\n');

  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition: boolean, message: string) {
    testsTotal++;
    if (condition) {
      testsPassed++;
      console.log(`✅ ${message}`);
    } else {
      console.log(`❌ ${message}`);
    }
  }

  // Test 1: Stream simulation
  console.log('📡 Testing Stream Simulation...');
  try {
    const events: any[] = [];
    for await (const event of openStreamSim({ tokenCount: 3, tokenDelay: 1 })) {
      events.push(event);
    }

    assert(events.length >= 4, 'Stream produces start + tokens + complete events');
    assert(events.some(e => e.event === 'start'), 'Stream includes start event');
    assert(events.some(e => e.event === 'token'), 'Stream includes token events');
    assert(events.some(e => e.event === 'complete'), 'Stream includes complete event');

    const tokenEvent = events.find(e => e.event === 'token');
    if (tokenEvent) {
      const tokenData: TokenEventData = JSON.parse(tokenEvent.data);
      assert(typeof tokenData.id === 'string', 'Token data has id');
      assert(typeof tokenData.text === 'string', 'Token data has text');
      assert(typeof tokenData.sessionId === 'string', 'Token data has sessionId');
    }
  } catch (error) {
    console.log(`❌ Stream simulation failed: ${error}`);
  }

  // Test 2: Job simulation
  console.log('\n⚙️ Testing Job Simulation...');
  try {
    const events: any[] = [];
    for await (const event of openJobStreamSim({ totalSteps: 3, progressDelay: 1 })) {
      events.push(event);
    }

    assert(events.length >= 3, 'Job produces multiple progress events');
    assert(events.every(e => e.event === 'job_progress'), 'All events are job_progress');

    const finalEvent = events[events.length - 1];
    const finalData: JobProgressEventData = JSON.parse(finalEvent.data);
    assert(finalData.status === 'completed', 'Final job status is completed');
    assert(finalData.progress === 100, 'Final job progress is 100%');
  } catch (error) {
    console.log(`❌ Job simulation failed: ${error}`);
  }

  // Test 3: Report loading
  console.log('\n📊 Testing Report Loading...');
  try {
    const report = await loadReportSim();

    assert(report.version === '1.0', 'Report has correct version');
    assert(typeof report.meta === 'object', 'Report has meta object');
    assert(Array.isArray(report.steps), 'Report has steps array');
    assert(typeof report.totals === 'object', 'Report has totals object');
    assert(typeof report.meta.seed === 'number', 'Report meta has seed');
    assert(typeof report.totals.totalCost === 'number', 'Report totals has cost');
  } catch (error) {
    console.log(`❌ Report loading failed: ${error}`);
  }

  // Test 4: View model loading
  console.log('\n🎨 Testing View Model Loading...');
  try {
    const streamModel = await loadViewModelSim('stream-test');
    assert(streamModel.type === 'stream', 'Stream view model has correct type');
    assert(typeof streamModel.timestamp === 'string', 'View model has timestamp');

    const jobsModel = await loadViewModelSim('jobs-test');
    assert(jobsModel.type === 'jobs', 'Jobs view model has correct type');

    const reportModel = await loadViewModelSim('report-test');
    assert(reportModel.type === 'report', 'Report view model has correct type');
  } catch (error) {
    console.log(`❌ View model loading failed: ${error}`);
  }

  // Test 5: Cancellation simulation
  console.log('\n🛑 Testing Cancellation Simulation...');
  try {
    const events: any[] = [];
    for await (const event of openStreamSim({ tokenCount: 10, shouldCancel: true, tokenDelay: 1 })) {
      events.push(event);
    }

    const cancelEvent = events.find(e => e.event === 'cancelled');
    assert(!!cancelEvent, 'Cancelled stream produces cancelled event');

    if (cancelEvent) {
      const cancelData = JSON.parse(cancelEvent.data);
      assert(cancelData.reason === 'user_cancelled', 'Cancel event has correct reason');
      assert(typeof cancelData.partialTokens === 'number', 'Cancel event has partialTokens count');
    }
  } catch (error) {
    console.log(`❌ Cancellation simulation failed: ${error}`);
  }

  // Test 6: Mock EventSource
  console.log('\n🔌 Testing Mock EventSource...');
  try {
    const mockSource = new MockEventSource('test://example');

    assert(typeof mockSource.url === 'string', 'MockEventSource has url');
    assert(typeof mockSource.readyState === 'number', 'MockEventSource has readyState');
    assert(typeof mockSource.addEventListener === 'function', 'MockEventSource has addEventListener');
    assert(typeof mockSource.close === 'function', 'MockEventSource has close method');

    let messageReceived = false;
    mockSource.onmessage = () => { messageReceived = true; };
    mockSource._simulateMessage('test message');

    // Small delay to allow message processing
    await new Promise(resolve => setTimeout(resolve, 10));
    assert(messageReceived, 'MockEventSource can simulate messages');
  } catch (error) {
    console.log(`❌ Mock EventSource failed: ${error}`);
  }

  // Summary
  console.log('\n📈 Test Summary:');
  console.log(`✅ Tests passed: ${testsPassed}/${testsTotal}`);
  console.log(`📊 Success rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

  if (testsPassed === testsTotal) {
    console.log('\n🎉 All smoke tests passed! Pack is ready for use.');
    return true;
  } else {
    console.log('\n⚠️ Some tests failed. Check the pack implementation.');
    return false;
  }
}

// Run the smoke test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Smoke test crashed:', error);
    process.exit(1);
  });
}

export { runSmokeTest };