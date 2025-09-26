/**
 * Simulation Adapters for Windsurf UI Development
 * Offline-ready functions for testing without live endpoints
 */

import type { SSEEvent, TokenEventData, CompleteEventData, JobProgressEventData, CancelEventData, ErrorEventData } from './sse-events';
import type { ReportV1 } from './report-v1';

// Local view model types for use in adapters (to avoid circular imports)
interface ViewModelBase {
  timestamp: string;
  version: string;
  scenario?: string;
}

interface StreamViewModel extends ViewModelBase {
  type: 'stream';
  initialState: 'idle' | 'streaming' | 'completed' | 'error' | 'cancelled';
  tokens?: Array<{
    id: string;
    text: string;
    timestamp: number;
    resumed?: boolean;
  }>;
  metadata?: {
    sessionId: string;
    totalTokens: number;
    totalCost: number;
    model: string;
  };
}

interface JobsViewModel extends ViewModelBase {
  type: 'jobs';
  jobs: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'cancelled' | 'error';
    progress: number;
    timestamp: number;
    error?: string;
  }>;
}

interface ReportViewModel extends ViewModelBase {
  type: 'report';
  reportId: string;
  status: 'loading' | 'loaded' | 'error' | 'no-data';
  report?: ReportV1;
  error?: string;
}

/**
 * Mock SSE Stream Configuration
 */
export interface MockStreamConfig {
  /** Session ID for the stream */
  sessionId?: string;
  /** Number of tokens to generate (default: 10) */
  tokenCount?: number;
  /** Delay between tokens in ms (default: 100) */
  tokenDelay?: number;
  /** Whether to simulate cancellation (default: false) */
  shouldCancel?: boolean;
  /** Whether to simulate an error (default: false) */
  shouldError?: boolean;
  /** Model to simulate (default: 'gpt-4') */
  model?: string;
}

/**
 * Mock Job Stream Configuration
 */
export interface MockJobConfig {
  /** Session ID for the job */
  sessionId?: string;
  /** Job name */
  jobName?: string;
  /** Total number of progress steps (default: 10) */
  totalSteps?: number;
  /** Delay between progress updates in ms (default: 500) */
  progressDelay?: number;
  /** Whether to cancel at 50% progress (default: false) */
  shouldCancelAt50?: boolean;
}

/**
 * Creates a simulated SSE stream for testing UI components
 * @param config Stream configuration
 * @returns AsyncIterable of SSE events
 */
export async function* openStreamSim(config: MockStreamConfig = {}): AsyncIterable<SSEEvent> {
  const {
    sessionId = 'sim-' + Date.now(),
    tokenCount = 10,
    tokenDelay = 100,
    shouldCancel = false,
    shouldError = false,
    model = 'gpt-4'
  } = config;

  // Start event
  yield {
    id: '1',
    event: 'start',
    data: JSON.stringify({
      sessionId,
      model,
      timestamp: Date.now()
    })
  };

  // Generate tokens
  for (let i = 1; i <= tokenCount; i++) {
    if (shouldCancel && i === Math.floor(tokenCount / 2)) {
      yield {
        id: String(i + 1),
        event: 'cancelled',
        data: JSON.stringify({
          sessionId,
          reason: 'user_cancelled',
          partialTokens: i - 1,
          timestamp: Date.now()
        } satisfies CancelEventData)
      };
      return;
    }

    if (shouldError && i === Math.floor(tokenCount / 2)) {
      yield {
        id: String(i + 1),
        event: 'error',
        data: JSON.stringify({
          sessionId,
          error: {
            code: 'simulation_error',
            message: 'Simulated error for testing',
            timestamp: Date.now()
          }
        })
      };
      return;
    }

    const tokenData: TokenEventData = {
      id: `token_${i}`,
      text: `Token ${i} text content. `,
      timestamp: Date.now(),
      sessionId
    };

    yield {
      id: String(i + 1),
      event: 'token',
      data: JSON.stringify(tokenData)
    };

    await new Promise(resolve => setTimeout(resolve, tokenDelay));
  }

  // Complete event
  const completeData: CompleteEventData = {
    sessionId,
    totalTokens: tokenCount,
    totalCost: tokenCount * 0.001, // Simulate $0.001 per token
    duration: tokenCount * tokenDelay,
    model
  };

  yield {
    id: String(tokenCount + 2),
    event: 'complete',
    data: JSON.stringify(completeData)
  };
}

/**
 * Creates a simulated job progress stream
 * @param config Job configuration
 * @returns AsyncIterable of SSE events
 */
