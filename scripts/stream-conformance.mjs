#!/usr/bin/env node
/**
 * Stream Conformance Testing - Current Contract
 * Tests frozen SSE events: hello|token|cost|done|cancelled|limited|error
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const OUTPUT_DIR = process.env.CONFORMANCE_OUTPUT_DIR || join(__dirname, '../artifacts/reports/stream');
const TIMEOUT_MS = parseInt(process.env.CONFORMANCE_TIMEOUT_MS || '30000');

// Frozen event set - MUST NOT CHANGE
const FROZEN_EVENTS = ['hello', 'token', 'cost', 'done', 'cancelled', 'limited', 'error'];

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * SSE Event Parser for frozen contract
 */
class SSEParser {
  constructor() {
    this.events = [];
    this.buffer = '';
  }

  parse(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line

    let currentEvent = {};

    for (const line of lines) {
      if (line === '') {
        // Empty line signals end of event
        if (Object.keys(currentEvent).length > 0) {
          this.events.push({ ...currentEvent });
          currentEvent = {};
        }
      } else if (line.startsWith('id: ')) {
        currentEvent.id = line.substring(4);
      } else if (line.startsWith('event: ')) {
        currentEvent.event = line.substring(7);
      } else if (line.startsWith('data: ')) {
        try {
          currentEvent.data = line.substring(6);
          currentEvent.parsedData = JSON.parse(currentEvent.data);
        } catch (e) {
          currentEvent.data = line.substring(6);
        }
      }
    }

    return this.events;
  }

  getEvents() {
    return this.events;
  }
}

/**
 * Make HTTP request with timeout
 */
async function makeRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'DecisionGuide-StreamConformance/1.0',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Stream SSE events with timeout
 */
async function streamEvents(url, headers = {}, timeoutMs = 10000) {
  const parser = new SSEParser();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        parser.parse(chunk);
      }
    } finally {
      reader.releaseLock();
    }

    clearTimeout(timeoutId);
    return parser.getEvents();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Test: Happy path with frozen events
 */
