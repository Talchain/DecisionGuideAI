/**
 * Olumi Scenario Sandbox PoC SDK Client
 * Version: v0.1.0
 *
 * Zero-dependency TypeScript client for Scenario Sandbox pilot endpoints
 */

import {
  ClientConfig,
  OlumiClient,
  StreamParams,
  JobsStreamParams,
  CancelParams,
  JobsCancelParams,
  ReportParams,
  SSEEvent,
  JobEvent,
  CancelResult,
  ReportV1,
  SDK_VERSION
} from './types.js';

/**
 * Create an Olumi Scenario Sandbox client
 */
export function createClient(config: ClientConfig): OlumiClient {
  const { baseUrl, fetchImpl = globalThis.fetch, eventSourceImpl = globalThis.EventSource } = config;

  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }

  if (!fetchImpl) {
    throw new Error('fetch implementation not available');
  }

  if (!eventSourceImpl) {
    throw new Error('EventSource implementation not available');
  }

  return {
    async *stream(params: StreamParams): AsyncIterable<SSEEvent> {
      const { scenarioId, seed, budget, sessionId, route = 'critique' } = params;

      const url = new URL('/stream', baseUrl);
      url.searchParams.set('route', route);
      url.searchParams.set('scenarioId', scenarioId);

      if (seed !== undefined) url.searchParams.set('seed', String(seed));
      if (budget !== undefined) url.searchParams.set('budget', String(budget));
      if (sessionId) url.searchParams.set('sessionId', sessionId);

      const eventSource = new eventSourceImpl(url.toString());

      try {
        yield* createSSEAsyncIterable(eventSource);
      } finally {
        eventSource.close();
      }
    },

    async cancel(params: CancelParams): Promise<CancelResult> {
      const { runId } = params;

      const response = await fetchImpl(`${baseUrl}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: runId }),
      });

      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    },

    async *jobsStream(params: JobsStreamParams): AsyncIterable<JobEvent> {
      const { scenarioId, seed } = params;

      const url = new URL('/jobs/stream', baseUrl);
      url.searchParams.set('scenarioId', scenarioId);

      if (seed !== undefined) url.searchParams.set('seed', String(seed));

      const eventSource = new eventSourceImpl(url.toString());

      try {
        yield* createJobsAsyncIterable(eventSource);
      } finally {
        eventSource.close();
      }
    },

    async jobsCancel(params: JobsCancelParams): Promise<CancelResult> {
      const { jobId } = params;

      const response = await fetchImpl(`${baseUrl}/jobs/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        throw new Error(`Jobs cancel failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    },

    async getReport(params: ReportParams): Promise<ReportV1> {
      const { scenarioId, runId, seed } = params;

      const url = new URL('/report', baseUrl);
      url.searchParams.set('scenarioId', scenarioId);

      if (runId) url.searchParams.set('sessionId', runId);
      if (seed !== undefined) url.searchParams.set('seed', String(seed));

      const response = await fetchImpl(url.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Report failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    },
  };
}

/**
 * Convert EventSource to AsyncIterable for SSE events
 */
async function* createSSEAsyncIterable(eventSource: EventSource): AsyncIterable<SSEEvent> {
  const messageQueue: SSEEvent[] = [];
  const errorQueue: Error[] = [];
  let resolveNext: ((value: IteratorResult<SSEEvent>) => void) | null = null;
  let isComplete = false;

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const sseEvent: SSEEvent = {
        ...data,
        id: event.lastEventId || undefined,
      };

      messageQueue.push(sseEvent);

      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: messageQueue.shift()!, done: false });
      }

      // Check for completion events
      if (data.type === 'done' || data.type === 'cancelled' || data.type === 'error') {
        isComplete = true;
        eventSource.close();
      }
    } catch (error) {
      errorQueue.push(error instanceof Error ? error : new Error(String(error)));
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: undefined, done: true });
      }
    }
  };

  eventSource.onerror = () => {
    isComplete = true;
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve({ value: undefined, done: true });
    }
  };

  while (!isComplete || messageQueue.length > 0) {
    if (errorQueue.length > 0) {
      throw errorQueue.shift()!;
    }

    if (messageQueue.length > 0) {
      yield messageQueue.shift()!;
    } else if (!isComplete) {
      await new Promise<IteratorResult<SSEEvent>>((resolve) => {
        resolveNext = resolve;
      });
    }
  }
}

/**
 * Convert EventSource to AsyncIterable for Job events
 */
async function* createJobsAsyncIterable(eventSource: EventSource): AsyncIterable<JobEvent> {
  const messageQueue: JobEvent[] = [];
  const errorQueue: Error[] = [];
  let resolveNext: ((value: IteratorResult<JobEvent>) => void) | null = null;
  let isComplete = false;

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      messageQueue.push(data);

      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: messageQueue.shift()!, done: false });
      }

      // Check for completion events
      if (data.type === 'complete' || data.type === 'error') {
        isComplete = true;
        eventSource.close();
      }
    } catch (error) {
      errorQueue.push(error instanceof Error ? error : new Error(String(error)));
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: undefined, done: true });
      }
    }
  };

  eventSource.onerror = () => {
    isComplete = true;
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve({ value: undefined, done: true });
    }
  };

  while (!isComplete || messageQueue.length > 0) {
    if (errorQueue.length > 0) {
      throw errorQueue.shift()!;
    }

    if (messageQueue.length > 0) {
      yield messageQueue.shift()!;
    } else if (!isComplete) {
      await new Promise<IteratorResult<JobEvent>>((resolve) => {
        resolveNext = resolve;
      });
    }
  }
}

// Re-export types and version
export * from './types.js';
export { SDK_VERSION };