export async function* openJobStreamSim(config: MockJobConfig = {}): AsyncIterable<SSEEvent> {
  const {
    sessionId = 'job-' + Date.now(),
    jobName = 'Analysis Job',
    totalSteps = 10,
    progressDelay = 500,
    shouldCancelAt50 = false
  } = config;

  const jobId = 'job_' + Date.now();

  // Start job
  const startData: JobProgressEventData = {
    sessionId,
    jobId,
    name: jobName,
    status: 'running',
    progress: 0,
    timestamp: Date.now()
  };

  yield {
    id: '1',
    event: 'job_progress',
    data: JSON.stringify(startData)
  };

  // Progress updates
  for (let step = 1; step <= totalSteps; step++) {
    const progress = Math.round((step / totalSteps) * 100);

    if (shouldCancelAt50 && progress >= 50) {
      const cancelData: JobProgressEventData = {
        sessionId,
        jobId,
        name: jobName,
        status: 'cancelled',
        progress: 50,
        timestamp: Date.now()
      };

      yield {
        id: String(step + 1),
        event: 'job_cancelled',
        data: JSON.stringify(cancelData)
      };
      return;
    }

    const progressData: JobProgressEventData = {
      sessionId,
      jobId,
      name: jobName,
      status: step === totalSteps ? 'completed' : 'running',
      progress,
      timestamp: Date.now()
    };

    yield {
      id: String(step + 1),
      event: 'job_progress',
      data: JSON.stringify(progressData)
    };

    if (step < totalSteps) {
      await new Promise(resolve => setTimeout(resolve, progressDelay));
    }
  }
}

/**
 * Loads a simulated report for testing
 * @param reportId Report identifier (use "sample" for default)
 * @returns Promise resolving to a ReportV1 object
 */
export async function loadReportSim(reportId: string = 'sample'): Promise<ReportV1> {
  // Simulate loading delay
  await new Promise(resolve => setTimeout(resolve, 200));

  const sampleReport: ReportV1 = {
    version: '1.0',
    meta: {
      seed: 12345,
      timestamp: new Date().toISOString(),
      duration: 5432,
      route: '/api/v1/analyze',
      totalTokens: 150,
      totalCost: 0.045,
      model: 'gpt-4',
      status: 'completed'
    },
    steps: [
      {
        id: 1,
        type: 'analysis',
        startTime: Date.now() - 5432,
        endTime: Date.now() - 3000,
        duration: 2432,
        status: 'completed',
        tokens: 85,
        cost: 0.025
      },
      {
        id: 2,
        type: 'generation',
        startTime: Date.now() - 3000,
        endTime: Date.now(),
        duration: 3000,
        status: 'completed',
        tokens: 65,
        cost: 0.020
      }
    ],
    totals: {
      totalSteps: 2,
      completedSteps: 2,
      totalTokens: 150,
      totalCost: 0.045,
      totalDuration: 5432
    }
  };

  return sampleReport;
}

/**
 * Loads a view model from the fixtures
 * @param fixtureName Name of the fixture (e.g., "stream-resume-once")
 * @returns Promise resolving to a view model object
 */
export async function loadViewModelSim(fixtureName: string): Promise<StreamViewModel | JobsViewModel | ReportViewModel> {
  // This would typically load from the fixtures/ directory
  // For now, return a default based on fixture name

  if (fixtureName.includes('job')) {
    return {
      type: 'jobs',
      timestamp: new Date().toISOString(),
      version: '1.0',
      scenario: fixtureName,
      jobs: [
        {
          id: 'job_1',
          name: 'Analysis Task',
          status: fixtureName.includes('cancel') ? 'cancelled' : 'completed',
          progress: fixtureName.includes('cancel') ? 50 : 100,
          timestamp: Date.now()
        }
      ]
    };
  }

  if (fixtureName.includes('report') || fixtureName.includes('no-data')) {
    return {
      type: 'report',
      timestamp: new Date().toISOString(),
      version: '1.0',
      scenario: fixtureName,
      reportId: 'sample',
      status: fixtureName.includes('no-data') ? 'no-data' : 'loaded',
      report: fixtureName.includes('no-data') ? undefined : await loadReportSim()
    };
  }

  // Default to stream view model
  return {
    type: 'stream',
    timestamp: new Date().toISOString(),
    version: '1.0',
    scenario: fixtureName,
    initialState: fixtureName.includes('error') ? 'error' :
                 fixtureName.includes('cancel') ? 'cancelled' : 'completed',
    tokens: [
      { id: 'token_1', text: 'This is ', timestamp: Date.now() - 1000 },
      { id: 'token_2', text: 'a simulated ', timestamp: Date.now() - 800 },
      { id: 'token_3', text: 'token stream ', timestamp: Date.now() - 600 },
      { id: 'token_4', text: 'for testing.', timestamp: Date.now() - 400 }
    ],
    metadata: {
      sessionId: 'sim_session',
      totalTokens: 4,
      totalCost: 0.004,
      model: 'gpt-4'
    }
  };
}

/**
 * Utility to create a mock EventSource for testing
 */
export class MockEventSource {
  public readyState: number = 0;
  public url: string;
  public onopen?: (event: Event) => void;
  public onmessage?: (event: MessageEvent) => void;
  public onerror?: (event: Event) => void;

  private _listeners: Map<string, Array<(event: Event) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this._listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  close() {
    this.readyState = 2;
  }

  // Method to simulate receiving messages (for testing)
  _simulateMessage(data: string, id?: string, eventType?: string) {
    const event = new MessageEvent('message', {
      data,
      lastEventId: id || ''
    });

    if (this.onmessage) {
      this.onmessage(event);
    }

    const listeners = this._listeners.get('message');
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }
}