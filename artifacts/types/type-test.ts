/**
 * Test file to verify TypeScript types compile correctly
 */

import type { ReportV1, ReportV1Response } from './report-v1';
import type { SSEEvent, TokenEventData, TypedSSEEvents } from './sse-events';
import type { StreamViewModel, JobsViewModel, UIState } from './ui-models';

// Test Report v1 types
const testReport: ReportV1 = {
  version: '1.0',
  meta: {
    seed: 42,
    timestamp: '2025-09-25T10:00:00Z',
    duration: 5000,
    route: '/api/analysis',
    status: 'completed',
    model: 'gpt-4-turbo',
    totalTokens: 1250,
    totalCost: 0.025
  },
  steps: [{
    id: 'step_001',
    type: 'analysis',
    startTime: Date.now(),
    endTime: Date.now() + 2000,
    duration: 2000,
    status: 'completed',
    tokens: 400,
    cost: 0.008
  }],
  totals: {
    totalSteps: 1,
    completedSteps: 1,
    totalTokens: 1250,
    totalCost: 0.025,
    totalDuration: 5000
  }
};

// Test SSE event types
const testSSEEvent: SSEEvent = {
  id: 'token_001',
  event: 'token',
  data: JSON.stringify({
    id: 'token_001',
    text: 'Hello',
    timestamp: Date.now(),
    sessionId: 'test-session'
  })
};

const tokenData: TokenEventData = JSON.parse(testSSEEvent.data);

// Test UI view model types
const testStreamViewModel: StreamViewModel = {
  sessionId: 'test-session',
  status: 'completed',
  tokens: [{
    id: 'token_001',
    text: 'Hello world',
    timestamp: Date.now()
  }],
  metadata: {
    totalTokens: 2,
    totalCost: 0.004,
    duration: 1000,
    model: 'gpt-4-turbo'
  }
};

const testJobsViewModel: JobsViewModel = {
  sessionId: 'test-session',
  jobs: [{
    id: 'job_001',
    name: 'Analysis',
    status: 'completed',
    progress: 100,
    startTime: Date.now() - 5000,
    endTime: Date.now()
  }]
};

// Test that types work together
function processTokenEvent(event: TypedSSEEvents['token']): void {
  const data = event.parsedData;
  console.log(`Token ${data.id}: ${data.text}`);
}

// Export test to prevent "unused" warnings
export {
  testReport,
  testSSEEvent,
  tokenData,
  testStreamViewModel,
  testJobsViewModel,
  processTokenEvent
};