/**
 * Server-Sent Events (SSE) Type Definitions
 * Frozen event types for contract wall compliance
 */

export type SSEEventType =
  | 'hello'        // Connection established
  | 'token'        // Analysis token/progress update
  | 'cost'         // Cost calculation update
  | 'done'         // Analysis completed successfully
  | 'cancelled'    // Analysis cancelled by user
  | 'limited'      // Rate limit or quota exceeded
  | 'error';       // Analysis failed with error

export interface BaseSSEEvent {
  type: SSEEventType;
  timestamp: string;
  sessionId: string;
}

export interface HelloEvent extends BaseSSEEvent {
  type: 'hello';
  data: {
    sessionId: string;
    timestamp: string;
    analysisType?: string;
    queuePosition?: number;
  };
}

export interface TokenEvent extends BaseSSEEvent {
  type: 'token';
  data: {
    content: string;
    progress: number; // 0-1
    stage?: string;
    eta?: string;
  };
}

export interface CostEvent extends BaseSSEEvent {
  type: 'cost';
  data: {
    credits: number;
    estimate: number;
    breakdown: {
      analysis: number;
      llm: number;
      processing?: number;
    };
  };
}

export interface DoneEvent extends BaseSSEEvent {
  type: 'done';
  data: {
    result: 'success';
    reportId: string;
    analysisComplete: boolean;
    resultUrl?: string;
  };
}

export interface CancelledEvent extends BaseSSEEvent {
  type: 'cancelled';
  data: {
    reason: string;
    stage: string;
    partialResults?: boolean;
  };
}

export interface LimitedEvent extends BaseSSEEvent {
  type: 'limited';
  data: {
    limitType: 'rate' | 'quota' | 'concurrent';
    resetTime: string;
    remaining: number;
    limit: number;
  };
}

export interface ErrorEvent extends BaseSSEEvent {
  type: 'error';
  data: {
    code: 'TIMEOUT' | 'RETRYABLE' | 'INTERNAL' | 'BAD_INPUT' | 'RATE_LIMIT' | 'BREAKER_OPEN';
    message: string;
    retryable: boolean;
    details?: Record<string, any>;
  };
}

export type SSEEvent =
  | HelloEvent
  | TokenEvent
  | CostEvent
  | DoneEvent
  | CancelledEvent
  | LimitedEvent
  | ErrorEvent;

/**
 * SSE Event Factory Functions
 */
export class SSEEventFactory {
  static hello(sessionId: string, data: HelloEvent['data']): HelloEvent {
    return {
      type: 'hello',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        ...data,
        sessionId,
        timestamp: new Date().toISOString()
      }
    };
  }

  static token(sessionId: string, content: string, progress: number, stage?: string, eta?: string): TokenEvent {
    return {
      type: 'token',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        content,
        progress,
        stage,
        eta
      }
    };
  }

  static cost(sessionId: string, credits: number, estimate: number, breakdown: CostEvent['data']['breakdown']): CostEvent {
    return {
      type: 'cost',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        credits,
        estimate,
        breakdown
      }
    };
  }

  static done(sessionId: string, reportId: string, resultUrl?: string): DoneEvent {
    return {
      type: 'done',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        result: 'success',
        reportId,
        analysisComplete: true,
        resultUrl
      }
    };
  }

  static cancelled(sessionId: string, reason: string, stage: string, partialResults?: boolean): CancelledEvent {
    return {
      type: 'cancelled',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        reason,
        stage,
        partialResults
      }
    };
  }

  static limited(sessionId: string, limitType: LimitedEvent['data']['limitType'], resetTime: string, remaining: number, limit: number): LimitedEvent {
    return {
      type: 'limited',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        limitType,
        resetTime,
        remaining,
        limit
      }
    };
  }

  static error(sessionId: string, code: ErrorEvent['data']['code'], message: string, retryable: boolean, details?: Record<string, any>): ErrorEvent {
    return {
      type: 'error',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {
        code,
        message,
        retryable,
        details
      }
    };
  }
}

/**
 * SSE Response Formatter
 */
export class SSEFormatter {
  static format(event: SSEEvent): string {
    return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  }

  static formatMultiple(events: SSEEvent[]): string {
    return events.map(event => SSEFormatter.format(event)).join('');
  }
}

/**
 * Type Guards
 */
export function isSSEEventType(type: string): type is SSEEventType {
  return ['hello', 'token', 'cost', 'done', 'cancelled', 'limited', 'error'].includes(type);
}

export function isValidSSEEvent(event: any): event is SSEEvent {
  return (
    event &&
    typeof event === 'object' &&
    isSSEEventType(event.type) &&
    typeof event.timestamp === 'string' &&
    typeof event.sessionId === 'string' &&
    event.data &&
    typeof event.data === 'object'
  );
}