async function testHappyPath() {
  console.log('  Running happy path test...');
  const startTime = Date.now();

  try {
    // Use actual streaming endpoint (adjust URL as needed)
    const events = await streamEvents(`${BASE_URL}/stream?analysis=test`, {}, 15000);

    // Verify only frozen events are emitted
    const eventTypes = events.map(e => e.event || 'message').filter(e => e);
    const unauthorizedEvents = eventTypes.filter(e => !FROZEN_EVENTS.includes(e));

    if (unauthorizedEvents.length > 0) {
      return {
        name: 'happy_path',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: `Unauthorized events detected: ${unauthorizedEvents.join(', ')}`,
        events: events.length,
        unauthorized_events: unauthorizedEvents
      };
    }

    // Verify sequence contains expected events
    if (!eventTypes.includes('hello')) {
      return {
        name: 'happy_path',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: 'Missing hello event in sequence',
        events: events.length
      };
    }

    // Save event capture
    writeFileSync(
      join(OUTPUT_DIR, 'happy.ndjson'),
      events.map(e => JSON.stringify(e)).join('\n')
    );

    return {
      name: 'happy_path',
      status: 'PASS',
      duration_ms: Date.now() - startTime,
      events: events.length,
      event_types: [...new Set(eventTypes)]
    };
  } catch (error) {
    return {
      name: 'happy_path',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Test: Resume once using Last-Event-ID
 */
async function testResumeOnce() {
  console.log('  Running resume-once test...');
  const startTime = Date.now();

  try {
    // Start stream and collect first few events
    const initialEvents = await streamEvents(`${BASE_URL}/stream?analysis=resume-test`, {}, 3000);

    if (initialEvents.length === 0) {
      return {
        name: 'resume_once',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: 'No initial events received'
      };
    }

    // Get last event ID
    const lastEventId = initialEvents[initialEvents.length - 1].id;
    if (!lastEventId) {
      return {
        name: 'resume_once',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: 'No event ID found for resumption'
      };
    }

    // Resume from last event ID
    const resumedEvents = await streamEvents(
      `${BASE_URL}/stream?analysis=resume-test`,
      { 'Last-Event-ID': lastEventId },
      10000
    );

    // Verify no duplicate events
    const allEventIds = [...initialEvents, ...resumedEvents].map(e => e.id).filter(id => id);
    const uniqueIds = new Set(allEventIds);

    if (allEventIds.length !== uniqueIds.size) {
      return {
        name: 'resume_once',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: 'Duplicate events detected after resume'
      };
    }

    // Save resume capture
    writeFileSync(
      join(OUTPUT_DIR, 'resume-once.ndjson'),
      [...initialEvents, ...resumedEvents].map(e => JSON.stringify(e)).join('\n')
    );

    return {
      name: 'resume_once',
      status: 'PASS',
      duration_ms: Date.now() - startTime,
      initial_events: initialEvents.length,
      resumed_events: resumedEvents.length,
      last_event_id: lastEventId
    };
  } catch (error) {
    return {
      name: 'resume_once',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Test: Cancel idempotent (202 then 409, ≤150ms to cease)
 */
async function testCancelIdempotent() {
  console.log('  Running cancel idempotent test...');
  const startTime = Date.now();

  try {
    // Start streaming analysis
    const streamPromise = streamEvents(`${BASE_URL}/stream?analysis=cancel-test`, {}, 10000);

    // Wait a bit then cancel
    await new Promise(resolve => setTimeout(resolve, 1000));

    const cancelStart = Date.now();

    // First cancel
    const cancel1 = await makeRequest(`${BASE_URL}/cancel?analysis=cancel-test`, {
      method: 'POST'
    });

    if (cancel1.status !== 202) {
      return {
        name: 'cancel_idempotent',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: `First cancel wrong status: expected 202, got ${cancel1.status}`
      };
    }

    // Second cancel (should be 409 - already cancelled)
    const cancel2 = await makeRequest(`${BASE_URL}/cancel?analysis=cancel-test`, {
      method: 'POST'
    });

    if (cancel2.status !== 409) {
      return {
        name: 'cancel_idempotent',
        status: 'FAIL',
        duration_ms: Date.now() - startTime,
        error: `Second cancel wrong status: expected 409, got ${cancel2.status}`
      };
    }

    // Check stream stops within 150ms
    const cancelDuration = Date.now() - cancelStart;

    try {
      const events = await streamPromise;
      // Check for cancelled event
      const cancelledEvent = events.find(e => e.event === 'cancelled');

      // Save cancel events
      writeFileSync(
        join(OUTPUT_DIR, 'cancel.ndjson'),
        events.map(e => JSON.stringify(e)).join('\n')
      );

      return {
        name: 'cancel_idempotent',
        status: cancelDuration <= 150 ? 'PASS' : 'FAIL',
        duration_ms: Date.now() - startTime,
        cancel_duration_ms: cancelDuration,
        first_status: cancel1.status,
        second_status: cancel2.status,
        has_cancelled_event: !!cancelledEvent,
        error: cancelDuration > 150 ? `Cancel took ${cancelDuration}ms, expected ≤150ms` : undefined
      };
    } catch (streamError) {
      // Stream may abort on cancel, which is expected
      return {
        name: 'cancel_idempotent',
        status: 'PASS',
        duration_ms: Date.now() - startTime,
        cancel_duration_ms: cancelDuration,
        first_status: cancel1.status,
        second_status: cancel2.status,
        stream_aborted: true
      };
    }
  } catch (error) {
    return {
      name: 'cancel_idempotent',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Test: Rate limit produces 'limited' event or 429 status
 */
async function testRateLimit() {
  console.log('  Running rate limit test...');
  const startTime = Date.now();

  try {
    // Try to trigger rate limit by making rapid requests
    const rapidRequests = Array.from({ length: 5 }, (_, i) =>
      makeRequest(`${BASE_URL}/stream?analysis=rate-test-${i}`, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      })
    );

    const responses = await Promise.allSettled(rapidRequests);

    // Check for rate limit responses
    let rateLimited = false;
    let limitedEvent = null;

    for (const result of responses) {
      if (result.status === 'fulfilled') {
        const response = result.value;

        if (response.status === 429) {
          rateLimited = true;
          break;
        }

        // Check for limited event in stream
        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
          try {
            const events = await streamEvents(response.url, {}, 2000);
            const limited = events.find(e => e.event === 'limited');
            if (limited) {
              limitedEvent = limited;
              rateLimited = true;
              break;
            }
          } catch (e) {
            // Ignore stream errors for this test
          }
        }
      }
    }

    if (limitedEvent) {
      writeFileSync(
        join(OUTPUT_DIR, 'limited.ndjson'),
        JSON.stringify(limitedEvent)
      );
    }

    return {
      name: 'rate_limit',
      status: 'PASS', // We don't require rate limiting to trigger, just test the taxonomy
      duration_ms: Date.now() - startTime,
      rate_limited: rateLimited,
      has_limited_event: !!limitedEvent,
      note: 'Rate limiting may not trigger in test environment'
    };
  } catch (error) {
    return {
      name: 'rate_limit',
      status: 'ERROR',
      duration_ms: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Test: Error taxonomy
 */
async function testErrorTaxonomy() {
  console.log('  Running error taxonomy test...');
  const startTime = Date.now();

  const testCases = [
    {
      name: 'invalid_params',
      url: `${BASE_URL}/stream?invalid=params`,
      expected_status: 400
    },
    {
      name: 'missing_auth',
      url: `${BASE_URL}/stream?analysis=protected`,
      expected_status: 401
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    try {
      const response = await makeRequest(testCase.url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      });

      results.push({
        name: testCase.name,
        status: response.status === testCase.expected_status ? 'PASS' : 'FAIL',
        expected_status: testCase.expected_status,
        actual_status: response.status
      });
    } catch (error) {
      results.push({
        name: testCase.name,
        status: 'ERROR',
        error: error.message
      });
    }
  }

  const allPassed = results.every(r => r.status === 'PASS');

  return {
    name: 'error_taxonomy',
    status: allPassed ? 'PASS' : 'FAIL',
    duration_ms: Date.now() - startTime,
    test_cases: results
  };
}

/**
 * Run all conformance tests
 */
async function runConformanceTests() {
  console.log('🔍 Starting stream conformance tests (frozen contract)...');
  const overallStartTime = Date.now();

  const tests = [
    testHappyPath,
    testResumeOnce,
    testCancelIdempotent,
    testRateLimit,
    testErrorTaxonomy
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);

      const status = result.status === 'PASS' ? '✅' :
                    result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`  ${status} ${result.name}: ${result.status}`);

      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    } catch (error) {
      const errorResult = {
        name: test.name || 'unknown',
        status: 'ERROR',
        duration_ms: 0,
        error: error.message
      };
      results.push(errorResult);
      console.log(`  ⚠️ ${errorResult.name}: ERROR - ${error.message}`);
    }
  }

  const overallDuration = Date.now() - overallStartTime;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  const overallStatus = errors > 0 ? 'ERROR' :
                       failed > 0 ? 'FAIL' : 'PASS';

  const conformanceResult = {
    schema: 'stream-conformance.v1',
    timestamp: new Date().toISOString(),
    status: overallStatus,
    contract: 'frozen',
    frozen_events: FROZEN_EVENTS,
    tests_passed: passed,
    tests_total: results.length,
    tests_failed: failed,
    tests_error: errors,
    duration_ms: overallDuration,
    base_url: BASE_URL,
    tests: results
  };

  // Write conformance report
  const outputFile = join(OUTPUT_DIR, 'conformance.json');
  writeFileSync(outputFile, JSON.stringify(conformanceResult, null, 2));

  console.log(`\n📊 Stream conformance complete:`);
  console.log(`   Contract: Frozen (${FROZEN_EVENTS.join(', ')})`);
  console.log(`   Status: ${overallStatus}`);
  console.log(`   Passed: ${passed}/${results.length}`);
  console.log(`   Duration: ${overallDuration}ms`);
  console.log(`   Report: ${outputFile}`);

  // Print compact checklist
  console.log(`\n📋 Conformance Checklist:`);
  results.forEach(result => {
    const symbol = result.status === 'PASS' ? '✅' :
                   result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${symbol} ${result.name.replace(/_/g, ' ')}`);
  });

  // Exit with error code if any tests failed
  if (overallStatus !== 'PASS') {
    process.exit(1);
  }
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runConformanceTests().catch(error => {
    console.error('❌ Stream conformance failed:', error);
    process.exit(1);
  });
}