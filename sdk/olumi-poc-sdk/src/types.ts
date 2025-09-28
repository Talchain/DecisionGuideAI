/**
 * Olumi Scenario Sandbox PoC SDK Types
 * Version: v0.1.0
 *
 * Exact contract types matching pilot deployment endpoints
 */

// SSE Event Types
export type SSEEventType = 'hello' | 'token' | 'cost' | 'done' | 'cancelled' | 'limited' | 'error';

export interface SSEEventBase {
  type: SSEEventType;
  timestamp?: string;
  id?: string;
}

export interface HelloEvent extends SSEEventBase {
  type: 'hello';
  data: {
    sessionId: string;
    seed?: number;
    timestamp: string;
  };
}

export interface TokenEvent extends SSEEventBase {
  type: 'token';
  data: {
    text: string;
    tokenIndex: number;
    timestamp: string;
    model?: string;
  };
}

export interface CostEvent extends SSEEventBase {
  type: 'cost';
  data: {
    tokens: number;
    cost: number;
    currency: string;
    timestamp: string;
  };
}

export interface DoneEvent extends SSEEventBase {
  type: 'done';
  data: {
    sessionId: string;
    totalTokens: number;
    seed?: number;
    timestamp: string;
  };
}

export interface CancelledEvent extends SSEEventBase {
  type: 'cancelled';
  data: {
    reason: string;
    timestamp: string;
    sessionId?: string;
  };
}

export interface LimitedEvent extends SSEEventBase {
  type: 'limited';
  data: {
    message: string;
    timestamp: string;
  };
}

export interface ErrorEvent extends SSEEventBase {
  type: 'error';
  data: {
    message: string;
    code?: string;
    timestamp: string;
  };
}

export type SSEEvent = HelloEvent | TokenEvent | CostEvent | DoneEvent | CancelledEvent | LimitedEvent | ErrorEvent;

// Job Events
export interface JobProgressEvent {
  type: 'progress';
  data: {
    jobId: string;
    percent: number;
    message: string;
    timestamp: string;
  };
}

export interface JobCompleteEvent {
  type: 'complete';
  data: {
    jobId: string;
    result: any;
    timestamp: string;
  };
}

export interface JobErrorEvent {
  type: 'error';
  data: {
    jobId: string;
    message: string;
    timestamp: string;
  };
}

export type JobEvent = JobProgressEvent | JobCompleteEvent | JobErrorEvent;

// API Response Types
export interface CancelResult {
  status: 'cancelling' | 'already_cancelled';
  sessionId?: string;
  jobId?: string;
  timestamp: string;
}

// Report v1 Structure (exact contract)
export interface DecisionOption {
  id: string;
  name: string;
  score: number;
  description: string;
}

export interface Decision {
  title: string;
  options: DecisionOption[];
}

export interface Recommendation {
  primary: string;
}

export interface Analysis {
  confidence: string;
}

export interface ReportMeta {
  scenarioId: string;
  seed: number;
  timestamp: string;
}

export interface ReportV1 {
  decision: Decision;
  recommendation: Recommendation;
  analysis: Analysis;
  meta: ReportMeta;
}

// Client Configuration
export interface ClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  eventSourceImpl?: typeof EventSource;
}

// Stream Parameters
export interface StreamParams {
  scenarioId: string;
  seed?: number;
  budget?: number;
  sessionId?: string;
  route?: 'critique' | 'analysis' | 'decision';
}

export interface JobsStreamParams {
  scenarioId: string;
  seed?: number;
}

export interface CancelParams {
  runId: string;
}

export interface JobsCancelParams {
  jobId: string;
}

export interface ReportParams {
  scenarioId: string;
  runId?: string;
  seed?: number;
}

// Client Interface
export interface OlumiClient {
  stream(params: StreamParams): AsyncIterable<SSEEvent>;
  cancel(params: CancelParams): Promise<CancelResult>;
  jobsStream(params: JobsStreamParams): AsyncIterable<JobEvent>;
  jobsCancel(params: JobsCancelParams): Promise<CancelResult>;
  getReport(params: ReportParams): Promise<ReportV1>;
}

// SDK Version Export
export const SDK_VERSION = 'v0.1.0';