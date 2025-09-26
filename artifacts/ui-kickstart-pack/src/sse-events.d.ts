/**
 * Server-Sent Events TypeScript Types
 * For Decision Guide AI streaming interface
 */

/**
 * Base SSE Event structure
 */
export interface SSEEvent {
  /** Event ID for resumption with Last-Event-ID */
  id?: string;
  /** Event type name */
  event?: string;
  /** Event data payload (JSON string) */
  data: string;
  /** Optional timestamp */
  timestamp?: number;
}

/**
 * Token streaming event data
 */
export interface TokenEventData {
  /** Unique token identifier */
  id: string;
  /** Token text content */
  text: string;
  /** Generation timestamp */
  timestamp: number;
  /** Session ID this token belongs to */
  sessionId: string;
  /** Whether this token was sent after reconnection */
  resumed?: boolean;
}

/**
 * Stream completion event data
 */
export interface CompleteEventData {
  /** Session ID */
  sessionId: string;
  /** Total tokens generated */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Model used for generation */
  model: string;
  /** Whether this completion followed a reconnection */
  resumed?: boolean;
}

/**
 * Stream cancellation event data
 */
export interface CancelEventData {
  /** Session ID */
  sessionId: string;
  /** Reason for cancellation */
  reason: 'user_cancelled' | 'timeout' | 'error';
  /** Number of partial tokens generated before cancel */
  partialTokens: number;
  /** Cancellation timestamp */
  timestamp: number;
}

/**
 * Error event data
 */
export interface ErrorEventData {
  /** Session ID */
  sessionId: string;
  /** Error details */
  error: {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: string;
    /** Error timestamp */
    timestamp: number;
  };
}

/**
 * Job progress event data
 */
export interface JobProgressEventData {
  /** Session ID */
  sessionId: string;
  /** Job identifier */
  jobId: string;
  /** Human-readable job name */
  name: string;
  /** Current job status */
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Progress timestamp */
  timestamp: number;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Disconnect/reconnection event data
 */
export interface DisconnectEventData {
  /** Session ID */
  sessionId: string;
  /** Disconnect reason */
  reason: 'connection_lost' | 'server_restart' | 'client_disconnect';
  /** Last successfully processed token ID */
  lastTokenId: string;
  /** Disconnect timestamp */
  timestamp?: number;
}

/**
 * Union type for all possible event data payloads
 */
export type SSEEventData =
  | TokenEventData
  | CompleteEventData
  | CancelEventData
  | ErrorEventData
  | JobProgressEventData
  | DisconnectEventData;

/**
 * Typed SSE Events by event name
 */
export interface TypedSSEEvents {
  'token': SSEEvent & { data: string; parsedData: TokenEventData };
  'complete': SSEEvent & { data: string; parsedData: CompleteEventData };
  'cancelled': SSEEvent & { data: string; parsedData: CancelEventData };
  'error': SSEEvent & { data: string; parsedData: ErrorEventData };
  'job_progress': SSEEvent & { data: string; parsedData: JobProgressEventData };
  'job_cancelled': SSEEvent & { data: string; parsedData: JobProgressEventData };
  'disconnect': SSEEvent & { data: string; parsedData: DisconnectEventData };
}

/**
 * SSE Connection state
 */
export interface SSEConnectionState {
  /** Current connection status */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** Session ID */
  sessionId?: string;
  /** Last received event ID for resumption */
  lastEventId?: string;
  /** Connection error if any */
  error?: string;
  /** Connection timestamp */
  connectedAt?: number;
  /** Disconnection timestamp */
  disconnectedAt?: number;
}

/**
 * SSE Client configuration
 */
export interface SSEClientConfig {
  /** Server URL */
  url: string;
  /** Session parameters */
  sessionId: string;
  /** Optional resume from event ID */
  lastEventId?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Maximum reconnection attempts */
  maxRetries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}
